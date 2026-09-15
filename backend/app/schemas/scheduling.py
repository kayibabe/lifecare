from __future__ import annotations
from pydantic import BaseModel, field_validator
from datetime import datetime, date
from app.models.scheduling import ShiftType, ScheduleDepartment, DoctorScheduleStatus, HandoverStatus


def _blank_to_none(v: str | None) -> str | None:
    """The frontend sends '' for an unset optional FK/select field (e.g. 'No
    specific ward'). '' fails a UUID column cast at the DB layer, so treat it
    the same as omitted."""
    if v is not None and not v.strip():
        return None
    return v


def _required_not_blank(v: str) -> str:
    """A required FK/select field left unset by a client-side validation gap
    would otherwise reach the DB as '' and fail the UUID cast there; reject
    it cleanly at the API boundary instead."""
    if not v or not v.strip():
        raise ValueError("Field is required")
    return v


class DoctorScheduleCreate(BaseModel):
    doctor_id: str
    doctor_name: str | None = None
    schedule_date: date
    shift_type: ShiftType
    shift_start_time: str | None = None
    shift_end_time: str | None = None
    department: ScheduleDepartment
    ward_id: str | None = None
    ward_name: str | None = None
    specialty: str | None = None
    notes: str | None = None

    _required_doctor_id = field_validator("doctor_id")(_required_not_blank)
    _blank_ward_id = field_validator("ward_id")(_blank_to_none)


class DoctorScheduleUpdate(BaseModel):
    schedule_date: date | None = None
    shift_type: ShiftType | None = None
    shift_start_time: str | None = None
    shift_end_time: str | None = None
    department: ScheduleDepartment | None = None
    ward_id: str | None = None
    ward_name: str | None = None
    specialty: str | None = None
    notes: str | None = None
    status: DoctorScheduleStatus | None = None

    _blank_ward_id = field_validator("ward_id")(_blank_to_none)


class DoctorScheduleResponse(BaseModel):
    id: str
    doctor_id: str
    doctor_name: str | None
    schedule_date: date
    shift_type: ShiftType
    shift_start_time: str | None
    shift_end_time: str | None
    department: ScheduleDepartment
    ward_id: str | None
    ward_name: str | None
    specialty: str | None
    notes: str | None
    status: DoctorScheduleStatus
    created_by_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DoctorHandoverCreate(BaseModel):
    to_doctor_id: str | None = None
    from_doctor_id: str | None = None
    shift_type: ShiftType
    critical_cases: str | None = None
    pending_investigations: str | None = None
    pending_consults: str | None = None
    treatment_updates: str | None = None
    discharge_planning: str | None = None
    new_admissions: str | None = None
    incidents: str | None = None
    general_notes: str | None = None
    handover_date: datetime | None = None
    active_patients: list | None = None
    linked_patient_ids: list | None = None

    _blank_to_doctor_id = field_validator("to_doctor_id")(_blank_to_none)
    _blank_from_doctor_id = field_validator("from_doctor_id")(_blank_to_none)


class DoctorHandoverUpdate(BaseModel):
    critical_cases: str | None = None
    pending_investigations: str | None = None
    pending_consults: str | None = None
    treatment_updates: str | None = None
    discharge_planning: str | None = None
    new_admissions: str | None = None
    incidents: str | None = None
    general_notes: str | None = None
    active_patients: list | None = None
    linked_patient_ids: list | None = None
    acknowledged: bool | None = None
    status: HandoverStatus | None = None


class DoctorHandoverResponse(BaseModel):
    id: str
    from_doctor_id: str | None
    to_doctor_id: str | None
    shift_type: ShiftType
    critical_cases: str | None
    pending_investigations: str | None
    pending_consults: str | None
    treatment_updates: str | None
    discharge_planning: str | None
    new_admissions: str | None
    incidents: str | None
    general_notes: str | None
    handover_date: datetime
    active_patients: list | None
    linked_patient_ids: list | None
    status: HandoverStatus
    acknowledged: bool
    acknowledged_date: datetime | None
    created_by_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShiftHandoverLogCreate(BaseModel):
    shift_type: str
    handover_to_user_id: str
    handover_from_user_id: str | None = None
    critical_notes: str | None = None
    outstanding_tasks: str | None = None
    pending_lab_results: str | None = None
    pending_imaging: str | None = None
    ward_updates: str | None = None
    pharmacy_requests: str | None = None
    incidents_reported: str | None = None
    handover_date: datetime | None = None

    @field_validator("shift_type")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be blank")
        return v.strip()

    _required_handover_to = field_validator("handover_to_user_id")(_required_not_blank)
    _blank_handover_from = field_validator("handover_from_user_id")(_blank_to_none)


class ShiftHandoverLogAcknowledge(BaseModel):
    acknowledged: bool = True
    acknowledged_by: str | None = None


class ShiftHandoverLogResponse(BaseModel):
    id: str
    shift_type: str
    handover_from_user_id: str | None
    handover_to_user_id: str
    critical_notes: str | None
    outstanding_tasks: str | None
    pending_lab_results: str | None
    pending_imaging: str | None
    ward_updates: str | None
    pharmacy_requests: str | None
    incidents_reported: str | None
    handover_date: datetime
    acknowledged: bool
    acknowledged_by: str | None
    acknowledged_date: datetime | None
    created_by_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
