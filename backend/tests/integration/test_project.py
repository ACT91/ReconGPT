import pytest
from httpx import AsyncClient
from app.core.config import settings


pytestmark = pytest.mark.asyncio


class TestProjectsAPI:
    async def test_create_project(self, client: AsyncClient, auth_headers):
        response = await client.post(
            f"{settings.API_V1_PREFIX}/projects",
            json={
                "name": "My Test Project",
                "description": "A project for testing",
                "target_domains": ["example.com", "test.org"],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Test Project"
        assert data["description"] == "A project for testing"
        assert len(data["target_domains"]) == 2

    async def test_list_projects(self, client: AsyncClient, auth_headers):
        response = await client.get(
            f"{settings.API_V1_PREFIX}/projects",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_get_project(self, client: AsyncClient, auth_headers, test_project):
        response = await client.get(
            f"{settings.API_V1_PREFIX}/projects/{test_project.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == test_project.name

    async def test_get_project_stats(self, client: AsyncClient, auth_headers, test_project):
        response = await client.get(
            f"{settings.API_V1_PREFIX}/projects/{test_project.id}/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_scans" in data
        assert "total_subdomains" in data

    async def test_update_project(self, client: AsyncClient, auth_headers, test_project):
        response = await client.patch(
            f"{settings.API_V1_PREFIX}/projects/{test_project.id}",
            json={"name": "Updated Project Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Project Name"

    async def test_delete_project(self, client: AsyncClient, auth_headers, test_project):
        response = await client.delete(
            f"{settings.API_V1_PREFIX}/projects/{test_project.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_project_not_found(self, client: AsyncClient, auth_headers):
        from uuid import uuid4
        response = await client.get(
            f"{settings.API_V1_PREFIX}/projects/{uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404