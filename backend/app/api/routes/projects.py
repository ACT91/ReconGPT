from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from app.core.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.job import ScanJob, ScanStatus
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint
from app.models.vulnerability import Vulnerability, VulnerabilitySeverity
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectStatsResponse,
)
from app.schemas.common import PaginationParams
from app.api.deps import get_current_user, get_current_active_user, rate_limit
from app.core.logger import get_logger


logger = get_logger(__name__)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    project = Project(
        owner_id=current_user.id,
        name=project_data.name,
        description=project_data.description,
        target_domains=project_data.target_domains,
        settings={},
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    logger.info("project_created", user_id=str(current_user.id), project_id=str(project.id))
    return project


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    pagination: PaginationParams = Depends(),
    is_active: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    query = select(Project).where(Project.owner_id == current_user.id)
    
    if is_active:
        query = query.where(Project.is_active == is_active)
    
    query = query.order_by(desc(Project.created_at))
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    result = await db.execute(query)
    projects = result.scalars().all()
    
    return ProjectListResponse(
        items=projects,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    return project


@router.get("/{project_id}/stats", response_model=ProjectStatsResponse)
async def get_project_stats(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    project = await db.get(Project, project_id)
    if not project or project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    scan_jobs = await db.execute(
        select(ScanJob).where(ScanJob.project_id == project_id)
    )
    jobs = scan_jobs.scalars().all()
    
    job_ids = [j.id for j in jobs]
    
    stats = {
        "total_scans": len(jobs),
        "completed_scans": sum(1 for j in jobs if j.status == ScanStatus.COMPLETED),
        "failed_scans": sum(1 for j in jobs if j.status == ScanStatus.FAILED),
        "running_scans": sum(1 for j in jobs if j.status in [ScanStatus.RUNNING, ScanStatus.QUEUED]),
    }
    
    if job_ids:
        subdomains_result = await db.execute(
            select(func.count(Subdomain.id)).where(Subdomain.scan_job_id.in_(job_ids))
        )
        stats["total_subdomains"] = subdomains_result.scalar() or 0
        
        endpoints_result = await db.execute(
            select(func.count(Endpoint.id)).where(Endpoint.scan_job_id.in_(job_ids))
        )
        stats["total_endpoints"] = endpoints_result.scalar() or 0
        
        vulns_result = await db.execute(
            select(Vulnerability.severity, func.count(Vulnerability.id))
            .where(Vulnerability.scan_job_id.in_(job_ids))
            .group_by(Vulnerability.severity)
        )
        vuln_counts = {v.value: 0 for v in VulnerabilitySeverity}
        for severity, count in vulns_result.all():
            vuln_counts[severity.value] = count
        
        stats["total_vulnerabilities"] = sum(vuln_counts.values())
        stats["critical_vulns"] = vuln_counts.get("critical", 0)
        stats["high_vulns"] = vuln_counts.get("high", 0)
        stats["medium_vulns"] = vuln_counts.get("medium", 0)
        stats["low_vulns"] = vuln_counts.get("low", 0)
    else:
        stats.update({
            "total_subdomains": 0,
            "total_endpoints": 0,
            "total_vulnerabilities": 0,
            "critical_vulns": 0,
            "high_vulns": 0,
            "medium_vulns": 0,
            "low_vulns": 0,
        })
    
    return ProjectStatsResponse(**stats)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
    
    logger.info("project_updated", user_id=str(current_user.id), project_id=str(project_id))
    return project


@router.delete("/{project_id}", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == current_user.id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    
    await db.delete(project)
    await db.commit()
    
    logger.info("project_deleted", user_id=str(current_user.id), project_id=str(project_id))
    return {"message": "Project deleted successfully"}