"""add security and GDPR compliance fields to users

Revision ID: 003_add_security_gdpr_fields
Revises: 002_add_fp_column
Create Date: 2026-06-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers
revision = '003_add_security_gdpr_fields'
down_revision = '002_add_fp_column'
branch_labels = None
depends_on = None


def upgrade():
    # Add account verification field
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add security hardening fields
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))
    
    # Add GDPR compliance field
    op.add_column('users', sa.Column('accepted_tos_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    # Remove GDPR field
    op.drop_column('users', 'accepted_tos_at')
    
    # Remove security hardening fields
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    
    # Remove account verification field
    op.drop_column('users', 'is_verified')
