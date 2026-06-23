import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, text
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.job import ScanJob, ScanStatus
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint
from app.models.vulnerability import Vulnerability
from app.models.ai_insight import AiInsight
from app.api.deps import get_current_active_user, rate_limit
from app.core.logger import get_logger


logger = get_logger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


async def _count_assets(db: AsyncSession, subquery):
    sd = (await db.execute(select(func.count(Subdomain.id)).where(Subdomain.scan_job_id.in_(subquery)))).scalar() or 0
    ep = (await db.execute(select(func.count(Endpoint.id)).where(Endpoint.scan_job_id.in_(subquery)))).scalar() or 0
    return sd, ep


async def _get_vuln_stats(db: AsyncSession, subquery):
    total = (await db.execute(select(func.count(Vulnerability.id)).where(Vulnerability.scan_job_id.in_(subquery)))).scalar() or 0
    rows = await db.execute(
        select(Vulnerability.severity, func.count(Vulnerability.id))
        .where(Vulnerability.scan_job_id.in_(subquery))
        .group_by(Vulnerability.severity)
    )
    by_severity = {r[0].value if hasattr(r[0], 'value') else r[0]: r[1] for r in rows.all()}
    return total, by_severity


async def _get_recent_findings(db: AsyncSession, subquery):
    result = await db.execute(
        select(Vulnerability).where(Vulnerability.scan_job_id.in_(subquery))
        .order_by(desc(Vulnerability.discovered_at)).limit(5)
    )
    return [{
        "id": str(v.id), "name": v.name,
        "severity": v.severity.value if hasattr(v.severity, 'value') else v.severity,
        "url": v.url,
        "discovered_at": v.discovered_at.isoformat() if v.discovered_at else None,
    } for v in result.scalars().all()]


async def _get_active_scans(db: AsyncSession, user_id: UUID):
    result = await db.execute(
        select(ScanJob).where(ScanJob.owner_id == user_id, text("status IN ('RUNNING', 'QUEUED')"))
        .order_by(desc(ScanJob.created_at)).limit(5)
    )
    return [{
        "id": str(s.id), "target_domain": s.target_domain,
        "status": s.status.value if hasattr(s.status, 'value') else s.status,
        "progress_percent": s.progress_percent or 0,
        "current_stage": re.sub(r'^\d+_', '', s.current_stage.value).replace('_', ' ').title() if s.current_stage else None,
        "created_at": s.created_at.isoformat(),
    } for s in result.scalars().all()]


@router.get("/")
async def get_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    user_job_ids = select(ScanJob.id).where(ScanJob.owner_id == current_user.id)

    scans_count = await db.execute(
        select(ScanJob.status, func.count(ScanJob.id))
        .where(ScanJob.owner_id == current_user.id).group_by(ScanJob.status)
    )
    status_counts = {r[0].value if hasattr(r[0], 'value') else r[0]: r[1] for r in scans_count.all()}

    total_subdomains, total_endpoints = await _count_assets(db, user_job_ids)
    total_vulns, vulns_by_severity = await _get_vuln_stats(db, user_job_ids)
    recent_findings = await _get_recent_findings(db, user_job_ids)
    active_scans = await _get_active_scans(db, current_user.id)

    return {
        "scans": {
            "total": sum(status_counts.values()),
            "running": status_counts.get("running", 0),
            "queued": status_counts.get("queued", 0),
            "completed": status_counts.get("completed", 0),
            "failed": status_counts.get("failed", 0),
        },
        "assets": {"total_subdomains": total_subdomains, "total_endpoints": total_endpoints},
        "vulnerabilities": {"total": total_vulns, "by_severity": vulns_by_severity},
        "recent_findings": recent_findings,
        "active_scans": active_scans,
    }
