from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    PasswordChangeRequest,
    Token,
    UserResponse,
    APIKeyCreate,
    APIKeyResponse,
    APIKeyFullResponse,
)
from app.services.auth import AuthService
from app.api.deps import get_current_user, get_current_active_user
from app.core.logger import get_logger
from app.models.user import User


logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)

    try:
        user = await auth_service.authenticate_user(request.email, request.password)
    except ValueError as lock_err:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=str(lock_err),
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    tokens = await auth_service.create_tokens(user)

    logger.info("login_success", user_id=str(user.id))
    return tokens


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)

    try:
        user = await auth_service.register_user(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            accepted_tos=getattr(request, 'accepted_tos', False),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return user


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    
    tokens = await auth_service.refresh_access_token(request.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    
    return tokens


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
):
    return current_user


@router.post("/change-password", response_model=dict)
async def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    
    success = await auth_service.change_password(
        current_user.id,
        request.current_password,
        request.new_password,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    return {"message": "Password changed successfully"}


@router.post("/api-keys", response_model=APIKeyFullResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    request: APIKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    
    api_key, key = await auth_service.create_api_key(
        current_user.id,
        request.name,
        request.expires_in_days,
    )
    
    return APIKeyFullResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        is_active=api_key.is_active,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        key=key,
    )


@router.get("/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    auth_service = AuthService(db)
    api_keys = await auth_service.list_api_keys(current_user.id)
    
    return [
        APIKeyResponse(
            id=key.id,
            name=key.name,
            key_prefix=key.key_prefix,
            is_active=key.is_active,
            expires_at=key.expires_at,
            last_used_at=key.last_used_at,
            created_at=key.created_at,
        )
        for key in api_keys
    ]


@router.delete("/api-keys/{key_id}", response_model=dict)
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    auth_service = AuthService(db)
    
    success = await auth_service.revoke_api_key(current_user.id, UUID(key_id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    
    return {"message": "API key revoked successfully"}


@router.post("/logout", response_model=dict)
async def logout(
    current_user: User = Depends(get_current_active_user),
):
    return {"message": "Logged out successfully"}


@router.delete("/me", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_my_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 17 — Right to Erasure."""
    auth_service = AuthService(db)
    success = await auth_service.delete_account(current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account",
        )
    logger.info("user_account_deleted_gdpr", user_id=str(current_user.id))
    return {"message": "Account deleted. Your personal data has been anonymised."}


@router.get("/me/export", response_model=dict)
async def export_my_data(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """GDPR Article 20 — Right to Data Portability."""
    auth_service = AuthService(db)
    data = await auth_service.export_account_data(current_user.id)
    logger.info("user_data_exported_gdpr", user_id=str(current_user.id))
    return data