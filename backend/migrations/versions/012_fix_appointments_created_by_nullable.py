"""Ensure appointments.created_by_id is nullable

Revision ID: 012_fix_appointments_created_by_nullable
Revises: 011_patient_portal
Create Date: 2026-09-16

Migration 011 included this ALTER but may have already been stamped in the
production alembic_version table before it was deployed, leaving the NOT NULL
constraint in place.  This migration re-applies it with an explicit guard so
it is safe to run even if the column is already nullable.
"""
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PgUUID

revision = "012_appt_created_by_nullable"
down_revision = "011_patient_portal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # DROP NOT NULL is a no-op in PostgreSQL if the column is already nullable,
    # so no guard is needed — this is safe to run multiple times.
    op.execute(
        "ALTER TABLE appointments ALTER COLUMN created_by_id DROP NOT NULL"
    )


def downgrade() -> None:
    op.alter_column(
        "appointments", "created_by_id",
        existing_type=PgUUID(as_uuid=False),
        nullable=False,
    )
