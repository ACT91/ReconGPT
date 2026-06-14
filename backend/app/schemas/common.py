from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from uuid import UUID


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="ignore",
    )


T = TypeVar("T")


class PaginationParams(BaseSchema):
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseSchema, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class SuccessResponse(BaseSchema):
    success: bool = True
    message: str
    data: Optional[Any] = None


class ErrorResponse(BaseSchema):
    success: bool = False
    error: str
    detail: Optional[Any] = None
    error_code: Optional[str] = None


class HealthCheckResponse(BaseSchema):
    status: str
    version: str
    timestamp: datetime
    checks: dict


class TimestampMixin(BaseSchema):
    created_at: datetime
    updated_at: Optional[datetime] = None


class IDMixin(BaseSchema):
    id: UUID