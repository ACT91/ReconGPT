from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    target_domains: List[str] = Field(default_factory=list, description="Target domains for this project")


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    target_domains: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None
    is_active: Optional[str] = None


class ProjectSettings(BaseModel):
    default_scan_config: Optional[Dict[str, Any]] = None
    notifications: Optional[Dict[str, bool]] = None
    retention_days: Optional[int] = Field(None, ge=1, le=365)


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    owner_id: UUID
    settings: Dict[str, Any]
    is_active: str
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ProjectStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    total_scans: int
    completed_scans: int
    failed_scans: int
    running_scans: int
    total_subdomains: int
    total_endpoints: int
    total_vulnerabilities: int
    critical_vulns: int
    high_vulns: int
    medium_vulns: int
    low_vulns: int