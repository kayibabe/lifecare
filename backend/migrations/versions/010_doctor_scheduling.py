"""Add doctor_schedules, doctor_handovers, and shift_handover_logs tables

Revision ID: 010_doctor_scheduling
Revises: 009_allergies_consultations
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum, UUID as PgUUID

revision = "010_doctor_scheduling"
down_revision = "009_allergies_consultations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE shifttype AS ENUM
                ('morning', 'afternoon', 'night', 'weekend', 'on_call');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE scheduledepartment AS ENUM
                ('reception', 'clinical', 'lab', 'imaging', 'pharmacy', 'nursing',
                 'inpatient', 'maternal', 'theatre', 'emergency');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE doctorschedulestatus AS ENUM
                ('scheduled', 'confirmed', 'swapped', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE handoverstatus AS ENUM ('pending', 'acknowledged');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    conn = op.get_bind()
    try:
        existing = sa.inspect(conn).get_table_names()
    except Exception:
        existing = []

    if "doctor_schedules" not in existing:
        op.create_table(
            "doctor_schedules",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("doctor_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("doctor_name", sa.String(150), nullable=True),
            sa.Column("schedule_date", sa.Date, nullable=False, index=True),
            sa.Column("shift_type",
                      PgEnum("morning", "afternoon", "night", "weekend", "on_call",
                             name="shifttype", create_type=False),
                      nullable=False),
            sa.Column("shift_start_time", sa.String(5), nullable=True),
            sa.Column("shift_end_time", sa.String(5), nullable=True),
            sa.Column("department",
                      PgEnum("reception", "clinical", "lab", "imaging", "pharmacy",
                             "nursing", "inpatient", "maternal", "theatre", "emergency",
                             name="scheduledepartment", create_type=False),
                      nullable=False, index=True),
            sa.Column("ward_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("wards.id"), nullable=True, index=True),
            sa.Column("ward_name", sa.String(100), nullable=True),
            sa.Column("specialty", sa.String(100), nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("status",
                      PgEnum("scheduled", "confirmed", "swapped", "cancelled",
                             name="doctorschedulestatus", create_type=False),
                      nullable=False, server_default="scheduled"),
            sa.Column("created_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )

    if "doctor_handovers" not in existing:
        op.create_table(
            "doctor_handovers",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("from_doctor_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("to_doctor_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("shift_type",
                      PgEnum("morning", "afternoon", "night", "weekend", "on_call",
                             name="shifttype", create_type=False),
                      nullable=False),
            sa.Column("critical_cases", sa.Text, nullable=True),
            sa.Column("pending_investigations", sa.Text, nullable=True),
            sa.Column("pending_consults", sa.Text, nullable=True),
            sa.Column("treatment_updates", sa.Text, nullable=True),
            sa.Column("discharge_planning", sa.Text, nullable=True),
            sa.Column("new_admissions", sa.Text, nullable=True),
            sa.Column("incidents", sa.Text, nullable=True),
            sa.Column("general_notes", sa.Text, nullable=True),
            sa.Column("handover_date", sa.DateTime(timezone=True), nullable=False, index=True),
            sa.Column("active_patients", sa.JSON, nullable=True),
            sa.Column("linked_patient_ids", sa.JSON, nullable=True),
            sa.Column("status",
                      PgEnum("pending", "acknowledged", name="handoverstatus", create_type=False),
                      nullable=False, server_default="pending"),
            sa.Column("acknowledged", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("acknowledged_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )

    if "shift_handover_logs" not in existing:
        op.create_table(
            "shift_handover_logs",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("shift_type", sa.String(20), nullable=False),
            sa.Column("handover_from_user_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("handover_to_user_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("critical_notes", sa.Text, nullable=True),
            sa.Column("outstanding_tasks", sa.Text, nullable=True),
            sa.Column("pending_lab_results", sa.Text, nullable=True),
            sa.Column("pending_imaging", sa.Text, nullable=True),
            sa.Column("ward_updates", sa.Text, nullable=True),
            sa.Column("pharmacy_requests", sa.Text, nullable=True),
            sa.Column("incidents_reported", sa.Text, nullable=True),
            sa.Column("handover_date", sa.DateTime(timezone=True), nullable=False, index=True),
            sa.Column("acknowledged", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("acknowledged_by", sa.String(100), nullable=True),
            sa.Column("acknowledged_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("shift_handover_logs")
    op.drop_table("doctor_handovers")
    op.drop_table("doctor_schedules")
    op.execute("DROP TYPE IF EXISTS handoverstatus")
    op.execute("DROP TYPE IF EXISTS doctorschedulestatus")
    op.execute("DROP TYPE IF EXISTS scheduledepartment")
    op.execute("DROP TYPE IF EXISTS shifttype")
