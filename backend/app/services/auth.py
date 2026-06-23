from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import UUID
import re
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

# Account lockout constants
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


def _validate_password_complexity(password: str) -> Optional[str]:
    """Return an error message if password fails complexity rules, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one number"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]~`]", password):
        return "Password must contain at least one special character"
    return None


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

        # Check account lockout
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60)
            logger.warning("auth_failed_account_locked", user_id=str(user.id))
            raise ValueError(f"Account is locked. Try again in {remaining} minutes.")

        # Require email verification before login
        if not user.is_verified:
            logger.warning("auth_failed_unverified", user_id=str(user.id), email=email)
            raise ValueError("Please verify your email address before logging in")

        if not verify_password(password, user.hashed_password):
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                logger.warning("auth_account_locked", user_id=str(user.id))
            await self.db.commit()
            logger.warning("auth_failed_invalid_password", user_id=str(user.id))
            return None

        # Successful login — reset lockout counters
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()

        logger.info("auth_success", user_id=str(user.id))
        return user

    async def register_user(self, email: str, password: str, full_name: Optional[str] = None, accepted_tos: bool = False) -> User:
        existing = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")

        complexity_error = _validate_password_complexity(password)
        if complexity_error:
            raise ValueError(complexity_error)

        if not accepted_tos:
            raise ValueError("You must accept the Terms of Service to create an account")

        user = User(
            email=email.lower(),
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role=UserRole.USER,
            accepted_tos_at=datetime.now(timezone.utc) if accepted_tos else None,
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

        # Reject tokens issued before the last password change
        if user.password_changed_at:
            token_iat = payload.get("iat")
            if token_iat and token_iat < user.password_changed_at.timestamp():
                logger.warning("refresh_rejected_stale_token", user_id=str(user_id))
                return None

        return await self.create_tokens(user)

    async def change_password(self, user_id: UUID, current_password: str, new_password: str) -> bool:
        user = await self.get_user_by_id(user_id)
        if not user:
            return False

        if not verify_password(current_password, user.hashed_password):
            return False

        complexity_error = _validate_password_complexity(new_password)
        if complexity_error:
            raise ValueError(complexity_error)

        user.hashed_password = get_password_hash(new_password)
        user.password_changed_at = datetime.now(timezone.utc)
        await self.db.commit()

        logger.info("password_changed", user_id=str(user_id))
        return True

    async def delete_account(self, user_id: UUID) -> bool:
        """GDPR Art. 17 — Right to Erasure. Anonymizes personal data and deactivates account."""
        user = await self.get_user_by_id(user_id)
        if not user:
            return False

        import uuid as _uuid
        anon_id = str(_uuid.uuid4())[:8]
        user.email = f"deleted_{anon_id}@deleted.invalid"
        user.full_name = None
        user.hashed_password = get_password_hash(_uuid.uuid4().hex)  # randomise, blocks all logins
        user.is_active = False
        user.failed_login_attempts = 0
        user.locked_until = None
        await self.db.commit()

        logger.info("account_deleted_gdpr", user_id=str(user_id))
        return True

    async def export_account_data(self, user_id: UUID) -> dict:
        """GDPR Art. 20 — Right to Portability. Returns all user personal data as JSON."""
        from app.models.job import ScanJob
        from app.models.project import Project

        user = await self.get_user_by_id(user_id)
        if not user:
            return {}

        projects_result = await self.db.execute(
            select(Project).where(Project.owner_id == user_id)
        )
        projects = projects_result.scalars().all()

        scans_result = await self.db.execute(
            select(ScanJob).where(ScanJob.owner_id == user_id)
        )
        scans = scans_result.scalars().all()

        api_keys = await self.list_api_keys(user_id)

        return {
            "profile": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "accepted_tos_at": user.accepted_tos_at.isoformat() if user.accepted_tos_at else None,
            },
            "projects": [
                {"id": str(p.id), "name": p.name, "description": p.description, "created_at": p.created_at.isoformat()}
                for p in projects
            ],
            "scans": [
                {"id": str(s.id), "target_domain": s.target_domain, "status": s.status.value, "created_at": s.created_at.isoformat()}
                for s in scans
            ],
            "api_keys": [
                {"id": str(k.id), "name": k.name, "key_prefix": k.key_prefix, "created_at": k.created_at.isoformat()}
                for k in api_keys
            ],
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }

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
            .where(APIKey.is_active.is_(True))
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