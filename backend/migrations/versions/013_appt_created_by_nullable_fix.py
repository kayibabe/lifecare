"""Re-apply DROP NOT NULL on appointments.created_by_id

Revision ID: 013_appt_created_by_nullable_fix
Revises: 012_appt_created_by_nullable
Create Date: 2026-09-16

Migration 012 was stamped in alembic_version before its DDL ran (the guard
used op.get_bind() which silently no-ops in async context). This migration
re-applies the same idempotent DDL so the constraint is removed.
"""
from alembic import op

revision = "013_appt_created_by_nullable_fix"
down_revision = "012_appt_created_by_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent in PostgreSQL: no-op if the column is already nullable.
    op.execute(
        "ALTER TABLE appointments ALTER COLUMN created_by_id DROP NOT NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE appointments ALTER COLUMN created_by_id SET NOT NULL"
    )
