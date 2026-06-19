from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, or_, and_, case
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.user import User
from app.models.job import ScanJob, ScanStatus, PipelineStage
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint, EndpointSource
from app.models.vulnerability import Vulnerability, VulnerabilitySeverity
from app.models.ai_insight import AiInsight, InsightType, InsightPriority
from app.schemas.common import PaginationParams, parse_sort_param
from app.api.deps import get_current_user, get_current_active_user, rate_limit
from app.core.logger import get_logger


logger = get_logger(__name__)

router = APIRouter(prefix="/data", tags=["Data"])


async def _get_user_job_ids(db: AsyncSession, user_id: UUID, project_id: Optional[UUID] = None) -> List[UUID]:
    query = select(ScanJob.id).where(ScanJob.owner_id == user_id)
    if project_id:
        query = query.where(ScanJob.project_id == project_id)
    result = await db.execute(query)
    return [row[0] for row in result.fetchall()]


@router.get("/subdomains")
async def list_subdomains(
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[UUID] = Query(None),
    scan_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by alive status: alive, dead, all"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    if scan_id:
        job_ids = [scan_id]
    else:
        job_ids = await _get_user_job_ids(db, current_user.id, project_id)

    if not job_ids:
        return {"items": [], "total": 0, "page": pagination.page, "page_size": pagination.page_size, "total_pages": 0}

    query = select(Subdomain).where(Subdomain.scan_job_id.in_(job_ids))

    if search:
        q = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Subdomain.name).like(q),
                func.lower(Subdomain.title).like(q),
                func.lower(Subdomain.web_server).like(q),
            )
        )

    if status == "alive":
        query = query.where(Subdomain.is_alive.is_(True))
    elif status == "dead":
        query = query.where(
            or_(Subdomain.is_alive.is_(False), Subdomain.is_alive.is_(None))
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Subdomain.name)
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    items = []
    for s in result.scalars().all():
        items.append({
            "id": str(s.id),
            "scan_job_id": str(s.scan_job_id),
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
        })

    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size if pagination.page_size else 1,
    }


@router.get("/endpoints")
async def list_endpoints(
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[UUID] = Query(None),
    scan_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    if scan_id:
        job_ids = [scan_id]
    else:
        job_ids = await _get_user_job_ids(db, current_user.id, project_id)

    if not job_ids:
        return {"items": [], "total": 0, "page": pagination.page, "page_size": pagination.page_size, "total_pages": 0}

    query = select(Endpoint).where(Endpoint.scan_job_id.in_(job_ids))

    if search:
        q = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Endpoint.url).like(q),
                func.lower(Endpoint.path).like(q),
                func.lower(Endpoint.method).like(q),
            )
        )

    if source:
        query = query.where(Endpoint.source == source)

    if method:
        query = query.where(func.lower(Endpoint.method) == method.lower())

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Endpoint.url)
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    items = []
    for e in result.scalars().all():
        items.append({
            "id": str(e.id),
            "scan_job_id": str(e.scan_job_id),
            "subdomain_id": str(e.subdomain_id) if e.subdomain_id else None,
            "url": e.url,
            "normalized_url": e.normalized_url,
            "path": e.path,
            "method": e.method,
            "source": e.source.value if e.source else None,
            "status_code": e.status_code,
            "content_type": e.content_type,
            "content_length": e.content_length,
            "title": e.title,
            "technologies": e.technologies,
            "response_time_ms": e.response_time_ms,
            "discovered_at": e.discovered_at.isoformat() if e.discovered_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size if pagination.page_size else 1,
    }


@router.get("/vulnerabilities")
async def list_vulnerabilities(
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[UUID] = Query(None),
    scan_id: Optional[UUID] = Query(None),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    is_false_positive: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    if scan_id:
        job_ids = [scan_id]
    else:
        job_ids = await _get_user_job_ids(db, current_user.id, project_id)

    if not job_ids:
        return {"items": [], "total": 0, "page": pagination.page, "page_size": pagination.page_size, "total_pages": 0}

    query = select(Vulnerability).where(Vulnerability.scan_job_id.in_(job_ids))

    if severity:
        query = query.where(Vulnerability.severity == severity)

    if search:
        q = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Vulnerability.name).like(q),
                func.lower(Vulnerability.url).like(q),
                func.lower(Vulnerability.template_id).like(q),
            )
        )

    if is_false_positive is not None:
        query = query.where(Vulnerability.is_false_positive.is_(is_false_positive))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(desc(Vulnerability.severity))
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    items = []
    for v in result.scalars().all():
        items.append({
            "id": str(v.id),
            "scan_job_id": str(v.scan_job_id),
            "endpoint_id": str(v.endpoint_id) if v.endpoint_id else None,
            "name": v.name,
            "template_id": v.template_id,
            "severity": v.severity.value,
            "url": v.url,
            "description": v.description,
            "remediation": v.remediation,
            "cve_ids": v.cve_ids,
            "cwe_ids": v.cwe_ids,
            "cvss_score": v.cvss_score,
            "cvss_vector": v.cvss_vector,
            "matched_at": v.matched_at,
            "is_false_positive": bool(v.is_false_positive),
            "discovered_at": v.discovered_at.isoformat() if v.discovered_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size if pagination.page_size else 1,
    }


@router.get("/insights")
async def list_insights(
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[UUID] = Query(None),
    scan_id: Optional[UUID] = Query(None),
    insight_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    actionable_only: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    if scan_id:
        job_ids = [scan_id]
    else:
        job_ids = await _get_user_job_ids(db, current_user.id, project_id)

    if not job_ids:
        return {"items": [], "total": 0, "page": pagination.page, "page_size": pagination.page_size, "total_pages": 0}

    query = select(AiInsight).where(AiInsight.scan_job_id.in_(job_ids))

    if insight_type:
        query = query.where(AiInsight.insight_type == insight_type)

    if priority:
        query = query.where(AiInsight.priority == priority)

    if actionable_only:
        query = query.where(AiInsight.is_actionable.is_(True))

    if search:
        q = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(AiInsight.title).like(q),
                func.lower(AiInsight.summary).like(q),
                func.lower(AiInsight.content).like(q),
            )
        )

    query = query.where(AiInsight.is_dismissed.is_(False))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(desc(AiInsight.priority_score))
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

    result = await db.execute(query)
    items = []
    for i in result.scalars().all():
        items.append({
            "id": str(i.id),
            "scan_job_id": str(i.scan_job_id),
            "type": i.insight_type.value,
            "priority": i.priority.value,
            "priority_score": i.priority_score,
            "title": i.title,
            "summary": i.summary,
            "content": i.content,
            "is_actionable": i.is_actionable,
            "is_dismissed": i.is_dismissed,
            "affected_assets": i.affected_assets,
            "related_vulnerabilities": i.related_vulnerabilities,
            "related_subdomains": i.related_subdomains,
            "related_endpoints": i.related_endpoints,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "total_pages": (total + pagination.page_size - 1) // pagination.page_size if pagination.page_size else 1,
    }


@router.get("/stats")
async def get_global_stats(
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    job_ids = await _get_user_job_ids(db, current_user.id, project_id)

    if not job_ids:
        return {
            "total_scans": 0,
            "total_subdomains": 0,
            "total_endpoints": 0,
            "total_vulnerabilities": 0,
            "total_insights": 0,
            "vulnerabilities_by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
        }

    sd_count = await db.execute(
        select(func.count(Subdomain.id)).where(Subdomain.scan_job_id.in_(job_ids))
    )
    ep_count = await db.execute(
        select(func.count(Endpoint.id)).where(Endpoint.scan_job_id.in_(job_ids))
    )
    vuln_count = await db.execute(
        select(func.count(Vulnerability.id)).where(Vulnerability.scan_job_id.in_(job_ids))
    )
    insight_count = await db.execute(
        select(func.count(AiInsight.id)).where(
            AiInsight.scan_job_id.in_(job_ids),
            AiInsight.is_dismissed.is_(False),
        )
    )
    scan_count = await db.execute(
        select(func.count(ScanJob.id)).where(ScanJob.id.in_(job_ids))
    )

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    sev_result = await db.execute(
        select(Vulnerability.severity, func.count(Vulnerability.id)).where(
            Vulnerability.scan_job_id.in_(job_ids)
        ).group_by(Vulnerability.severity)
    )
    for sev, count in sev_result.fetchall():
        if sev and sev.value in severity_counts:
            severity_counts[sev.value] = count

    return {
        "total_scans": scan_count.scalar() or 0,
        "total_subdomains": sd_count.scalar() or 0,
        "total_endpoints": ep_count.scalar() or 0,
        "total_vulnerabilities": vuln_count.scalar() or 0,
        "total_insights": insight_count.scalar() or 0,
        "vulnerabilities_by_severity": severity_counts,
    }
