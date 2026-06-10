from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ScanRequest(BaseModel):
    target_domain: str = Field(..., description="Target domain to scan")
    user_id: str = Field(..., description="User ID")
    project_id: Optional[str] = Field(None, description="Project ID")

class ScanResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobResponse(BaseModel):
    id: str
    target_domain: str
    status: str
    current_stage: Optional[str]
    progress_percent: float
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]

class ProjectRequest(BaseModel):
    user_id: str
    name: str
    description: Optional[str]

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
