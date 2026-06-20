from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.orm import selectinload
from uuid import UUID
import json
from datetime import datetime, timezone
import asyncio

from app.core.database import get_db
from app.models.user import User
from app.models.job import ScanJob, ScanStatus, PipelineStage
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint
from app.models.vulnerability import Vulnerability
from app.models.pipeline_log import PipelineLog
from app.schemas.scan import (
    ScanRequest,
    ScanConfig,
    ScanStartResponse,
    ScanJobResponse,
    ScanJobListResponse,
    ScanJobDetailResponse,
    ScanCancelRequest,
    ScanLogEntry,
    ScanLogsResponse,
    ScanProgressResponse,
    ScanStageProgress,
)
from app.schemas.common import PaginationParams
from app.api.deps import get_current_user, get_current_active_user, get_current_user_ws, rate_limit_scan, rate_limit, check_scan_concurrency, check_scan_quota
from app.tasks.scan_tasks import execute_full_pipeline, execute_vuln_scan_full
from app.services.scan import ScanService
from app.core.logger import get_logger
from app.core.websocket_manager import manager


logger = get_logger(__name__)

router = APIRouter(prefix="/scans", tags=["Scans"])


@router.post("/start", response_model=ScanStartResponse, status_code=status.HTTP_201_CREATED)
async def start_scan(
    request: ScanRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _scan_concurrency: None = Depends(check_scan_concurrency),
    _scan_quota: None = Depends(check_scan_quota),
    _rate_limit: None = Depends(rate_limit_scan),
):
    scan_service = ScanService(db)

    job = await scan_service.create_scan_job(
        user_id=current_user.id,
        target_domain=request.target_domain,
        project_id=request.project_id,
        scan_config=request.config.model_dump() if request.config else {},
    )

    execute_full_pipeline.delay(str(job.id))

    logger.info(
        "scan_started",
        user_id=str(current_user.id),
        job_id=str(job.id),
        target=request.target_domain,
    )

    return ScanStartResponse(
        job_id=job.id,
        status=job.status,
        target_domain=job.target_domain,
        message=f"Scan queued for {request.target_domain}",
    )


@router.get("/{job_id}", response_model=ScanJobDetailResponse)
async def get_scan_status(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    return job


@router.get("/{job_id}/progress", response_model=ScanProgressResponse)
async def get_scan_progress(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    progress = await scan_service.get_job_progress(job)
    return progress


@router.get("/{job_id}/logs", response_model=ScanLogsResponse)
async def get_scan_logs(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    stage: Optional[PipelineStage] = Query(None, description="Filter by pipeline stage"),
    level: Optional[str] = Query(None, description="Filter by log level"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    logs_response = await scan_service.get_job_logs(
        job_id, stage, level, pagination
    )
    return logs_response


@router.get("/{job_id}/logs/stream")
async def stream_scan_logs(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    async def event_stream():
        last_id = None
        while True:
            try:
                async with AsyncSession(db.bind) as stream_db:
                    query = select(PipelineLog).where(
                        PipelineLog.scan_job_id == job_id
                    ).order_by(asc(PipelineLog.timestamp))
                    
                    if last_id:
                        query = query.where(PipelineLog.id > last_id)
                    
                    query = query.limit(50)
                    result = await stream_db.execute(query)
                    logs = result.scalars().all()
                    
                    for log in logs:
                        data = {
                            "stage": log.stage.value if log.stage else None,
                            "level": log.level.value,
                            "message": log.message,
                            "timestamp": log.timestamp.isoformat(),
                            "details": log.details,
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                        last_id = log.id
                    
                    if job.status in [ScanStatus.COMPLETED, ScanStatus.FAILED, ScanStatus.CANCELLED]:
                        yield f"data: {json.dumps({'status': job.status.value, 'message': 'Scan complete'})}\n\n"
                        break
                    
                    await asyncio.sleep(1)
            except Exception:
                yield f"data: {json.dumps({'error': 'Connection error'})}\n\n"
                break
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.websocket("/{job_id}/ws")
async def scan_websocket(
    ws: WebSocket,
    job_id: UUID,
    current_user: Optional[User] = Depends(get_current_user_ws),
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        return

    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)

    if not job:
        await ws.close(code=1008, reason="Scan job not found")
        return

    await manager.connect_job(ws, job_id)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect_job(ws, job_id)


@router.get("/{job_id}/results", response_model=dict)
async def get_scan_results(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    results = await scan_service.get_scan_results(job_id)
    return results


@router.get("/{job_id}/subdomains", response_model=dict)
async def get_scan_subdomains(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    items, total = await scan_service.get_job_subdomains(job_id, pagination)
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size,
    }


@router.get("/{job_id}/vulnerabilities", response_model=dict)
async def get_scan_vulnerabilities(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    pagination: PaginationParams = Depends(),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    items, total = await scan_service.get_job_vulnerabilities(job_id, pagination, severity)
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size,
    }


@router.post("/{job_id}/vuln-scan", response_model=ScanStartResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_vuln_scan(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit_scan),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )

    if job.status not in [ScanStatus.COMPLETED, ScanStatus.PARTIAL, ScanStatus.QUEUED, ScanStatus.RUNNING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run vulnerability scan on a {job.status.value} job",
        )

    job.status = ScanStatus.QUEUED
    await db.commit()

    execute_vuln_scan_full.delay(str(job.id))

    logger.info(
        "vuln_scan_triggered",
        user_id=str(current_user.id),
        job_id=str(job_id),
    )

    return ScanStartResponse(
        job_id=job.id,
        status=job.status,
        target_domain=job.target_domain,
        message="Vulnerability scan queued",
    )


@router.post("/{job_id}/cancel", response_model=dict)
async def cancel_scan(
    job_id: UUID,
    request: ScanCancelRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    if job.status in [ScanStatus.COMPLETED, ScanStatus.CANCELLED, ScanStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scan is already {job.status.value}",
        )
    
    success = await scan_service.cancel_scan_job(job)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel scan",
        )
    
    logger.info(
        "scan_cancelled",
        user_id=str(current_user.id),
        job_id=str(job_id),
        force=request.force,
    )
    
    return {"message": "Scan cancelled successfully", "job_id": str(job_id)}


@router.delete("/{job_id}", response_model=dict)
async def delete_scan(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    success = await scan_service.delete_scan_job(job_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    logger.info(
        "scan_deleted",
        user_id=str(current_user.id),
        job_id=str(job_id),
    )
    return {"message": "Scan deleted successfully"}


@router.post("/{job_id}/retry", response_model=ScanStartResponse)
async def retry_scan(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit_scan),
):
    scan_service = ScanService(db)
    job = await scan_service.get_scan_job(job_id, current_user.id)
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    new_job = await scan_service.retry_scan_job(job)
    
    execute_full_pipeline.delay(str(new_job.id))
    
    logger.info(
        "scan_retried",
        user_id=str(current_user.id),
        original_job=str(job_id),
        new_job=str(new_job.id),
    )
    
    return ScanStartResponse(
        job_id=new_job.id,
        status=new_job.status,
        target_domain=job.target_domain,
        message=f"Scan retry queued for {job.target_domain}",
    )


@router.get("", response_model=ScanJobListResponse)
async def list_scans(
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[UUID] = Query(None, description="Filter by project"),
    status: Optional[ScanStatus] = Query(None, description="Filter by status"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    scan_service = ScanService(db)
    jobs, total = await scan_service.list_user_scans(
        current_user.id,
        project_id,
        status,
        pagination,
    )
    
    return ScanJobListResponse(
        items=jobs,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )