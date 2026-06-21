from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import Field
from app.schemas.common import BaseSchema, TimestampMixin, IDMixin


class ScanConfig(BaseSchema):
    subdomain_enum: bool = True
    live_probe: bool = True
    tech_detect: bool = True
    web_crawl: bool = True
    js_extract: bool = True
    vuln_scan: bool = True
    ai_analysis: bool = True
    custom_subdomains: Optional[List[str]] = None
    rate_limit: Optional[int] = None
    timeout: Optional[int] = None


class ScanRequest(BaseSchema):
    target_domain: str = Field(..., description="Domain to scan")
    project_id: Optional[UUID] = Field(default=None, description="Optional project ID")
    config: Optional[ScanConfig] = Field(default=None, description="Scan configuration overrides")


class ScanJobBase(BaseSchema):
    target_domain: str
    status: str
    current_stage: Optional[str] = None
    progress_percent: float = 0.0
    error_message: Optional[str] = None


class ScanJobResponse(ScanJobBase, TimestampMixin, IDMixin):
    project_id: Optional[UUID] = None
    owner_id: UUID
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ScanJobListResponse(BaseSchema):
    items: List[ScanJobResponse]
    total: int


class ScanJobDetailResponse(ScanJobResponse):
    scan_config: Optional[Dict[str, Any]] = None
    scan_metadata: Optional[Dict[str, Any]] = None


class ScanStartResponse(BaseSchema):
    job_id: UUID
    status: str
    target_domain: str
    message: str


# Alias for backward compatibility
ScanResponse = ScanJobResponse


class ScanCancelRequest(BaseSchema):
    reason: Optional[str] = None
    force: Optional[bool] = None


class ScanLogEntry(BaseSchema):
    timestamp: datetime
    level: str
    message: str
    stage: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ScanLogsRequest(BaseSchema):
    offset: int = 0
    limit: int = 100
    level: Optional[str] = None
    stage: Optional[str] = None


class ScanLogsResponse(BaseSchema):
    items: List[ScanLogEntry]
    total: int
    page: int = 1
    page_size: int = 50
    total_pages: int = 0
    has_more: bool = False


class ScanStageProgress(BaseSchema):
    stage: str
    status: str
    progress: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


class ScanProgressResponse(BaseSchema):
    job_id: UUID
    target_domain: str
    status: str
    overall_progress: float
    current_stage: Optional[str] = None
    stages: List[ScanStageProgress]
