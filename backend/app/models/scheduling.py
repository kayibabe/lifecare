from __future__ import annotations

import uuid
import enum
from datetime import datetime, date, timezone
from sqlalchemy import String, Date, DateTime, Enum as SAEnum, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class ShiftType(str, enum.Enum):
    morning = "morning"
    afternoon = "afternoon"
    night = "night"
    weekend = "weekend"
    on_call = "on_call"


class ScheduleDepartment(str, enum.Enum):
    reception = "reception"
    clinical = "clinical"
    lab = "lab"
    imaging = "imaging"
    pharmacy = "pharmacy"
    nursing = "nursing"
    inpatient = "inpatient"
    maternal = "maternal"
    theatre = "theatre"
    emergency = "emergency"


class DoctorScheduleStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    swapped = "swapped"
    cancelled = "cancelled"


class HandoverStatus(str, enum.Enum):
    pending = "pending"
    acknowledged = "acknowledged"


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    doctor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # Denormalized display copy — the frontend sends this at booking time so
    # the roster can render without a join; not authoritative (users.full_name is).
    doctor_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    shift_type: Mapped[ShiftType] = mapped_column(SAEnum(ShiftType), nullable=False)
    shift_start_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    shift_end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    department: Mapped[ScheduleDepartment] = mapped_column(SAEnum(ScheduleDepartment), nullable=False, index=True)
    ward_id: Mapped[str | None] = mapped_column(ForeignKey("wards.id"), nullable=True, index=True)
    ward_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    specialty: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[DoctorScheduleStatus] = mapped_column(
        SAEnum(DoctorScheduleStatus), default=DoctorScheduleStatus.scheduled, nullable=False
    )
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    doctor: Mapped["User"] = relationship(foreign_keys=[doctor_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])


class DoctorHandover(Base):
    __tablename__ = "doctor_handovers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_doctor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    to_doctor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    shift_type: Mapped[ShiftType] = mapped_column(SAEnum(ShiftType), nullable=False)

    critical_cases: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_investigations: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_consults: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_updates: Mapped[str | None] = mapped_column(Text, nullable=True)
    discharge_planning: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_admissions: Mapped[str | None] = mapped_column(Text, nullable=True)
    incidents: Mapped[str | None] = mapped_column(Text, nullable=True)
    general_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    handover_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # Lightweight patient linkage — a JSON array rather than a join table,
    # matching how the frontend already builds/reads these (audit: acceptable
    # for MVP; revisit as a normalized table if handover volume grows).
    active_patients: Mapped[list | None] = mapped_column(JSON, nullable=True)
    linked_patient_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    status: Mapped[HandoverStatus] = mapped_column(SAEnum(HandoverStatus), default=HandoverStatus.pending, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acknowledged_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    from_doctor: Mapped["User | None"] = relationship(foreign_keys=[from_doctor_id])
    to_doctor: Mapped["User | None"] = relationship(foreign_keys=[to_doctor_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])


class ShiftHandoverLog(Base):
    """Department-level (non-clinician) shift handover — distinct from
    DoctorHandover (which is clinician-to-clinician and patient-centric).
    shift_type here is department-based (reception/nursing/pharmacy/...),
    not time-of-day."""
    __tablename__ = "shift_handover_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shift_type: Mapped[str] = mapped_column(String(20), nullable=False)
    handover_from_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    handover_to_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    critical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    outstanding_tasks: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_lab_results: Mapped[str | None] = mapped_column(Text, nullable=True)
    pending_imaging: Mapped[str | None] = mapped_column(Text, nullable=True)
    ward_updates: Mapped[str | None] = mapped_column(Text, nullable=True)
    pharmacy_requests: Mapped[str | None] = mapped_column(Text, nullable=True)
    incidents_reported: Mapped[str | None] = mapped_column(Text, nullable=True)

    handover_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Free-text acknowledger label — the frontend does not yet pass a real
    # user id here, just a role-ish string; stored as-is rather than a FK.
    acknowledged_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    acknowledged_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    handover_from: Mapped["User | None"] = relationship(foreign_keys=[handover_from_user_id])
    handover_to: Mapped["User"] = relationship(foreign_keys=[handover_to_user_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
