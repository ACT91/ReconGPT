from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.job import Job, JobStatus
from app.schemas.scan import ScanRequest, ScanResponse, JobResponse
from app.tasks.scan_tasks import execute_full_pipeline

router = APIRouter()

@router.post("/start", response_model=ScanResponse)
def start_scan(request: ScanRequest, db: Session = Depends(get_db)):
    job_id = str(uuid.uuid4())
    
    job = Job(
        id=job_id,
        user_id=request.user_id,
        project_id=request.project_id,
        target_domain=request.target_domain,
        status=JobStatus.QUEUED,
        created_at=datetime.utcnow()
    )
    
    db.add(job)
    db.commit()
    
    # Queue pipeline execution
    execute_full_pipeline.delay(job_id)
    
    return ScanResponse(
        job_id=job_id,
        status=job.status.value,
        message=f"Scan queued for {request.target_domain}"
    )

@router.get("/{job_id}", response_model=JobResponse)
def get_scan_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobResponse(
        id=job.id,
        target_domain=job.target_domain,
        status=job.status.value,
        current_stage=job.current_stage.value if job.current_stage else None,
        progress_percent=job.progress_percent,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message
    )

@router.get("/{job_id}/logs")
def get_scan_logs(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {"job_id": job_id, "logs": job.logs}
