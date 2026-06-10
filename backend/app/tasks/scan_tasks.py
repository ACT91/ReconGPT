from pathlib import Path
from app.tasks.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.job import Job, JobStatus, PipelineStage
from app.pipeline.stages.01_subfinder import SubfinderStage
from app.pipeline.stages.02_httpx import HttpxProbeStage
from app.pipeline.stages.03_tech import TechDetectStage
from app.pipeline.stages.04_katana import KatanaCrawlStage
from app.pipeline.stages.05_js_extract import JSExtractStage
from app.pipeline.stages.06_endpoint_extract import EndpointExtractStage
from app.pipeline.stages.07_js_download import JSDownloadStage
from app.pipeline.stages.08_js_mining import JSMiningStage
from app.pipeline.stages.09_merge import MergeEndpointsStage
from app.pipeline.stages.10_url_build import URLBuildStage
from app.pipeline.stages.11_httpx_probe import HttpxEndpointStage
from app.pipeline.stages.12_nuclei import NucleiScanStage
from app.pipeline.stages.13_ai_analysis import AIAnalysisStage

STAGE_MAP = {
    PipelineStage.SUBFINDER: SubfinderStage,
    PipelineStage.HTTPX_PROBE: HttpxProbeStage,
    PipelineStage.TECH_DETECT: TechDetectStage,
    PipelineStage.KATANA_CRAWL: KatanaCrawlStage,
    PipelineStage.JS_EXTRACT: JSExtractStage,
    PipelineStage.ENDPOINT_EXTRACT: EndpointExtractStage,
    PipelineStage.JS_DOWNLOAD: JSDownloadStage,
    PipelineStage.JS_MINING: JSMiningStage,
    PipelineStage.MERGE_ENDPOINTS: MergeEndpointsStage,
    PipelineStage.URL_BUILD: URLBuildStage,
    PipelineStage.HTTPX_ENDPOINT: HttpxEndpointStage,
    PipelineStage.NUCLEI_SCAN: NucleiScanStage,
    PipelineStage.AI_ANALYSIS: AIAnalysisStage,
}

@celery_app.task(name="execute_scan_stage")
def execute_scan_stage(job_id: str, stage: str):
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        return {"error": "Job not found"}
    
    try:
        job.current_stage = PipelineStage(stage)
        job.status = JobStatus.RUNNING
        db.commit()
        
        stage_cls = STAGE_MAP.get(PipelineStage(stage))
        if not stage_cls:
            raise ValueError(f"Unknown stage: {stage}")
        
        stage_instance = stage_cls(
            job_id=job_id,
            target=job.target_domain,
            storage_path=Path(settings.STORAGE_PATH)
        )
        
        result = stage_instance.execute()
        
        if not result.get("success"):
            job.status = JobStatus.FAILED
            job.error_message = result.get("error", "Unknown error")
            db.commit()
            return result
        
        return result
        
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error_message = str(e)
        db.commit()
        return {"error": str(e)}
    finally:
        db.close()

@celery_app.task(name="execute_full_pipeline")
def execute_full_pipeline(job_id: str):
    stages = [
        PipelineStage.SUBFINDER,
        PipelineStage.HTTPX_PROBE,
        PipelineStage.TECH_DETECT,
        PipelineStage.KATANA_CRAWL,
        PipelineStage.JS_EXTRACT,
        PipelineStage.ENDPOINT_EXTRACT,
        PipelineStage.JS_DOWNLOAD,
        PipelineStage.JS_MINING,
        PipelineStage.MERGE_ENDPOINTS,
        PipelineStage.URL_BUILD,
        PipelineStage.HTTPX_ENDPOINT,
        PipelineStage.NUCLEI_SCAN,
        PipelineStage.AI_ANALYSIS
    ]
    
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.started_at = __import__('datetime').datetime.utcnow()
        db.commit()
    db.close()
    
    for idx, stage in enumerate(stages):
        result = execute_scan_stage(job_id, stage.value)
        if not result.get("success"):
            return result
        
        # Update progress
        db = SessionLocal()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.progress_percent = ((idx + 1) / len(stages)) * 100
            db.commit()
        db.close()
    
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if job:
        job.status = JobStatus.COMPLETED
        job.completed_at = __import__('datetime').datetime.utcnow()
        job.progress_percent = 100.0
        db.commit()
    db.close()
    
    return {"success": True}
