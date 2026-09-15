from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from app.models.patient import Gender, BloodGroup
from app.models.appointment import AppointmentType


class PatientLoginRequest(BaseModel):
    mrn: str
    phone: str

    @field_validator("mrn")
    @classmethod
    def normalize_mrn(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        # Keep only digits so "099 123 4567" / "+265991234567" style input
        # still matches what's stored, without guessing at country-code
        # formatting rules here.
        return "".join(c for c in v if c.isdigit())


class PatientTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PatientRefreshRequest(BaseModel):
    refresh_token: str


class CurrentPatientResponse(BaseModel):
    id: str
    mrn: str
    first_name: str
    last_name: str
    gender: Gender
    date_of_birth: date | None
    phone: str | None
    email: str | None
    blood_group: BloodGroup

    model_config = {"from_attributes": True}


class PatientMessageResponse(BaseModel):
    id: str
    patient_id: str
    subject: str
    body: str
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientAppointmentCreate(BaseModel):
    """Same as AppointmentCreate but without patient_id — the patient portal
    never accepts a client-supplied patient_id, only the authenticated
    patient's own identity."""
    provider_id: str | None = None
    scheduled_datetime: datetime
    duration_minutes: int = Field(15, ge=5, le=480)
    appointment_type: AppointmentType = AppointmentType.opd
    visit_reason: str | None = None
    notes: str | None = None

    @field_validator("scheduled_datetime")
    @classmethod
    def must_be_future(cls, v: datetime) -> datetime:
        from datetime import timezone
        now = datetime.now(timezone.utc)
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        if v <= now:
            raise ValueError("scheduled_datetime must be in the future")
        return v


class PatientMessageCreate(BaseModel):
    subject: str
    body: str

    @field_validator("subject", "body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()
