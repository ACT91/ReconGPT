"""Initial database schema

Revision ID: 001
Revises:
Create Date: 2026-06-14 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON, ARRAY, INET
import uuid

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_users_email_active", "users", ["email", "is_active"])

    op.create_table(
        "api_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_api_keys_user_active", "api_keys", ["user_id", "is_active"])

    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_domains", ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("settings", JSON(), nullable=True, server_default="{}"),
        sa.Column("is_active", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_projects_owner_active", "projects", ["owner_id", "is_active"])
    op.create_index("ix_projects_name_owner", "projects", ["name", "owner_id"])

    op.create_table(
        "scan_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("target_domain", sa.String(255), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("current_stage", sa.String(30), nullable=True, index=True),
        sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("celery_task_id", sa.String(100), nullable=True, index=True),
        sa.Column("parent_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id"), nullable=True),
        sa.Column("scan_config", JSON(), nullable=True, server_default="{}"),
        sa.Column("scan_metadata", JSON(), nullable=True, server_default="{}"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_scan_jobs_owner_status", "scan_jobs", ["owner_id", "status"])
    op.create_index("ix_scan_jobs_project_status", "scan_jobs", ["project_id", "status"])
    op.create_index("ix_scan_jobs_target_status", "scan_jobs", ["target_domain", "status"])

    op.create_table(
        "subdomains",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("scan_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="discovered", index=True),
        sa.Column("ips", ARRAY(sa.String()), nullable=True, server_default="{}"),
        sa.Column("cname", sa.String(255), nullable=True),
        sa.Column("cname_chain", ARRAY(sa.String()), nullable=True, server_default="{}"),
        sa.Column("is_alive", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("content_length", sa.Integer(), nullable=True),
        sa.Column("technologies", ARRAY(sa.String()), nullable=True, server_default="{}"),
        sa.Column("web_server", sa.String(255), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("tls_info", JSON(), nullable=True),
        sa.Column("headers", JSON(), nullable=True),
        sa.Column("ports", ARRAY(sa.Integer()), nullable=True, server_default="{}"),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("probed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_subdomains_job_name", "subdomains", ["scan_job_id", "name"], unique=True)
    op.create_index("ix_subdomains_job_status", "subdomains", ["scan_job_id", "status"])
    op.create_index("ix_subdomains_job_alive", "subdomains", ["scan_job_id", "is_alive"])

    op.create_table(
        "endpoints",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("scan_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("subdomain_id", UUID(as_uuid=True), sa.ForeignKey("subdomains.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("normalized_url", sa.Text(), nullable=False, index=True),
        sa.Column("path", sa.Text(), nullable=True),
        sa.Column("method", sa.String(10), nullable=False, server_default="GET"),
        sa.Column("source", sa.String(20), nullable=False, server_default="crawl", index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="unknown", index=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("content_length", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("technologies", ARRAY(sa.String()), nullable=True, server_default="{}"),
        sa.Column("headers", JSON(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("parameters", JSON(), nullable=True, server_default="{}"),
        sa.Column("forms", JSON(), nullable=True, server_default="[]"),
        sa.Column("cookies", JSON(), nullable=True, server_default="{}"),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("probed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_endpoints_job_normalized", "endpoints", ["scan_job_id", "normalized_url"], unique=True)
    op.create_index("ix_endpoints_job_source", "endpoints", ["scan_job_id", "source"])
    op.create_index("ix_endpoints_job_status", "endpoints", ["scan_job_id", "status"])

    op.create_table(
        "js_files",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("scan_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("subdomain_id", UUID(as_uuid=True), sa.ForeignKey("subdomains.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("endpoint_id", UUID(as_uuid=True), sa.ForeignKey("endpoints.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("local_path", sa.Text(), nullable=True),
        sa.Column("content_hash", sa.String(64), nullable=True, index=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("downloaded", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("analyzed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("endpoints_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("secrets_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("api_endpoints", JSON(), nullable=True, server_default="[]"),
        sa.Column("secrets", JSON(), nullable=True, server_default="[]"),
        sa.Column("technologies", JSON(), nullable=True, server_default="[]"),
        sa.Column("content_preview", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("downloaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_js_files_job_hash", "js_files", ["scan_job_id", "content_hash"])
    op.create_index("ix_js_files_job_downloaded", "js_files", ["scan_job_id", "downloaded"])
    op.create_index("ix_js_files_job_analyzed", "js_files", ["scan_job_id", "analyzed"])

    op.create_table(
        "vulnerabilities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("scan_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("endpoint_id", UUID(as_uuid=True), sa.ForeignKey("endpoints.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("template_id", sa.String(100), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new", index=True),
        sa.Column("cvss_score", sa.Float(), nullable=True),
        sa.Column("cvss_vector", sa.String(100), nullable=True),
        sa.Column("cwe_ids", JSON(), nullable=True, server_default="[]"),
        sa.Column("cve_ids", JSON(), nullable=True, server_default="[]"),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("matched_at", sa.Text(), nullable=True),
        sa.Column("extracted_results", JSON(), nullable=True),
        sa.Column("request", sa.Text(), nullable=True),
        sa.Column("response", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("remediation", sa.Text(), nullable=True),
        sa.Column("references", JSON(), nullable=True, server_default="[]"),
        sa.Column("tags", JSON(), nullable=True, server_default="[]"),
        sa.Column("matcher_name", sa.String(100), nullable=True),
        sa.Column("matcher_type", sa.String(50), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_vulns_job_severity", "vulnerabilities", ["scan_job_id", "severity"])
    op.create_index("ix_vulns_job_status", "vulnerabilities", ["scan_job_id", "status"])
    op.create_index("ix_vulns_template", "vulnerabilities", ["template_id"])

    op.create_table(
        "ai_insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("scan_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("insight_type", sa.String(30), nullable=False, index=True),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium", index=True),
        sa.Column("priority_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("affected_assets", JSON(), nullable=True, server_default="[]"),
        sa.Column("related_vulnerabilities", JSON(), nullable=True, server_default="[]"),
        sa.Column("related_subdomains", JSON(), nullable=True, server_default="[]"),
        sa.Column("related_endpoints", JSON(), nullable=True, server_default="[]"),
        sa.Column("metadata", JSON(), nullable=True, server_default="{}"),
        sa.Column("model_used", sa.String(50), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("is_actionable", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_dismissed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_index("ix_insights_job_type", "ai_insights", ["scan_job_id", "insight_type"])
    op.create_index("ix_insights_job_priority", "ai_insights", ["scan_job_id", "priority"])

    op.create_table(
        "pipeline_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("scan_job_id", UUID(as_uuid=True), sa.ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("stage", sa.String(30), nullable=True, index=True),
        sa.Column("level", sa.String(10), nullable=False, server_default="info", index=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("details", JSON(), nullable=True, server_default="{}"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.String(100), nullable=True, index=True),
        sa.Column("worker_id", sa.String(100), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True),
    )

    op.create_index("ix_pipeline_logs_job_stage", "pipeline_logs", ["scan_job_id", "stage"])
    op.create_index("ix_pipeline_logs_job_level", "pipeline_logs", ["scan_job_id", "level"])


def downgrade() -> None:
    op.drop_table("pipeline_logs")
    op.drop_table("ai_insights")
    op.drop_table("vulnerabilities")
    op.drop_table("js_files")
    op.drop_table("endpoints")
    op.drop_table("subdomains")
    op.drop_table("scan_jobs")
    op.drop_table("projects")
    op.drop_table("api_keys")
    op.drop_table("users")