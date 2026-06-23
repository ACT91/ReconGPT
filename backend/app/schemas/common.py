from typing import Generic, TypeVar, Optional, List, Any, Dict
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
    sort: Optional[str] = Field(default=None, description="Sort field and direction, e.g. 'created_at:desc' or 'name:asc'")
    search: Optional[str] = Field(default=None, description="Search term for filtering")


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


def parse_sort_param(sort: Optional[str], default_field: str = "created_at", default_dir: str = "desc") -> tuple[str, str]:
    if not sort:
        return default_field, default_dir
    parts = sort.split(":")
    field = parts[0] if parts else default_field
    direction = parts[1].lower() if len(parts) > 1 and parts[1].lower() in ("asc", "desc") else default_dir
    return field, direction