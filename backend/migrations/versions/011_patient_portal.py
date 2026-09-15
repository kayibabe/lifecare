"""Add patient_messages table; allow patient-booked appointments

Revision ID: 011_patient_portal
Revises: 010_doctor_scheduling
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PgUUID

revision = "011_patient_portal"
down_revision = "010_doctor_scheduling"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    try:
        existing = sa.inspect(conn).get_table_names()
    except Exception:
        existing = []

    if "patient_messages" not in existing:
        op.create_table(
            "patient_messages",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("patient_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("subject", sa.String(200), nullable=False),
            sa.Column("body", sa.Text, nullable=False),
            sa.Column("created_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      index=True, server_default=sa.func.now()),
        )

    # Appointments booked by a patient through the patient portal have no
    # staff creator.
    op.alter_column(
        "appointments", "created_by_id",
        existing_type=PgUUID(as_uuid=False),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "appointments", "created_by_id",
        existing_type=PgUUID(as_uuid=False),
        nullable=False,
    )
    op.drop_table("patient_messages")
