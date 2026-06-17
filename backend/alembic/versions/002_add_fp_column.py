"""add_is_false_positive_to_vulnerabilities

Revision ID: 002_add_fp_column
Revises: 001_initial_schema
Create Date: 2026-06-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '002_add_fp_column'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_false_positive column to vulnerabilities table
    op.add_column('vulnerabilities', sa.Column('is_false_positive', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    # Remove is_false_positive column
    op.drop_column('vulnerabilities', 'is_false_positive')
