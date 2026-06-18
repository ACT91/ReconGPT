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


@router.get("/")
async def get_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    user_id = current_user.id

    scans_count = await db.execute(
        select(
            ScanJob.status,
            func.count(ScanJob.id),
        ).where(
            ScanJob.owner_id == user_id,
        ).group_by(ScanJob.status)
    )
    status_counts = {row[0].value if hasattr(row[0], 'value') else row[0]: row[1] for row in scans_count.all()}

    sub_count = await db.execute(
        select(func.count(Subdomain.id)).where(
            Subdomain.scan_job_id.in_(
                select(ScanJob.id).where(ScanJob.owner_id == user_id)
            )
        )
    )
    total_subdomains = sub_count.scalar() or 0

    ep_count = await db.execute(
        select(func.count(Endpoint.id)).where(
            Endpoint.scan_job_id.in_(
                select(ScanJob.id).where(ScanJob.owner_id == user_id)
            )
        )
    )
    total_endpoints = ep_count.scalar() or 0

    vuln_total = await db.execute(
        select(func.count(Vulnerability.id)).where(
            Vulnerability.scan_job_id.in_(
                select(ScanJob.id).where(ScanJob.owner_id == user_id)
            )
        )
    )
    total_vulns = vuln_total.scalar() or 0

    vuln_severity_rows = await db.execute(
        select(
            Vulnerability.severity,
            func.count(Vulnerability.id),
        ).where(
            Vulnerability.scan_job_id.in_(
                select(ScanJob.id).where(ScanJob.owner_id == user_id)
            )
        ).group_by(Vulnerability.severity)
    )
    vulns_by_severity = {row[0].value if hasattr(row[0], 'value') else row[0]: row[1] for row in vuln_severity_rows.all()}

    recent_vulns = await db.execute(
        select(Vulnerability)
        .where(
            Vulnerability.scan_job_id.in_(
                select(ScanJob.id).where(ScanJob.owner_id == user_id)
            )
        )
        .order_by(desc(Vulnerability.discovered_at))
        .limit(5)
    )
    recent_findings = []
    for v in recent_vulns.scalars().all():
        recent_findings.append({
            "id": str(v.id),
            "name": v.name,
            "severity": v.severity.value if hasattr(v.severity, 'value') else v.severity,
            "url": v.url,
            "discovered_at": v.discovered_at.isoformat() if v.discovered_at else None,
        })

    active_scans_result = await db.execute(
        select(ScanJob)
        .where(
            ScanJob.owner_id == user_id,
            text("status IN ('RUNNING', 'QUEUED')"),
        )
        .order_by(desc(ScanJob.created_at))
        .limit(5)
    )
    active_scans = []
    for s in active_scans_result.scalars().all():
        active_scans.append({
            "id": str(s.id),
            "target_domain": s.target_domain,
            "status": s.status.value if hasattr(s.status, 'value') else s.status,
            "progress_percent": s.progress_percent or 0,
            "current_stage": re.sub(r'^\d+_', '', s.current_stage.value).replace('_', ' ').title() if s.current_stage else None,
            "created_at": s.created_at.isoformat(),
        })

    return {
        "scans": {
            "total": sum(status_counts.values()),
            "running": status_counts.get("running", 0),
            "queued": status_counts.get("queued", 0),
            "completed": status_counts.get("completed", 0),
            "failed": status_counts.get("failed", 0),
        },
        "assets": {
            "total_subdomains": total_subdomains,
            "total_endpoints": total_endpoints,
        },
        "vulnerabilities": {
            "total": total_vulns,
            "by_severity": vulns_by_severity,
        },
        "recent_findings": recent_findings,
        "active_scans": active_scans,
    }
