from typing import Optional, AsyncGenerator
from uuid import UUID
from fastapi import Depends, HTTPException, status, Header, Request, WebSocket, Query
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User, UserRole
from app.services.auth import AuthService
from app.core.logger import get_logger
from app.core.rate_limit import check_rate_limit, check_concurrent_scans

logger = get_logger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme),
    api_key: Optional[str] = Depends(api_key_header),
) -> User:
    auth_service = AuthService(db)
    
    if api_key:
        user = await auth_service.verify_api_key(api_key)
        if user:
            logger.debug("auth_api_key", user_id=str(user.id))
            return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = verify_token(token, "access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await auth_service.get_user_by_id(UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_analyst_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in [UserRole.ADMIN, UserRole.ANALYST]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst access required"
        )
    return current_user


class RateLimitDep:
    def __init__(self, max_requests: Optional[int] = None, window_seconds: Optional[int] = None):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    async def __call__(
        self,
        request: Request,
        current_user: User = Depends(get_current_user),
    ):
        is_allowed, remaining = await check_rate_limit(
            user_id=str(current_user.id),
            action=request.url.path,
            max_requests=self.max_requests,
            window_seconds=self.window_seconds,
        )
        
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window_seconds}s"
            )


rate_limit = RateLimitDep()
rate_limit_scan = RateLimitDep(max_requests=10, window_seconds=3600)


async def check_scan_concurrency(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    is_allowed, remaining = await check_concurrent_scans(str(current_user.id))
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Maximum concurrent scans exceeded. Max {settings.MAX_CONCURRENT_SCANS_PER_USER} concurrent scans per user"
        )
    return remaining


async def get_current_user_ws(
    ws: WebSocket,
    token: Optional[str] = Query(None, alias="token"),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not token:
        await ws.close(code=1008, reason="Missing auth token")
        return None

    payload = verify_token(token, "access")
    if not payload:
        await ws.close(code=1008, reason="Invalid or expired token")
        return None

    user_id = payload.get("sub")
    if not user_id:
        await ws.close(code=1008, reason="Invalid token payload")
        return None

    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(UUID(user_id))
    if not user or not user.is_active:
        await ws.close(code=1008, reason="User not found or inactive")
        return None

    return user