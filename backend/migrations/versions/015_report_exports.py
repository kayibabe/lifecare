"""Add append-only report export history

Revision ID: 015_report_exports
Revises: 014_dental_module
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "015_report_exports"
down_revision = "014_dental_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_exports",
        sa.Column("id", UUID(as_uuid=False), nullable=False),
        sa.Column("report_type", sa.String(length=80), nullable=False),
        sa.Column("period", sa.String(length=20), nullable=False),
        sa.Column("export_format", sa.String(length=10), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("payload_hash", sa.String(length=64), nullable=False),
        sa.Column("source_revision", sa.String(length=80), nullable=False),
        sa.Column("created_by_id", UUID(as_uuid=False), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_exports_report_type", "report_exports", ["report_type"])
    op.create_index("ix_report_exports_period", "report_exports", ["period"])
    op.create_index("ix_report_exports_created_by_id", "report_exports", ["created_by_id"])


def downgrade() -> None:
    op.drop_index("ix_report_exports_created_by_id", table_name="report_exports")
    op.drop_index("ix_report_exports_period", table_name="report_exports")
    op.drop_index("ix_report_exports_report_type", table_name="report_exports")
    op.drop_table("report_exports")
