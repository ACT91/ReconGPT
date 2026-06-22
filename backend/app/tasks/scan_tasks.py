import asyncio
from pathlib import Path
from datetime import datetime, timezone
from uuid import UUID
from celery import chain, chord, group
from sqlalchemy import select

from app.tasks.celery_app import celery_app
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.job import ScanJob, ScanStatus, PipelineStage, STAGE_ORDER
from app.models.pipeline_log import PipelineLog, LogLevel
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint, EndpointSource, EndpointStatus
from app.models.vulnerability import Vulnerability, VulnerabilitySeverity
from app.models.js_file import JsFile
from app.models.ai_insight import AiInsight, InsightType, InsightPriority
from app.pipeline.stages import (
    SubdomainEnumStage,
    LiveProbeStage,
    TechDetectStage,
    WebCrawlStage,
    JsExtractStage,
    EndpointExtractStage,
    JsDownloadStage,
    JsAnalysisStage,
    EndpointMergeStage,
    UrlReconstructStage,
    EndpointProbeStage,
    VulnScanStage,
    AiAnalysisStage,
)
from app.services.scan import ScanService
from app.core.logger import get_logger
from app.core.websocket_manager import broadcast_pipeline_event, emit_stage_progress, emit_stage_log
from app.ai.service import save_insights_to_db


logger = get_logger(__name__)


_worker_loop = None


def _get_loop():
    global _worker_loop
    if _worker_loop is None:
        _worker_loop = asyncio.new_event_loop()
    return _worker_loop


def run_async(coro):
    loop = _get_loop()
    return loop.run_until_complete(coro)


# Stage names that should be skipped when their config toggle is False
CONFIG_SKIP_STAGES = {
    PipelineStage.VULN_SCAN: "vuln_scan",
}

STAGE_CLASS_MAP = {
    PipelineStage.SUBDOMAIN_ENUM: SubdomainEnumStage,
    PipelineStage.LIVE_PROBE: LiveProbeStage,
    PipelineStage.TECH_DETECT: TechDetectStage,
    PipelineStage.WEB_CRAWL: WebCrawlStage,
    PipelineStage.JS_EXTRACT: JsExtractStage,
    PipelineStage.ENDPOINT_EXTRACT: EndpointExtractStage,
    PipelineStage.JS_DOWNLOAD: JsDownloadStage,
    PipelineStage.JS_ANALYSIS: JsAnalysisStage,
    PipelineStage.ENDPOINT_MERGE: EndpointMergeStage,
    PipelineStage.URL_RECONSTRUCT: UrlReconstructStage,
    PipelineStage.ENDPOINT_PROBE: EndpointProbeStage,
    PipelineStage.VULN_SCAN: VulnScanStage,
    PipelineStage.AI_ANALYSIS: AiAnalysisStage,
}


@celery_app.task(name="execute_scan_stage", bind=True, max_retries=2, default_retry_delay=30)
def execute_scan_stage(self, job_id: str, stage_name: str):
    stage = PipelineStage(stage_name)
    stage_cls = STAGE_CLASS_MAP.get(stage)
    
    if not stage_cls:
        logger.error("unknown_stage", job_id=job_id, stage=stage_name)
        return {"success": False, "error": f"Unknown stage: {stage_name}"}
    
    job = None
    try:
        async def run_stage():
            async with async_session_factory() as session:
                result = await session.execute(
                    select(ScanJob).where(ScanJob.id == job_id)
                )
                job = result.scalar_one_or_none()
                
                if not job:
                    return {"success": False, "error": "Job not found"}
                
                if job.status in [ScanStatus.CANCELLED]:
                    return {"success": False, "error": "Job cancelled"}
                
                job.current_stage = stage
                job.status = ScanStatus.RUNNING
                if not job.started_at:
                    job.started_at = datetime.now(timezone.utc)
                await session.commit()
            
            stage_instance = stage_cls(
                job_id=job_id,
                target=job.target_domain,
                storage_path=Path(settings.STORAGE_PATH),
            )
            
            import traceback as _tb
            try:
                result = await stage_instance.execute()
            except Exception as inner_e:
                logger.error("stage_inner_execution_failed", job_id=job_id, stage=stage_name, error=str(inner_e), traceback=_tb.format_exc())
                raise
            
            async with async_session_factory() as session:
                s_result = await session.execute(
                    select(ScanJob).where(ScanJob.id == job_id)
                )
                s_job = s_result.scalar_one_or_none()
                
                if s_job:
                    from app.models.job import STAGE_PROGRESS
                    s_job.progress_percent = STAGE_PROGRESS.get(stage, s_job.progress_percent)
                    
                    if not result.get("success"):
                        s_job.status = ScanStatus.FAILED
                        s_job.error_message = result.get("error", "Stage failed")
                        s_job.completed_at = datetime.now(timezone.utc)
                    
                    await session.commit()
            
            return result
        
        return run_async(run_stage())
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error("stage_execution_failed", job_id=job_id, stage=stage_name, error=str(e), traceback=tb)
        
        run_async(_update_job_failed(job_id, str(e)))
        
        return {"success": False, "error": str(e)}


async def _update_job_failed(job_id: str, error: str):
    async with async_session_factory() as session:
        result = await session.execute(
            select(ScanJob).where(ScanJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        if job:
            job.status = ScanStatus.FAILED
            job.error_message = error
            job.completed_at = datetime.now(timezone.utc)
            await session.commit()


@celery_app.task(name="execute_full_pipeline", bind=True, max_retries=3, default_retry_delay=60)
def execute_full_pipeline(self, job_id: str):
    try:
        stages = list(STAGE_ORDER)
        stage_count = len(stages)
        
        run_async(_initialize_job(job_id))
        run_async(_emit_pipeline_event(job_id, "pipeline_started", {"stages": stage_count}))
        
        for idx, stage in enumerate(stages):
            is_last = (idx == stage_count - 1)
            
            stage_progress = (idx / stage_count) * 100
            
            config_key = CONFIG_SKIP_STAGES.get(stage)
            if config_key:
                stage_config = run_async(_get_job_config(job_id))
                if not stage_config.get(config_key, True):
                    logger.info("stage_skipped_by_config", job_id=job_id, stage=stage.value, config_key=config_key)
                    run_async(_emit_pipeline_event(job_id, "stage_skipped", {"stage": stage.value}))
                    run_async(_update_job_progress(job_id, stage, ((idx + 1) / stage_count) * 100))
                    continue
            
            run_async(_emit_pipeline_event(
                job_id, "stage_started",
                {"stage": stage.value, "stage_index": idx, "total_stages": stage_count},
            ))
            
            logger.info(
                "pipeline_stage_starting",
                job_id=job_id,
                stage=stage.value,
                progress=f"{stage_progress:.1f}%",
            )
            
            result = execute_scan_stage(job_id, stage.value)
            
            is_cancelled = run_async(_check_job_cancelled(job_id))
            if is_cancelled:
                logger.info("pipeline_cancelled", job_id=job_id)
                run_async(_emit_pipeline_event(job_id, "pipeline_cancelled", {}))
                return {"success": False, "error": "Cancelled"}
            
            if not result.get("success"):
                if is_last:
                    run_async(_finalize_job(job_id, ScanStatus.PARTIAL))
                    run_async(_emit_pipeline_event(job_id, "pipeline_partial", {"failed_stage": stage.value}))
                    logger.warning("pipeline_partial_complete", job_id=job_id, failed_stage=stage.value)
                    return {"success": True, "partial": True, "failed_stage": stage.value}
                else:
                    logger.error("pipeline_failed", job_id=job_id, failed_stage=stage.value)
                    run_async(_emit_pipeline_event(job_id, "pipeline_failed", {"failed_stage": stage.value}))
                    return result
            
            progress = ((idx + 1) / stage_count) * 100
            run_async(_update_job_progress(job_id, stage, progress))
            
            run_async(_emit_pipeline_event(
                job_id, "stage_completed",
                {"stage": stage.value, "stage_index": idx, "progress": progress},
            ))
            
            logger.info(
                "pipeline_stage_completed",
                job_id=job_id,
                stage=stage.value,
                progress=f"{progress:.1f}%",
            )
        
        run_async(_finalize_job(job_id, ScanStatus.COMPLETED))
        run_async(_save_results_to_db(job_id))
        run_async(_emit_pipeline_event(job_id, "pipeline_completed", {}))
        
        logger.info("pipeline_completed", job_id=job_id)
        return {"success": True}
        
    except Exception as e:
        logger.error("pipeline_failed", job_id=job_id, error=str(e))
        run_async(_finalize_job(job_id, ScanStatus.FAILED, str(e)))
        run_async(_emit_pipeline_event(job_id, "pipeline_failed", {"error": str(e)}))
        return {"success": False, "error": str(e)}


async def _get_job_config(job_id: str) -> dict:
    async with async_session_factory() as session:
        result = await session.execute(
            select(ScanJob).where(ScanJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        return job.scan_config or {} if job else {}


async def _initialize_job(job_id: str):
    async with async_session_factory() as session:
        result = await session.execute(
            select(ScanJob).where(ScanJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        if job:
            job.status = ScanStatus.RUNNING
            job.started_at = datetime.now(timezone.utc)
            job.celery_task_id = execute_full_pipeline.request.id if hasattr(execute_full_pipeline, "request") else None
            await session.commit()


async def _check_job_cancelled(job_id: str) -> bool:
    async with async_session_factory() as session:
        result = await session.execute(
            select(ScanJob).where(ScanJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        return job.status == ScanStatus.CANCELLED if job else True


async def _update_job_progress(job_id: str, stage: PipelineStage, progress: float):
    async with async_session_factory() as session:
        result = await session.execute(
            select(ScanJob).where(ScanJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        if job:
            job.current_stage = stage
            job.progress_percent = progress
            await session.commit()


async def _emit_pipeline_event(job_id: str, event_type: str, data: dict):
    try:
        await broadcast_pipeline_event(
            job_id=UUID(job_id),
            event_type=event_type,
            data=data,
        )
    except Exception as e:
        logger.warning(f"Failed to emit pipeline event: {e}")


async def _finalize_job(job_id: str, status: ScanStatus, error: str = None):
    async with async_session_factory() as session:
        result = await session.execute(
            select(ScanJob).where(ScanJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        if job:
            job.status = status
            job.completed_at = datetime.now(timezone.utc)
            if error:
                job.error_message = error
            
            if status == ScanStatus.COMPLETED:
                job.progress_percent = 100.0
            
            await session.commit()


async def _save_results_to_db(job_id: str):
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                select(ScanJob).where(ScanJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                return
            
            storage_path = Path(settings.STORAGE_PATH) / str(job_id)
            
            subdomains_file = storage_path / "subdomains.txt"
            if subdomains_file.exists():
                lines = subdomains_file.read_text(encoding="utf-8", errors="ignore").split('\n')
                seen_names = set()
                for line in lines:
                    line = line.strip()
                    if line and line not in seen_names:
                        seen_names.add(line)
                        existing = await session.execute(
                            select(Subdomain).where(
                                Subdomain.scan_job_id == job.id,
                                Subdomain.name == line,
                            )
                        )
                        if not existing.scalar_one_or_none():
                            sd = Subdomain(
                                scan_job_id=job.id,
                                name=line,
                            )
                            session.add(sd)
            
            live_hosts_json = storage_path / "live_hosts.json"
            live_hosts_txt = storage_path / "live_hosts.txt"
            from app.models.subdomain import SubdomainStatus
            from urllib.parse import urlparse
            
            live_hosts_set = set()
            
            if live_hosts_json.exists() and live_hosts_json.stat().st_size > 0:
                import json
                with open(live_hosts_json) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            host = json.loads(line)
                            if not isinstance(host, dict):
                                continue
                            
                            url = host.get("url") or host.get("host") or host.get("input")
                            if not url:
                                continue
                            
                            name = urlparse(url).hostname if url.startswith("http") else url
                            if not name:
                                continue
                            
                            live_hosts_set.add(name)
                            
                            subdomain = await session.execute(
                                select(Subdomain).where(
                                    Subdomain.scan_job_id == job.id,
                                    Subdomain.name == name,
                                )
                            )
                            sd = subdomain.scalar_one_or_none()
                            if sd:
                                sd.is_alive = True
                                sd.status_code = host.get("status_code")
                                sd.title = host.get("title")
                                sd.web_server = host.get("webserver")
                                sd.content_length = host.get("content_length")
                                sd.technologies = host.get("tech", [])
                                sd.ips = host.get("a", [])
                                sd.cname = host.get("cname", [None])[0] if host.get("cname") else None
                                sd.probed_at = datetime.now(timezone.utc)
                                sd.status = SubdomainStatus.ALIVE
                        except json.JSONDecodeError as je:
                            logger.warning("live_hosts_json_parse_failed", job_id=job_id, error=str(je), line=line[:200])
                            continue
            elif live_hosts_txt.exists():
                with open(live_hosts_txt) as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        name = urlparse(line).hostname if line.startswith("http") else line
                        live_hosts_set.add(name)
                        subdomain = await session.execute(
                            select(Subdomain).where(
                                Subdomain.scan_job_id == job.id,
                                Subdomain.name == name,
                            )
                        )
                        sd = subdomain.scalar_one_or_none()
                        if sd:
                            sd.is_alive = True
                            sd.probed_at = datetime.now(timezone.utc)
                            sd.status = SubdomainStatus.ALIVE
            
            all_subdomains = await session.execute(
                select(Subdomain).where(Subdomain.scan_job_id == job.id)
            )
            for sd in all_subdomains.scalars().all():
                if sd.name not in live_hosts_set:
                    sd.is_alive = False
                    sd.status = SubdomainStatus.DEAD
            
            source_file_mapping = [
                ("endpoints_crawl.txt", EndpointSource.CRAWL),
                ("endpoints_hidden.txt", EndpointSource.JS_MINING),
                ("endpoints_api.txt", EndpointSource.JS_MINING),
            ]
            seen_endpoint_urls = set()
            from urllib.parse import urlparse
            
            for filename, source in source_file_mapping:
                source_path = storage_path / filename
                if source_path.exists():
                    lines = source_path.read_text(encoding="utf-8", errors="ignore").split('\n')
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        normalized = line.rstrip('/')
                        if normalized in seen_endpoint_urls:
                            continue
                        seen_endpoint_urls.add(normalized)
                        existing = await session.execute(
                            select(Endpoint).where(
                                Endpoint.scan_job_id == job.id,
                                Endpoint.normalized_url == normalized,
                            )
                        )
                        if not existing.scalar_one_or_none():
                            parsed = urlparse(line)
                            ep = Endpoint(
                                scan_job_id=job.id,
                                url=line,
                                normalized_url=normalized,
                                path=parsed.path or "/",
                                source=source.value,
                            )
                            session.add(ep)

            endpoints_file = storage_path / "endpoints_merged.txt"
            if endpoints_file.exists():
                lines = endpoints_file.read_text(encoding="utf-8", errors="ignore").split('\n')
                for line in lines:
                    line = line.strip()
                    if line:
                        normalized = line.rstrip('/')
                        if normalized in seen_endpoint_urls:
                            continue
                        seen_endpoint_urls.add(normalized)
                        existing = await session.execute(
                            select(Endpoint).where(
                                Endpoint.scan_job_id == job.id,
                                Endpoint.normalized_url == normalized,
                            )
                        )
                        if not existing.scalar_one_or_none():
                            parsed = urlparse(line)
                            ep = Endpoint(
                                scan_job_id=job.id,
                                url=line,
                                normalized_url=normalized,
                                path=parsed.path or "/",
                                source=EndpointSource.RECONSTRUCTED.value,
                            )
                            session.add(ep)
            
            nuclei_file = storage_path / "nuclei_results.json"
            if nuclei_file.exists():
                import json
                with open(nuclei_file) as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                v = json.loads(line)
                                info = v.get("info", {}) or {}
                                vuln = Vulnerability(
                                    scan_job_id=job.id,
                                    template_id=v.get("template-id", "unknown"),
                                    name=info.get("name", "Unknown Vulnerability"),
                                    severity=VulnerabilitySeverity(info.get("severity", "info").lower()),
                                    url=v.get("host", v.get("url", "")),
                                    matched_at=v.get("matched-at", ""),
                                    extracted_results=v,
                                    description=info.get("description"),
                                    remediation=info.get("remediation"),
                                    references=info.get("reference", "").split(",") if info.get("reference") else [],
                                    tags=info.get("tags", []),
                                    cvss_score=info.get("cvss-score"),
                                )
                                session.add(vuln)
                            except Exception as parse_err:
                                logger.warning("nuclei_result_parse_failed", job_id=job_id, error=str(parse_err), line=line[:200])
                                continue
            
            insights_file = storage_path / "ai_insights.json"
            if insights_file.exists():
                import json
                with open(insights_file) as f:
                    insights_data = json.load(f)
                if isinstance(insights_data, list):
                    await save_insights_to_db(job.id, insights_data)
            
            await session.commit()
            
    except Exception as e:
        logger.error("save_results_failed", job_id=job_id, error=str(e))


@celery_app.task(name="execute_vuln_scan_full", bind=True, max_retries=2, default_retry_delay=30)
def execute_vuln_scan_full(self, job_id: str):
    result = execute_scan_stage(job_id, PipelineStage.VULN_SCAN.value)
    if result.get("success"):
        run_async(_save_results_to_db(job_id))
        run_async(_finalize_job(job_id, ScanStatus.COMPLETED))
        run_async(_emit_pipeline_event(job_id, "pipeline_completed", {}))
    else:
        run_async(_finalize_job(job_id, ScanStatus.PARTIAL, result.get("error")))
    return result


@celery_app.task(name="cleanup_expired_jobs", bind=True)
def cleanup_expired_jobs(self):
    from datetime import timedelta
    
    async def _cleanup():
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.JOB_RETENTION_DAYS)
        async with async_session_factory() as session:
            result = await session.execute(
                select(ScanJob).where(
                    ScanJob.created_at < cutoff,
                    ScanJob.status.in_([ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELLED]),
                )
            )
            jobs = result.scalars().all()
            for job in jobs:
                await session.delete(job)
            await session.commit()
            logger.info("cleanup_completed", jobs_removed=len(jobs))
    
    run_async(_cleanup())