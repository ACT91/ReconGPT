from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, or_, and_
from sqlalchemy.orm import selectinload, joinedload
from app.models.job import ScanJob, ScanStatus, PipelineStage, STAGE_ORDER, STAGE_PROGRESS
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint
from app.models.vulnerability import Vulnerability, VulnerabilitySeverity
from app.models.js_file import JsFile
from app.models.ai_insight import AiInsight
from app.models.pipeline_log import PipelineLog
from app.schemas.scan import (
    ScanJobResponse,
    ScanProgressResponse,
    ScanStageProgress,
    ScanLogsResponse,
    ScanLogEntry,
)
from app.schemas.common import PaginationParams, parse_sort_param
from app.core.logger import get_logger
from app.core.security_middleware import validate_domain, sanitize_domain
from app.core.exceptions import DomainValidationException, StorageException


logger = get_logger(__name__)


class ScanService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_scan_job(
        self,
        user_id: UUID,
        target_domain: str,
        project_id: Optional[UUID] = None,
        scan_config: Optional[Dict[str, Any]] = None,
    ) -> ScanJob:
        sanitized_domain = sanitize_domain(target_domain)
        if not validate_domain(sanitized_domain):
            raise DomainValidationException(
                message="Domain not allowed",
                detail=f"Domain '{target_domain}' is not in the allowed list or is invalid",
                domain=target_domain,
            )
        
        target_domain = sanitized_domain
        
        job = ScanJob(
            owner_id=user_id,
            project_id=project_id,
            target_domain=target_domain,
            status=ScanStatus.QUEUED,
            scan_config=scan_config or {},
            scan_metadata={},
        )
        
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        
        return job

    async def get_scan_job(self, job_id: UUID, user_id: UUID) -> Optional[ScanJob]:
        result = await self.db.execute(
            select(ScanJob)
            .where(ScanJob.id == job_id, ScanJob.owner_id == user_id)
            .options(
                selectinload(ScanJob.subdomains),
                selectinload(ScanJob.vulnerabilities),
                selectinload(ScanJob.endpoints),
                selectinload(ScanJob.js_files),
                selectinload(ScanJob.ai_insights),
            )
        )
        return result.scalar_one_or_none()

    async def list_user_scans(
        self,
        user_id: UUID,
        project_id: Optional[UUID] = None,
        status: Optional[ScanStatus] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[ScanJob], int]:
        query = select(ScanJob).where(ScanJob.owner_id == user_id)
        
        if project_id:
            query = query.where(ScanJob.project_id == project_id)
        if status:
            query = query.where(ScanJob.status == status)
        if pagination and pagination.search:
            search_term = f"%{pagination.search.lower()}%"
            query = query.where(ScanJob.target_domain.ilike(search_term))
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        if pagination and pagination.sort:
            field, direction = parse_sort_param(pagination.sort, "created_at", "desc")
            sort_field = getattr(ScanJob, field, ScanJob.created_at)
            order_fn = asc if direction == "asc" else desc
            query = query.order_by(order_fn(sort_field))
        else:
            query = query.order_by(desc(ScanJob.created_at))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
        
        result = await self.db.execute(query)
        jobs = result.scalars().all()
        
        return list(jobs), total

    async def get_job_progress(self, job: ScanJob) -> ScanProgressResponse:
        config = job.scan_config or {}
        skip_map = {
            PipelineStage.VULN_SCAN: "vuln_scan",
        }
        stages = []
        for stage in STAGE_ORDER:
            config_key = skip_map.get(stage)
            if config_key and not config.get(config_key, True):
                continue
            stage_result = await self._get_stage_progress(job.id, stage)
            stages.append(stage_result)
        
        return ScanProgressResponse(
            job_id=job.id,
            target_domain=job.target_domain,
            status=job.status,
            overall_progress=job.progress_percent,
            current_stage=job.current_stage,
            stages=stages,
        )

    async def _get_stage_progress(self, job_id: UUID, stage: PipelineStage) -> ScanStageProgress:
        result = await self.db.execute(
            select(PipelineLog)
            .where(
                PipelineLog.scan_job_id == job_id,
                PipelineLog.stage == stage,
            )
            .order_by(asc(PipelineLog.timestamp))
        )
        logs = result.scalars().all()
        
        started_at = None
        completed_at = None
        error = None
        
        for log in logs:
            if log.level == "info" and "started" in log.message.lower():
                started_at = log.timestamp
            elif log.level in ["error", "critical"]:
                error = log.message
                if not completed_at:
                    completed_at = log.timestamp
            elif log.level == "info" and "completed" in log.message.lower():
                completed_at = log.timestamp
        
        progress = STAGE_PROGRESS.get(stage, 0)
        
        is_started = started_at is not None
        if error:
            status = ScanStatus.FAILED
        elif completed_at:
            status = ScanStatus.COMPLETED
        elif is_started:
            status = ScanStatus.RUNNING
        else:
            status = ScanStatus.PENDING

        return ScanStageProgress(
            stage=stage,
            status=status,
            progress=progress,
            started_at=started_at,
            completed_at=completed_at,
            error=error,
        )

    async def get_job_logs(
        self,
        job_id: UUID,
        stage: Optional[PipelineStage] = None,
        level: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> ScanLogsResponse:
        query = select(PipelineLog).where(PipelineLog.scan_job_id == job_id)
        
        if stage:
            query = query.where(PipelineLog.stage == stage)
        if level:
            query = query.where(PipelineLog.level == level)
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.order_by(desc(PipelineLog.timestamp))
        
        if pagination:
            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
        
        result = await self.db.execute(query)
        logs = result.scalars().all()
        
        page_size = pagination.page_size if pagination else 50
        page = pagination.page if pagination else 1
        return ScanLogsResponse(
            items=[ScanLogEntry(
                timestamp=log.timestamp,
                level=log.level.value if log.level else None,
                message=log.message,
                stage=log.stage if log.stage else None,
                details=log.details,
            ) for log in logs],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size if page_size else 1,
            has_more=(page * page_size) < total if pagination else False,
        )

    async def get_scan_results(self, job_id: UUID) -> Dict[str, Any]:
        subdomains = await self.db.execute(
            select(Subdomain).where(Subdomain.scan_job_id == job_id).order_by(Subdomain.name)
        )
        endpoints = await self.db.execute(
            select(Endpoint).where(Endpoint.scan_job_id == job_id).order_by(Endpoint.url)
        )
        vulnerabilities = await self.db.execute(
            select(Vulnerability).where(Vulnerability.scan_job_id == job_id).order_by(desc(Vulnerability.severity))
        )
        js_files = await self.db.execute(
            select(JsFile).where(JsFile.scan_job_id == job_id)
        )
        insights = await self.db.execute(
            select(AiInsight).where(AiInsight.scan_job_id == job_id).order_by(desc(AiInsight.priority_score))
        )
        
        vuln_list = vulnerabilities.scalars().all()
        
        return {
            "subdomains": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "is_alive": s.is_alive,
                    "status_code": s.status_code,
                    "technologies": s.technologies,
                    "title": s.title,
                    "web_server": s.web_server,
                    "ips": s.ips,
                    "cname": s.cname,
                }
                for s in subdomains.scalars().all()
            ],
            "endpoints": [
                {
                    "id": str(e.id),
                    "url": e.url,
                    "method": e.method,
                    "status_code": e.status_code,
                    "content_type": e.content_type,
                    "title": e.title,
                    "status": e.status.value if e.status else None,
                    "source": e.source.value if e.source else None,
                }
                for e in endpoints.scalars().all()
            ],
            "vulnerabilities": [
                {
                    "id": str(v.id),
                    "name": v.name,
                    "template_id": v.template_id,
                    "severity": v.severity.value,
                    "url": v.url,
                    "description": v.description,
                    "remediation": v.remediation,
                    "cve_ids": v.cve_ids,
                    "cwe_ids": v.cwe_ids,
                    "cvss_score": v.cvss_score,
                    "matched_at": v.matched_at,
                }
                for v in vuln_list
            ],
            "js_files": [
                {
                    "id": str(j.id),
                    "url": j.url,
                    "downloaded": j.downloaded,
                    "analyzed": j.analyzed,
                    "size_bytes": j.size_bytes,
                    "endpoints_found": j.endpoints_found,
                    "secrets_found": j.secrets_found,
                }
                for j in js_files.scalars().all()
            ],
            "insights": [
                {
                    "id": str(i.id),
                    "type": i.insight_type.value,
                    "priority": i.priority.value,
                    "title": i.title,
                    "summary": i.summary,
                    "priority_score": i.priority_score,
                }
                for i in insights.scalars().all()
            ],
            "stats": {
                "total_subdomains": len(subdomains.scalars().all()),
                "alive_subdomains": sum(1 for s in subdomains.scalars().all() if s.is_alive),
                "total_endpoints": len(endpoints.scalars().all()),
                "total_vulnerabilities": len(vuln_list),
                "vulnerabilities_by_severity": {
                    "critical": sum(1 for v in vuln_list if v.severity == VulnerabilitySeverity.CRITICAL),
                    "high": sum(1 for v in vuln_list if v.severity == VulnerabilitySeverity.HIGH),
                    "medium": sum(1 for v in vuln_list if v.severity == VulnerabilitySeverity.MEDIUM),
                    "low": sum(1 for v in vuln_list if v.severity == VulnerabilitySeverity.LOW),
                    "info": sum(1 for v in vuln_list if v.severity == VulnerabilitySeverity.INFO),
                },
            },
        }

    async def get_job_subdomains(
        self, job_id: UUID, pagination: PaginationParams
    ) -> Tuple[List[dict], int]:
        query = select(Subdomain).where(Subdomain.scan_job_id == job_id)
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.order_by(Subdomain.name).offset(
            (pagination.page - 1) * pagination.page_size
        ).limit(pagination.page_size)
        
        result = await self.db.execute(query)
        subdomains = result.scalars().all()
        
        items = [
            {
                "id": str(s.id),
                "name": s.name,
                "is_alive": s.is_alive,
                "status_code": s.status_code,
                "technologies": s.technologies,
                "title": s.title,
                "web_server": s.web_server,
                "ips": s.ips,
                "cname": s.cname,
                "content_length": s.content_length,
                "discovered_at": s.discovered_at.isoformat() if s.discovered_at else None,
            }
            for s in subdomains
        ]
        
        return items, total

    async def get_job_vulnerabilities(
        self, job_id: UUID, pagination: PaginationParams, severity: Optional[str] = None
    ) -> Tuple[List[dict], int]:
        query = select(Vulnerability).where(Vulnerability.scan_job_id == job_id)
        
        if severity:
            query = query.where(Vulnerability.severity == severity)
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.order_by(desc(Vulnerability.severity)).offset(
            (pagination.page - 1) * pagination.page_size
        ).limit(pagination.page_size)
        
        result = await self.db.execute(query)
        vulns = result.scalars().all()
        
        items = [
            {
                "id": str(v.id),
                "name": v.name,
                "template_id": v.template_id,
                "severity": v.severity.value,
                "url": v.url,
                "description": v.description,
                "remediation": v.remediation,
                "cve_ids": v.cve_ids,
                "cwe_ids": v.cwe_ids,
                "cvss_score": v.cvss_score,
                "matched_at": v.matched_at,
                "discovered_at": v.discovered_at.isoformat() if v.discovered_at else None,
            }
            for v in vulns
        ]
        
        return items, total

    async def cancel_scan_job(self, job: ScanJob) -> bool:
        from app.tasks.celery_app import celery_app
        
        job.status = ScanStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)
        
        if job.celery_task_id:
            celery_app.control.revoke(job.celery_task_id, terminate=True)
        
        await self.db.commit()
        return True

    async def delete_scan_job(self, job_id: UUID, user_id: UUID) -> bool:
        job = await self.get_scan_job(job_id, user_id)
        if not job:
            return False
        await self.db.delete(job)
        await self.db.commit()
        logger.info("scan_deleted", user_id=str(user_id), job_id=str(job_id))
        return True

    async def retry_scan_job(self, old_job: ScanJob) -> ScanJob:
        new_job = ScanJob(
            owner_id=old_job.owner_id,
            project_id=old_job.project_id,
            target_domain=old_job.target_domain,
            status=ScanStatus.QUEUED,
            scan_config=old_job.scan_config,
        )
        
        self.db.add(new_job)
        await self.db.commit()
        await self.db.refresh(new_job)
        
        return new_job

    async def get_job_storage_size(self, job_id: UUID) -> int:
        from pathlib import Path
        storage_path = Path(settings.STORAGE_PATH) / str(job_id)
        if not storage_path.exists():
            return 0
        total = 0
        for f in storage_path.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
        return total

    async def enforce_job_storage_limit(self, job_id: UUID) -> bool:
        size_bytes = await self.get_job_storage_size(job_id)
        max_bytes = settings.MAX_STORAGE_PER_JOB_GB * 1024 * 1024 * 1024
        if size_bytes > max_bytes:
            from app.core.exceptions import StorageException
            raise StorageException(
                message="Storage limit exceeded",
                detail=f"Job storage of {size_bytes / (1024**3):.2f} GB exceeds limit of {settings.MAX_STORAGE_PER_JOB_GB} GB",
            )
        return True