from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID
from app.models.ai_insight import InsightType, InsightPriority


class AiInsightBase(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    insight_type: InsightType
    priority: InsightPriority
    priority_score: float
    title: str
    content: str
    summary: Optional[str] = None
    affected_assets: List[Dict[str, Any]] = []
    related_vulnerabilities: List[Dict[str, Any]] = []
    related_subdomains: List[Dict[str, Any]] = []
    related_endpoints: List[Dict[str, Any]] = []
    insight_metadata: Dict[str, Any] = {}
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    confidence: Optional[float] = None
    is_actionable: bool = True


class AiInsightCreate(AiInsightBase):
    pass


class AiInsightUpdate(BaseModel):
    priority: Optional[InsightPriority] = None
    priority_score: Optional[float] = None
    is_dismissed: Optional[bool] = None


class AiInsightResponse(AiInsightBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    scan_job_id: UUID
    is_dismissed: bool
    created_at: datetime
    updated_at: datetime


class AiInsightListResponse(BaseModel):
    items: List[AiInsightResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AiAnalysisReport(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    target: str
    generated_at: datetime
    model_used: str
    tokens_used: int
    risk_score: float
    executive_summary: str
    attack_surface_assessment: str
    critical_findings: List[Dict[str, Any]]
    high_priority_targets: List[Dict[str, Any]]
    vulnerability_prioritization: List[Dict[str, Any]]
    recommended_next_steps: List[str]
    manual_testing_suggestions: List[str]
    compliance_notes: Optional[str] = None
    anomalies: List[Dict[str, Any]] = []


class RiskScoreBreakdown(BaseModel):
    overall_score: float
    subdomain_scores: Dict[str, float]
    endpoint_scores: Dict[str, float]
    vulnerability_contribution: float
    exposure_contribution: float
    complexity_contribution: float


class AttackVector(BaseModel):
    id: str
    name: str
    description: str
    affected_assets: List[str]
    prerequisites: List[str]
    impact: str
    likelihood: str
    cvss_score: Optional[float] = None
    references: List[str] = []