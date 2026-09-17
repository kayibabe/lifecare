"""Add dental clinic entities and dentist role support."""

from alembic import op
import sqlalchemy as sa

revision = "014_dental_module"
down_revision = "013_appt_created_by_nullable_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # UserRole is the PostgreSQL enum generated from models.user.UserRole.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'dentist'")

    op.create_table(
        "dental_encounters",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("encounter_id", sa.UUID(), nullable=False),
        sa.Column("patient_id", sa.UUID(), nullable=False),
        sa.Column("dentist_id", sa.UUID(), nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("dental_history", sa.Text(), nullable=True),
        sa.Column("examination_notes", sa.Text(), nullable=True),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("open", "treatment_planned", "completed", "referred", name="dentalencounterstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["encounter_id"], ["encounters.id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.ForeignKeyConstraint(["dentist_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("encounter_id"),
    )
    op.create_index("ix_dental_encounters_encounter_id", "dental_encounters", ["encounter_id"])
    op.create_index("ix_dental_encounters_patient_id", "dental_encounters", ["patient_id"])
    op.create_index("ix_dental_encounters_dentist_id", "dental_encounters", ["dentist_id"])

    op.create_table(
        "dental_tooth_findings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("dental_encounter_id", sa.UUID(), nullable=False),
        sa.Column("tooth_number", sa.String(length=8), nullable=False),
        sa.Column("surface", sa.String(length=30), nullable=True),
        sa.Column("finding", sa.String(length=120), nullable=False),
        sa.Column("severity", sa.String(length=30), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dental_encounter_id"], ["dental_encounters.id"]),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dental_tooth_findings_encounter_id", "dental_tooth_findings", ["dental_encounter_id"])
    op.create_index("ix_dental_tooth_findings_tooth_number", "dental_tooth_findings", ["tooth_number"])
    op.create_index("ix_dental_tooth_findings_recorded_by", "dental_tooth_findings", ["recorded_by"])

    op.create_table(
        "dental_treatment_plans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("dental_encounter_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.Enum("proposed", "accepted", "in_progress", "completed", "cancelled", name="dentaltreatmentstatus"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("estimated_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["dental_encounter_id"], ["dental_encounters.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dental_encounter_id"),
    )
    op.create_index("ix_dental_treatment_plans_encounter_id", "dental_treatment_plans", ["dental_encounter_id"])
    op.create_index("ix_dental_treatment_plans_created_by", "dental_treatment_plans", ["created_by"])

    op.create_table(
        "dental_treatment_plan_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("treatment_plan_id", sa.UUID(), nullable=False),
        sa.Column("procedure_code", sa.String(length=30), nullable=False),
        sa.Column("procedure_name", sa.String(length=150), nullable=False),
        sa.Column("tooth_number", sa.String(length=8), nullable=True),
        sa.Column("fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.Enum("proposed", "accepted", "in_progress", "completed", "cancelled", name="dentaltreatmentstatus", create_type=False), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["treatment_plan_id"], ["dental_treatment_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dental_treatment_plan_items_plan_id", "dental_treatment_plan_items", ["treatment_plan_id"])


def downgrade() -> None:
    op.drop_index("ix_dental_treatment_plan_items_plan_id", table_name="dental_treatment_plan_items")
    op.drop_table("dental_treatment_plan_items")
    op.drop_index("ix_dental_treatment_plans_created_by", table_name="dental_treatment_plans")
    op.drop_index("ix_dental_treatment_plans_encounter_id", table_name="dental_treatment_plans")
    op.drop_table("dental_treatment_plans")
    op.drop_index("ix_dental_tooth_findings_recorded_by", table_name="dental_tooth_findings")
    op.drop_index("ix_dental_tooth_findings_tooth_number", table_name="dental_tooth_findings")
    op.drop_index("ix_dental_tooth_findings_encounter_id", table_name="dental_tooth_findings")
    op.drop_table("dental_tooth_findings")
    op.drop_index("ix_dental_encounters_dentist_id", table_name="dental_encounters")
    op.drop_index("ix_dental_encounters_patient_id", table_name="dental_encounters")
    op.drop_index("ix_dental_encounters_encounter_id", table_name="dental_encounters")
    op.drop_table("dental_encounters")
