from typing import Optional
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.user import User, UserRole, APIKey
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.core.logger import get_logger
import secrets


logger = get_logger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning("auth_failed_user_not_found", email=email)
            return None
        
        if not user.is_active:
            logger.warning("auth_failed_user_inactive", user_id=str(user.id))
            return None
        
        if not verify_password(password, user.hashed_password):
            logger.warning("auth_failed_invalid_password", user_id=str(user.id))
            return None
        
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        
        logger.info("auth_success", user_id=str(user.id))
        return user

    async def register_user(self, email: str, password: str, full_name: Optional[str] = None) -> User:
        existing = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")
        
        user = User(
            email=email.lower(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=UserRole.USER,
        )
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        logger.info("user_registered", user_id=str(user.id), email=email)
        return user

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def create_tokens(self, user: User) -> dict:
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role}
        )
        refresh_token = create_refresh_token(
            data={"sub": str(user.id), "email": user.email}
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 30 * 60,
        }

    async def refresh_access_token(self, refresh_token: str) -> Optional[dict]:
        payload = verify_token(refresh_token, "refresh")
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        user = await self.get_user_by_id(UUID(user_id))
        if not user or not user.is_active:
            return None
        
        return await self.create_tokens(user)

    async def change_password(self, user_id: UUID, current_password: str, new_password: str) -> bool:
        user = await self.get_user_by_id(user_id)
        if not user:
            return False
        
        if not verify_password(current_password, user.hashed_password):
            return False
        
        user.hashed_password = get_password_hash(new_password)
        await self.db.commit()
        
        logger.info("password_changed", user_id=str(user_id))
        return True

    async def create_api_key(self, user_id: UUID, name: str, expires_in_days: Optional[int] = None) -> tuple[APIKey, str]:
        prefix = f"rky_{secrets.token_urlsafe(8)}"
        key = f"{prefix}{secrets.token_urlsafe(32)}"
        key_hash = get_password_hash(key)
        
        expires_at = None
        if expires_in_days:
            from datetime import timedelta
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        
        api_key = APIKey(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            key_prefix=prefix,
            expires_at=expires_at,
        )
        
        self.db.add(api_key)
        await self.db.commit()
        await self.db.refresh(api_key)
        
        logger.info("api_key_created", user_id=str(user_id), key_id=str(api_key.id))
        return api_key, key

    async def verify_api_key(self, key: str) -> Optional[User]:
        if not key.startswith("rky_"):
            return None
        
        prefix = key[:20]
        result = await self.db.execute(
            select(APIKey)
            .where(APIKey.key_prefix == prefix)
            .where(APIKey.is_active == True)
            .options(selectinload(APIKey.user))
        )
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            return None
        
        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            return None
        
        if not verify_password(key, api_key.key_hash):
            return None
        
        if not api_key.user.is_active:
            return None
        
        api_key.last_used_at = datetime.now(timezone.utc)
        await self.db.commit()
        
        return api_key.user

    async def list_api_keys(self, user_id: UUID) -> list[APIKey]:
        result = await self.db.execute(
            select(APIKey).where(APIKey.user_id == user_id).order_by(APIKey.created_at.desc())
        )
        return list(result.scalars().all())

    async def revoke_api_key(self, user_id: UUID, key_id: UUID) -> bool:
        result = await self.db.execute(
            select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user_id)
        )
        api_key = result.scalar_one_or_none()
        
        if not api_key:
            return False
        
        api_key.is_active = False
        await self.db.commit()
        
        logger.info("api_key_revoked", user_id=str(user_id), key_id=str(key_id))
        return True