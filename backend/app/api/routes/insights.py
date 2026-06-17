from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.models.user import User
from app.models.job import ScanJob
from app.models.ai_insight import AiInsight, InsightType, InsightPriority
from app.schemas.insight import (
    AiInsightResponse,
    AiInsightListResponse,
    AiInsightUpdate,
    AiAnalysisReport,
    RiskScoreBreakdown,
)
from app.schemas.common import PaginationParams
from app.api.deps import get_current_user, get_current_active_user, rate_limit
from app.core.logger import get_logger


logger = get_logger(__name__)

router = APIRouter(prefix="/insights", tags=["AI Insights"])


@router.get("/{job_id}", response_model=AiInsightListResponse)
async def get_job_insights(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    insight_type: Optional[InsightType] = Query(None, description="Filter by insight type"),
    priority: Optional[InsightPriority] = Query(None, description="Filter by priority"),
    actionable_only: bool = Query(False, description="Show only actionable insights"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    query = select(AiInsight).where(AiInsight.scan_job_id == job_id)
    
    if insight_type:
        query = query.where(AiInsight.insight_type == insight_type)
    if priority:
        query = query.where(AiInsight.priority == priority)
    if actionable_only:
        query = query.where(AiInsight.is_actionable == 1)
    
    query = query.where(AiInsight.is_dismissed == 0)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    query = query.order_by(desc(AiInsight.priority_score), desc(AiInsight.created_at))
    query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)
    
    result = await db.execute(query)
    insights = result.scalars().all()
    
    return AiInsightListResponse(
        items=insights,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=(total + pagination.page_size - 1) // pagination.page_size,
    )


@router.get("/{job_id}/executive-summary", response_model=AiInsightResponse)
async def get_executive_summary(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    result = await db.execute(
        select(AiInsight)
        .where(
            AiInsight.scan_job_id == job_id,
            AiInsight.insight_type == InsightType.EXECUTIVE_SUMMARY,
            AiInsight.is_dismissed == 0,
        )
        .order_by(desc(AiInsight.created_at))
        .limit(1)
    )
    insight = result.scalar_one_or_none()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Executive summary not yet generated",
        )
    
    return insight


@router.get("/{job_id}/risk-score", response_model=RiskScoreBreakdown)
async def get_risk_score(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    from app.models.subdomain import Subdomain
    from app.models.endpoint import Endpoint
    from app.models.vulnerability import Vulnerability, VulnerabilitySeverity
    
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    subdomains = await db.execute(
        select(Subdomain).where(Subdomain.scan_job_id == job_id)
    )
    sd_list = subdomains.scalars().all()
    
    endpoints = await db.execute(
        select(Endpoint).where(Endpoint.scan_job_id == job_id)
    )
    ep_list = endpoints.scalars().all()
    
    vulns = await db.execute(
        select(Vulnerability).where(Vulnerability.scan_job_id == job_id)
    )
    vuln_list = vulns.scalars().all()
    
    vuln_score = sum(v.severity_weight for v in vuln_list)
    vuln_score = min(vuln_score / 10, 40)
    
    subdomain_exposure = min(len(sd_list) * 2, 20)
    endpoint_exposure = min(len(ep_list) * 0.5, 20)
    live_ratio = sum(1 for s in sd_list if s.is_alive) / max(len(sd_list), 1)
    exposure_score = subdomain_exposure + endpoint_exposure + (live_ratio * 10)
    exposure_score = min(exposure_score, 30)
    
    tech_complexity = 0
    for s in sd_list:
        tech_complexity += len(s.technologies or [])
    complexity_score = min(tech_complexity * 2, 20)
    
    overall = min(vuln_score + exposure_score + complexity_score, 100)
    
    subdomain_scores = {}
    for s in sd_list:
        s_vulns = sum(
            v.severity_weight for v in vuln_list
            if v.endpoint_id and any(
                e.id == v.endpoint_id and e.subdomain_id == s.id
                for e in ep_list
            )
        )
        subdomain_scores[s.name] = min(s_vulns * 5, 100)
    
    endpoint_scores = {}
    for e in ep_list:
        e_vulns = sum(v.severity_weight for v in vuln_list if v.endpoint_id == e.id)
        endpoint_scores[e.url[:50]] = min(e_vulns * 10, 100)
    
    return RiskScoreBreakdown(
        overall_score=round(overall, 1),
        subdomain_scores=subdomain_scores,
        endpoint_scores=endpoint_scores,
        vulnerability_contribution=round(vuln_score, 1),
        exposure_contribution=round(exposure_score, 1),
        complexity_contribution=round(complexity_score, 1),
    )


@router.get("/{job_id}/attack-vectors", response_model=list)
async def get_attack_vectors(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    result = await db.execute(
        select(AiInsight)
        .where(
            AiInsight.scan_job_id == job_id,
            AiInsight.insight_type.in_([
                InsightType.ATTACK_SURFACE,
                InsightType.HIGH_PRIORITY_TARGETS,
                InsightType.VULNERABILITY_PRIORITIZATION,
            ]),
            AiInsight.is_dismissed == 0,
        )
        .order_by(desc(AiInsight.priority_score))
    )
    insights = result.scalars().all()
    
    attack_vectors = []
    for insight in insights:
        attack_vectors.append({
            "id": str(insight.id),
            "title": insight.title,
            "type": insight.insight_type.value,
            "priority": insight.priority.value,
            "priority_score": insight.priority_score,
            "summary": insight.summary or insight.content[:200],
            "affected_assets": insight.affected_assets,
            "related_vulnerabilities": insight.related_vulnerabilities,
            "related_subdomains": insight.related_subdomains,
            "related_endpoints": insight.related_endpoints,
        })
    
    return attack_vectors


@router.get("/{job_id}/{insight_id}", response_model=AiInsightResponse)
async def get_insight_detail(
    job_id: UUID,
    insight_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    result = await db.execute(
        select(AiInsight).where(
            AiInsight.id == insight_id,
            AiInsight.scan_job_id == job_id,
        )
    )
    insight = result.scalar_one_or_none()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    return insight


@router.patch("/{job_id}/{insight_id}", response_model=AiInsightResponse)
async def update_insight(
    job_id: UUID,
    insight_id: UUID,
    update: AiInsightUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    result = await db.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan job not found",
        )
    
    result = await db.execute(
        select(AiInsight).where(
            AiInsight.id == insight_id,
            AiInsight.scan_job_id == job_id,
        )
    )
    insight = result.scalar_one_or_none()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(insight, field, value)
    
    await db.commit()
    await db.refresh(insight)
    
    logger.info("insight_updated", user_id=str(current_user.id), insight_id=str(insight_id))
    return insight