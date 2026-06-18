from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import SQLAlchemyError
import structlog

from app.core.config import settings
from app.core.logger import setup_logging
from app.core.database import engine, Base
from app.api.routes import auth, scans, projects, results, insights, dashboard
from app.schemas.common import HealthCheckResponse
from app.core.logger import get_logger
from app.core.exceptions import (
    AppException,
    ValidationException,
    format_exception_response,
)
from app.core.security_middleware import SecurityHeadersMiddleware


setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("application_startup", environment=settings.ENVIRONMENT)
    
    from app.core.database import init_db
    await init_db()
    
    from app.tasks.celery_app import celery_app
    logger.info("celery_connected", broker=settings.CELERY_BROKER_URL)
    
    from app.core.websocket_manager import manager
    await manager.connect_redis()
    
    yield
    
    logger.info("application_shutdown")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Attack Surface Management and Reconnaissance Automation Platform",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_tags=[
        {"name": "Authentication", "description": "User authentication and API key management"},
        {"name": "Projects", "description": "Project management and organization"},
        {"name": "Scans", "description": "Scan job management and execution"},
        {"name": "Results", "description": "Scan results and attack surface queries"},
        {"name": "AI Insights", "description": "AI-powered analysis and insights"},
        {"name": "Health", "description": "Health check endpoints"},
    ],
)


# Security Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Total-Count"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.TRUSTED_HOSTS,
)

app.add_middleware(SecurityHeadersMiddleware)


# Request ID and logging middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    import uuid
    request_id = str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    
    logger.info("request_started", query_params=dict(request.query_params))
    
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info("request_completed", status_code=response.status_code)
        return response
    except Exception as e:
        logger.error("request_failed", error=str(e))
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
        )


# Error Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("validation_error", errors=exc.errors())
    return JSONResponse(
        status_code=422,
        content=format_exception_response(
            error="Validation error",
            detail=str(exc),
            code="VALIDATION_ERROR",
            errors=exc.errors(),
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning("http_error", status_code=exc.status_code, detail=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=format_exception_response(
            error="HTTP error",
            detail=exc.detail,
            code=f"HTTP_{exc.status_code}",
            headers=exc.headers,
        ),
        headers=exc.headers or {},
    )


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    logger.error("app_error", code=exc.code, detail=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=format_exception_response(
            error=exc.message,
            detail=exc.detail,
            code=exc.code,
        ),
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error("database_error", error=str(exc))
    return JSONResponse(
        status_code=500,
        content=format_exception_response(
            error="Database error",
            detail="A database error occurred. Please try again later.",
            code="DATABASE_ERROR",
        ),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_error", error=str(exc))
    return JSONResponse(
        status_code=500,
        content=format_exception_response(
            error="Internal server error",
            detail="An unexpected error occurred.",
            code="INTERNAL_ERROR",
        ),
    )


# Health Check Endpoints
@app.get(
    "/health",
    tags=["Health"],
    summary="Basic health check",
    description="Returns simple health status of the API",
)
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get(
    "/ready",
    tags=["Health"],
    summary="Readiness check",
    description="Checks if the application is ready to serve requests",
)
async def readiness():
    import asyncpg
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        db_status = "ready"
    except Exception:
        db_status = "unavailable"
    
    try:
        import redis.asyncio as redis
        r = redis.from_url(str(settings.REDIS_URL))
        await r.ping()
        await r.close()
        redis_status = "ready"
    except Exception:
        redis_status = "unavailable"
    
    ready = db_status == "ready" and redis_status == "ready"
    status_code = 200 if ready else 503
    
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if ready else "degraded",
            "checks": {
                "database": db_status,
                "redis": redis_status,
                "celery": "ready",
            },
            "version": settings.APP_VERSION,
        },
    )


@app.get(
    "/metrics",
    tags=["Health"],
    summary="Prometheus metrics endpoint",
    description="Exposes Prometheus metrics for monitoring",
)
async def metrics():
    try:
        from prometheus_client import generate_latest, REGISTRY
        return Response(
            content=generate_latest(REGISTRY).decode("utf-8"),
            media_type="text/plain",
        )
    except ImportError:
        return JSONResponse(
            status_code=501,
            content={"detail": "Metrics not enabled. Install prometheus-client."},
        )


# API Routes
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
app.include_router(scans.router, prefix=settings.API_V1_PREFIX)
app.include_router(results.router, prefix=settings.API_V1_PREFIX)
app.include_router(insights.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    }