"""Add dental clinic entities and dentist role support.

Idempotent because the application historically used SQLAlchemy create_all
before Alembic was introduced.
"""

from alembic import op

revision = "014_dental_module"
down_revision = "013_appt_created_by_nullable_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'dentist'")
    op.execute("""DO $$ BEGIN
        CREATE TYPE dentalencounterstatus AS ENUM ('open', 'treatment_planned', 'completed', 'referred');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;""")
    op.execute("""DO $$ BEGIN
        CREATE TYPE dentaltreatmentstatus AS ENUM ('proposed', 'accepted', 'in_progress', 'completed', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;""")
    op.execute("""
        CREATE TABLE IF NOT EXISTS dental_encounters (
            id UUID PRIMARY KEY, encounter_id UUID NOT NULL UNIQUE REFERENCES encounters(id),
            patient_id UUID NOT NULL REFERENCES patients(id), dentist_id UUID NOT NULL REFERENCES users(id),
            chief_complaint TEXT, dental_history TEXT, examination_notes TEXT, diagnosis TEXT,
            status dentalencounterstatus NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS dental_tooth_findings (
            id UUID PRIMARY KEY, dental_encounter_id UUID NOT NULL REFERENCES dental_encounters(id),
            tooth_number VARCHAR(8) NOT NULL, surface VARCHAR(30), finding VARCHAR(120) NOT NULL,
            severity VARCHAR(30), notes TEXT, recorded_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS dental_treatment_plans (
            id UUID PRIMARY KEY, dental_encounter_id UUID NOT NULL UNIQUE REFERENCES dental_encounters(id),
            status dentaltreatmentstatus NOT NULL, notes TEXT, estimated_total NUMERIC(12, 2) NOT NULL,
            created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS dental_treatment_plan_items (
            id UUID PRIMARY KEY, treatment_plan_id UUID NOT NULL REFERENCES dental_treatment_plans(id),
            procedure_code VARCHAR(30) NOT NULL, procedure_name VARCHAR(150) NOT NULL, tooth_number VARCHAR(8),
            fee NUMERIC(12, 2) NOT NULL, status dentaltreatmentstatus NOT NULL, notes TEXT, created_at TIMESTAMPTZ NOT NULL
        )
    """)
    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_dental_encounters_encounter_id ON dental_encounters(encounter_id)",
        "CREATE INDEX IF NOT EXISTS ix_dental_encounters_patient_id ON dental_encounters(patient_id)",
        "CREATE INDEX IF NOT EXISTS ix_dental_encounters_dentist_id ON dental_encounters(dentist_id)",
        "CREATE INDEX IF NOT EXISTS ix_dental_tooth_findings_encounter_id ON dental_tooth_findings(dental_encounter_id)",
        "CREATE INDEX IF NOT EXISTS ix_dental_tooth_findings_tooth_number ON dental_tooth_findings(tooth_number)",
        "CREATE INDEX IF NOT EXISTS ix_dental_tooth_findings_recorded_by ON dental_tooth_findings(recorded_by)",
        "CREATE INDEX IF NOT EXISTS ix_dental_treatment_plans_encounter_id ON dental_treatment_plans(dental_encounter_id)",
        "CREATE INDEX IF NOT EXISTS ix_dental_treatment_plans_created_by ON dental_treatment_plans(created_by)",
        "CREATE INDEX IF NOT EXISTS ix_dental_treatment_plan_items_plan_id ON dental_treatment_plan_items(treatment_plan_id)",
    ):
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dental_treatment_plan_items")
    op.execute("DROP TABLE IF EXISTS dental_treatment_plans")
    op.execute("DROP TABLE IF EXISTS dental_tooth_findings")
    op.execute("DROP TABLE IF EXISTS dental_encounters")
    op.execute("DROP TYPE IF EXISTS dentaltreatmentstatus")
    op.execute("DROP TYPE IF EXISTS dentalencounterstatus")
