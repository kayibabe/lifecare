from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DentalEncounterStatus(str, enum.Enum):
    open = "open"
    treatment_planned = "treatment_planned"
    completed = "completed"
    referred = "referred"


class DentalTreatmentStatus(str, enum.Enum):
    proposed = "proposed"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class DentalEncounter(Base):
    __tablename__ = "dental_encounters"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.id"), nullable=False, unique=True, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    dentist_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    dental_history: Mapped[str | None] = mapped_column(Text, nullable=True)
    examination_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[DentalEncounterStatus] = mapped_column(
        SAEnum(DentalEncounterStatus), nullable=False, default=DentalEncounterStatus.open
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class DentalToothFinding(Base):
    __tablename__ = "dental_tooth_findings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    dental_encounter_id: Mapped[str] = mapped_column(ForeignKey("dental_encounters.id"), nullable=False, index=True)
    tooth_number: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    surface: Mapped[str | None] = mapped_column(String(30), nullable=True)
    finding: Mapped[str] = mapped_column(String(120), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class DentalTreatmentPlan(Base):
    __tablename__ = "dental_treatment_plans"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    dental_encounter_id: Mapped[str] = mapped_column(ForeignKey("dental_encounters.id"), nullable=False, unique=True, index=True)
    status: Mapped[DentalTreatmentStatus] = mapped_column(
        SAEnum(DentalTreatmentStatus), nullable=False, default=DentalTreatmentStatus.proposed
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class DentalTreatmentPlanItem(Base):
    __tablename__ = "dental_treatment_plan_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    treatment_plan_id: Mapped[str] = mapped_column(ForeignKey("dental_treatment_plans.id"), nullable=False, index=True)
    procedure_code: Mapped[str] = mapped_column(String(30), nullable=False)
    procedure_name: Mapped[str] = mapped_column(String(150), nullable=False)
    tooth_number: Mapped[str | None] = mapped_column(String(8), nullable=True)
    fee: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    status: Mapped[DentalTreatmentStatus] = mapped_column(
        SAEnum(DentalTreatmentStatus), nullable=False, default=DentalTreatmentStatus.proposed
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
