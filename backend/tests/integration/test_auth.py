import pytest
from httpx import AsyncClient
from app.core.config import settings


pytestmark = pytest.mark.asyncio


class TestAuthAPI:
    async def test_register_user(self, client: AsyncClient):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "StrongP@ss123",
                "full_name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["is_active"] is True
        assert "password" not in data

    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/register",
            json={
                "email": "test@example.com",
                "password": "StrongP@ss123",
            },
        )
        assert response.status_code == 400
        assert "already" in response.json()["detail"].lower()

    async def test_login_success(self, client: AsyncClient, test_user):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpassword123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_invalid_credentials(self, client: AsyncClient):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    async def test_get_current_user(self, client: AsyncClient, auth_headers):
        response = await client.get(
            f"{settings.API_V1_PREFIX}/auth/me",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    async def test_get_current_user_no_auth(self, client: AsyncClient):
        response = await client.get(f"{settings.API_V1_PREFIX}/auth/me")
        assert response.status_code == 401

    async def test_refresh_token(self, client: AsyncClient, test_user):
        login_response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpassword123",
            },
        )
        refresh_token = login_response.json()["refresh_token"]
        
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    async def test_change_password(self, client: AsyncClient, auth_headers):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/change-password",
            json={
                "current_password": "testpassword123",
                "new_password": "NewStrongP@ss456",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_change_password_wrong_current(self, client: AsyncClient, auth_headers):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/auth/change-password",
            json={
                "current_password": "wrongpassword",
                "new_password": "NewStrongP@ss456",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400