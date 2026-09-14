"""Persist structured allergies and complete consultation fields.

Revision ID: 009_allergies_consultations
Revises: 008_receipts_handover
Create Date: 2026-09-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PgUUID

revision = "009_allergies_consultations"
down_revision = "008_receipts_handover"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    try:
        inspector = sa.inspect(conn)
        tables = set(inspector.get_table_names())
        encounter_columns = {column["name"] for column in inspector.get_columns("encounters")}
        note_columns = {column["name"] for column in inspector.get_columns("clinical_notes")}
    except sa.exc.NoInspectionAvailable:
        # Alembic's offline SQL mode exposes a mock connection that cannot be
        # inspected. Emit the complete migration in that mode.
        inspector = None
        tables = set()
        encounter_columns = set()
        note_columns = set()

    if "queue_status" not in encounter_columns:
        op.add_column(
            "encounters",
            sa.Column("queue_status", sa.String(30), nullable=False, server_default="waiting"),
        )

    if "patient_allergies" not in tables:
        op.create_table(
            "patient_allergies",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("patient_id", PgUUID(as_uuid=False), sa.ForeignKey("patients.id"), nullable=False),
            sa.Column("allergen", sa.String(200), nullable=False),
            sa.Column("reaction", sa.Text(), nullable=True),
            sa.Column("severity", sa.String(20), nullable=False, server_default="moderate"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_patient_allergies_patient_id", "patient_allergies", ["patient_id"])
    else:
        allergy_indexes = {index["name"] for index in inspector.get_indexes("patient_allergies")}
        if "ix_patient_allergies_patient_id" not in allergy_indexes:
            op.create_index("ix_patient_allergies_patient_id", "patient_allergies", ["patient_id"])

    for column in ("chief_complaint", "history_present_illness", "physical_examination", "clinical_notes"):
        if column not in note_columns:
            op.add_column("clinical_notes", sa.Column(column, sa.Text(), nullable=True))


def downgrade() -> None:
    for column in ("clinical_notes", "physical_examination", "history_present_illness", "chief_complaint"):
        op.drop_column("clinical_notes", column)
    op.drop_index("ix_patient_allergies_patient_id", table_name="patient_allergies")
    op.drop_table("patient_allergies")
    op.drop_column("encounters", "queue_status")
