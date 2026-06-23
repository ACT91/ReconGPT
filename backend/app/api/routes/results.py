from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.user import User
from app.models.job import ScanJob, ScanStatus
from app.models.subdomain import Subdomain
from app.models.endpoint import Endpoint, EndpointSource
from app.models.vulnerability import Vulnerability, VulnerabilitySeverity
from app.models.js_file import JsFile
from app.schemas.result import (
    SubdomainResult,
    EndpointResult,
    VulnerabilityResult,
    JsFileResult,
    ScanResultsResponse,
    AggregatedStats,
    AttackSurfaceGraph,
)
from app.schemas.common import PaginationParams
from app.api.deps import get_current_user, get_current_active_user, rate_limit
from app.core.logger import get_logger


logger = get_logger(__name__)

router = APIRouter(prefix="/results", tags=["Results"])


async def _get_job_or_404(db: AsyncSession, job_id: UUID, user_id: UUID):
    result = await db.execute(select(ScanJob).where(ScanJob.id == job_id, ScanJob.owner_id == user_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan job not found")
    return job


def _build_tech_server_counts(sd_list, ep_list):
    tech_counts = {}
    server_counts = {}
    status_codes = {}
    for s in sd_list:
        for t in (s.technologies or []):
            tech_counts[t] = tech_counts.get(t, 0) + 1
        if s.web_server:
            server_counts[s.web_server] = server_counts.get(s.web_server, 0) + 1
        if s.status_code:
            c = str(s.status_code)
            status_codes[c] = status_codes.get(c, 0) + 1
    for e in ep_list:
        for t in (e.technologies or []):
            tech_counts[t] = tech_counts.get(t, 0) + 1
        if e.status_code:
            c = str(e.status_code)
            status_codes[c] = status_codes.get(c, 0) + 1
    return tech_counts, server_counts, status_codes


def _build_vuln_subdomain_map(vuln_list, ep_list, sd_list):
    result = {}
    for v in vuln_list:
        name = "unknown"
        ep = next((e for e in ep_list if e.id == v.endpoint_id), None)
        if ep and ep.subdomain_id:
            sd = next((s for s in sd_list if s.id == ep.subdomain_id), None)
            if sd:
                name = sd.name
        result[name] = result.get(name, 0) + 1
    return result


def _build_top_items(data, key_name="name", limit=10):
    return sorted(
        [{key_name: k, "vulnerabilities": v} for k, v in data.items()],
        key=lambda x: x["vulnerabilities"], reverse=True,
    )[:limit]


@router.get("/{job_id}/overview", response_model=dict)
async def get_results_overview(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    job = await _get_job_or_404(db, job_id, current_user.id)
    subdomains_count = await db.execute(
        select(func.count(Subdomain.id)).where(Subdomain.scan_job_id == job_id)
    )
    alive_count = await db.execute(
        select(func.count(Subdomain.id)).where(
            Subdomain.scan_job_id == job_id,
            Subdomain.is_alive.is_(True),
        )
    )
    endpoints_count = await db.execute(
        select(func.count(Endpoint.id)).where(Endpoint.scan_job_id == job_id)
    )
    vulns_count = await db.execute(
        select(func.count(Vulnerability.id)).where(Vulnerability.scan_job_id == job_id)
    )
    js_count = await db.execute(
        select(func.count(JsFile.id)).where(JsFile.scan_job_id == job_id)
    )
    
    return {
        "job_id": str(job_id),
        "target_domain": job.target_domain,
        "status": job.status.value,
        "progress": job.progress_percent,
        "stats": {
            "total_subdomains": subdomains_count.scalar() or 0,
            "alive_subdomains": alive_count.scalar() or 0,
            "total_endpoints": endpoints_count.scalar() or 0,
            "total_vulnerabilities": vulns_count.scalar() or 0,
            "total_js_files": js_count.scalar() or 0,
        },
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "created_at": job.created_at.isoformat(),
    }


@router.get("/{job_id}", response_model=ScanResultsResponse)
async def get_full_results(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    await _get_job_or_404(db, job_id, current_user.id)
    subdomains = await db.execute(
        select(Subdomain).where(Subdomain.scan_job_id == job_id).order_by(Subdomain.name)
    )
    
    endpoints = await db.execute(
        select(Endpoint).where(Endpoint.scan_job_id == job_id).order_by(Endpoint.url)
    )
    
    vulnerabilities = await db.execute(
        select(Vulnerability).where(Vulnerability.scan_job_id == job_id).order_by(desc(Vulnerability.severity))
    )
    
    js_files = await db.execute(
        select(JsFile).where(JsFile.scan_job_id == job_id)
    )
    
    sd_list = subdomains.scalars().all()
    ep_list = endpoints.scalars().all()
    vuln_list = vulnerabilities.scalars().all()
    js_list = js_files.scalars().all()
    
    return ScanResultsResponse(
        subdomains=[SubdomainResult.model_validate(s) for s in sd_list],
        endpoints=[EndpointResult.model_validate(e) for e in ep_list],
        vulnerabilities=[VulnerabilityResult.model_validate(v) for v in vuln_list],
        js_files=[JsFileResult.model_validate(j) for j in js_list],
        total_subdomains=len(sd_list),
        total_endpoints=len(ep_list),
        total_vulnerabilities=len(vuln_list),
        total_js_files=len(js_list),
    )


@router.get("/{job_id}/stats", response_model=AggregatedStats)
async def get_aggregated_stats(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    await _get_job_or_404(db, job_id, current_user.id)
    
    sd_list = (await db.execute(select(Subdomain).where(Subdomain.scan_job_id == job_id))).scalars().all()
    vuln_list = (await db.execute(select(Vulnerability).where(Vulnerability.scan_job_id == job_id))).scalars().all()
    ep_list = (await db.execute(select(Endpoint).where(Endpoint.scan_job_id == job_id))).scalars().all()
    
    vulns_by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for v in vuln_list:
        vulns_by_severity[v.severity.value] = vulns_by_severity.get(v.severity.value, 0) + 1
    
    tech_counts, server_counts, status_codes = _build_tech_server_counts(sd_list, ep_list)
    vuln_subdomain_map = _build_vuln_subdomain_map(vuln_list, ep_list, sd_list)
    top_subdomains = _build_top_items(vuln_subdomain_map, "name")
    
    vulns_by_endpoint = {}
    for v in vuln_list:
        url = v.url[:100]
        vulns_by_endpoint[url] = vulns_by_endpoint.get(url, 0) + 1
    top_endpoints = _build_top_items(vulns_by_endpoint, "name")
    
    return AggregatedStats(
        total_subdomains=len(sd_list),
        live_subdomains=sum(1 for s in sd_list if s.is_alive),
        total_endpoints=len(ep_list),
        live_endpoints=sum(1 for e in ep_list if e.status_code and e.status_code < 500),
        total_vulnerabilities=len(vuln_list),
        vulnerabilities_by_severity=vulns_by_severity,
        technologies=tech_counts,
        web_servers=server_counts,
        status_codes=status_codes,
        top_subdomains_by_vulns=top_subdomains,
        top_endpoints_by_vulns=top_endpoints,
    )


@router.get("/{job_id}/graph", response_model=AttackSurfaceGraph)
def _add_domain_node(nodes, edges, target_domain):
    nodes.append({"id": f"domain-{target_domain}", "label": target_domain, "type": "domain", "level": 0})


def _add_subdomain_nodes(nodes, edges, sd_list, vulns_by_subdomain):
    for sd in sd_list:
        nodes.append({
            "id": f"subdomain-{sd.id}", "label": sd.name, "type": "subdomain", "level": 1,
            "is_alive": sd.is_alive, "technologies": sd.technologies,
            "status_code": sd.status_code, "title": sd.title,
            "vulnerability_count": sum(1 for v in vulns_by_subdomain.get(str(sd.id), [])),
            "ip": sd.ips[0] if sd.ips else None,
        })
        edges.append({
            "id": f"edge-domain-{sd.id}", "source": nodes[0]["id"],
            "target": f"subdomain-{sd.id}", "type": "dns", "label": "resolves_to",
        })


def _add_endpoint_nodes(nodes, edges, ep_list, sd_list):
    ep_by_subdomain = {}
    for ep in ep_list:
        if ep.subdomain_id:
            ep_by_subdomain.setdefault(str(ep.subdomain_id), []).append(ep)
    for sd_id, eps in ep_by_subdomain.items():
        for ep in eps[:50]:
            nodes.append({
                "id": f"endpoint-{ep.id}", "label": (ep.path or ep.url)[:50],
                "type": "endpoint", "level": 2, "url": ep.url, "method": ep.method,
                "status_code": ep.status_code, "content_type": ep.content_type,
                "source": ep.source.value if ep.source else None,
            })
            edges.append({
                "id": f"edge-endpoint-{ep.id}", "source": f"subdomain-{sd_id}",
                "target": f"endpoint-{ep.id}", "type": "endpoint", "label": f"{ep.method}",
            })


def _add_vuln_nodes(nodes, edges, vuln_list):
    vulns_by_endpoint = {}
    for v in vuln_list:
        if v.endpoint_id:
            vulns_by_endpoint.setdefault(str(v.endpoint_id), []).append(v)
    for ep_id, vulns_list in vulns_by_endpoint.items():
        for v in vulns_list[:5]:
            nodes.append({
                "id": f"vuln-{v.id}", "label": v.name[:50], "type": "vulnerability",
                "level": 3, "severity": v.severity.value, "template_id": v.template_id,
                "cvss_score": v.cvss_score,
            })
            edges.append({
                "id": f"edge-vuln-{v.id}", "source": f"endpoint-{ep_id}",
                "target": f"vuln-{v.id}", "type": "vulnerability", "label": v.severity.value,
            })


def _build_vulns_by_subdomain(vuln_list, ep_list):
    result = {}
    for v in vuln_list:
        ep = next((e for e in ep_list if e.id == v.endpoint_id), None)
        if ep and ep.subdomain_id:
            result.setdefault(str(ep.subdomain_id), []).append(v)
    return result


async def get_attack_surface_graph(
    job_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    _rate_limit: None = Depends(rate_limit),
):
    job = await _get_job_or_404(db, job_id, current_user.id)
    
    sd_list = (await db.execute(select(Subdomain).where(Subdomain.scan_job_id == job_id))).scalars().all()
    ep_list = (await db.execute(select(Endpoint).where(Endpoint.scan_job_id == job_id))).scalars().all()
    vuln_list = (await db.execute(select(Vulnerability).where(Vulnerability.scan_job_id == job_id))).scalars().all()
    
    nodes, edges = [], []
    _add_domain_node(nodes, edges, job.target_domain)
    vulns_by_subdomain = _build_vulns_by_subdomain(vuln_list, ep_list)
    _add_subdomain_nodes(nodes, edges, sd_list, vulns_by_subdomain)
    _add_endpoint_nodes(nodes, edges, ep_list, sd_list)
    _add_vuln_nodes(nodes, edges, vuln_list)
    
    return AttackSurfaceGraph(
        nodes=nodes, edges=edges,
        metadata={
            "target_domain": job.target_domain,
            "total_subdomains": len(sd_list),
            "total_endpoints": len(ep_list),
            "total_vulnerabilities": len(vuln_list),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    )