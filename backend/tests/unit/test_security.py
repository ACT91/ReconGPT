import pytest
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
    decode_token,
)


class TestPasswordHashing:
    def test_password_hash_and_verify(self):
        password = "test_password_123!"
        hashed = get_password_hash(password)
        assert hashed != password
        assert verify_password(password, hashed)
        assert not verify_password("wrong_password", hashed)

    def test_same_password_different_hashes(self):
        password = "test_password"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        assert hash1 != hash2


class TestJWT:
    def test_create_and_verify_access_token(self):
        data = {"sub": "user-123", "email": "test@example.com"}
        token = create_access_token(data)
        assert token is not None
        
        payload = verify_token(token, "access")
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"

    def test_create_and_verify_refresh_token(self):
        data = {"sub": "user-123"}
        token = create_refresh_token(data)
        assert token is not None
        
        payload = verify_token(token, "refresh")
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"

    def test_invalid_token_returns_none(self):
        assert decode_token("invalid-token") is None
        assert verify_token("invalid-token", "access") is None

    def test_expired_token_returns_none(self):
        data = {"sub": "user-123"}
        token = create_access_token(data, expires_delta=-1)
        assert verify_token(token, "access") is None

    def test_wrong_token_type(self):
        data = {"sub": "user-123"}
        access_token = create_access_token(data)
        refresh_token = create_refresh_token(data)
        
        assert verify_token(refresh_token, "access") is None
        assert verify_token(access_token, "refresh") is None