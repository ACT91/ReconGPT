from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID
from app.models.subdomain import SubdomainStatus
from app.models.endpoint import EndpointSource, EndpointStatus
from app.models.vulnerability import VulnerabilitySeverity, VulnerabilityStatus
from app.models.js_file import JsFile


class SubdomainResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    status: SubdomainStatus
    ips: List[str] = []
    cname: Optional[str] = None
    cname_chain: List[str] = []
    is_alive: bool
    status_code: Optional[int] = None
    content_length: Optional[int] = None
    technologies: List[str] = []
    web_server: Optional[str] = None
    title: Optional[str] = None
    tls_info: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
    ports: List[int] = []
    source: Optional[str] = None
    discovered_at: datetime
    probed_at: Optional[datetime] = None


class EndpointResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    subdomain_id: Optional[UUID] = None
    url: str
    normalized_url: str
    path: Optional[str] = None
    method: str
    source: EndpointSource
    status: EndpointStatus
    status_code: Optional[int] = None
    content_type: Optional[str] = None
    content_length: Optional[int] = None
    title: Optional[str] = None
    technologies: List[str] = []
    headers: Optional[Dict[str, Any]] = None
    response_time_ms: Optional[int] = None
    parameters: Dict[str, Any] = {}
    forms: List[Dict[str, Any]] = []
    cookies: Dict[str, Any] = {}
    discovered_at: datetime
    probed_at: Optional[datetime] = None


class VulnerabilityResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    endpoint_id: Optional[UUID] = None
    template_id: str
    name: str
    severity: VulnerabilitySeverity
    status: VulnerabilityStatus
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cwe_ids: List[str] = []
    cve_ids: List[str] = []
    url: str
    matched_at: Optional[str] = None
    extracted_results: Optional[Dict[str, Any]] = None
    request: Optional[str] = None
    response: Optional[str] = None
    description: Optional[str] = None
    remediation: Optional[str] = None
    references: List[str] = []
    tags: List[str] = []
    matcher_name: Optional[str] = None
    matcher_type: Optional[str] = None
    discovered_at: datetime
    updated_at: datetime


class JsFileResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    subdomain_id: Optional[UUID] = None
    endpoint_id: Optional[UUID] = None
    url: str
    local_path: Optional[str] = None
    content_hash: Optional[str] = None
    size_bytes: Optional[int] = None
    downloaded: bool
    analyzed: bool
    endpoints_found: int
    secrets_found: int
    api_endpoints: List[Dict[str, Any]] = []
    secrets: List[Dict[str, Any]] = []
    technologies: List[Dict[str, Any]] = []
    content_preview: Optional[str] = None
    mime_type: Optional[str] = None
    downloaded_at: Optional[datetime] = None
    analyzed_at: Optional[datetime] = None
    discovered_at: datetime


class ScanResultsResponse(BaseModel):
    subdomains: List[SubdomainResult]
    endpoints: List[EndpointResult]
    vulnerabilities: List[VulnerabilityResult]
    js_files: List[JsFileResult]
    total_subdomains: int
    total_endpoints: int
    total_vulnerabilities: int
    total_js_files: int


class AttackSurfaceGraph(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class AggregatedStats(BaseModel):
    total_subdomains: int
    live_subdomains: int
    total_endpoints: int
    live_endpoints: int
    total_vulnerabilities: int
    vulnerabilities_by_severity: Dict[str, int]
    technologies: Dict[str, int]
    web_servers: Dict[str, int]
    status_codes: Dict[str, int]
    top_subdomains_by_vulns: List[Dict[str, Any]]
    top_endpoints_by_vulns: List[Dict[str, Any]]