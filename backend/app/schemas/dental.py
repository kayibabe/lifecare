from datetime import datetime

from pydantic import BaseModel, Field

from app.models.dental import DentalEncounterStatus, DentalTreatmentStatus


class DentalEncounterCreate(BaseModel):
    patient_id: str
    encounter_id: str | None = None
    chief_complaint: str | None = None
    dental_history: str | None = None
    examination_notes: str | None = None
    diagnosis: str | None = None


class DentalEncounterUpdate(BaseModel):
    chief_complaint: str | None = None
    dental_history: str | None = None
    examination_notes: str | None = None
    diagnosis: str | None = None
    status: DentalEncounterStatus | None = None


class DentalToothFindingCreate(BaseModel):
    tooth_number: str = Field(min_length=1, max_length=8)
    surface: str | None = Field(default=None, max_length=30)
    finding: str = Field(min_length=1, max_length=120)
    severity: str | None = Field(default=None, max_length=30)
    notes: str | None = None


class DentalTreatmentPlanItemCreate(BaseModel):
    procedure_code: str = Field(min_length=1, max_length=30)
    procedure_name: str = Field(min_length=1, max_length=150)
    tooth_number: str | None = Field(default=None, max_length=8)
    fee: float = Field(default=0, ge=0)
    notes: str | None = None


class DentalTreatmentPlanCreate(BaseModel):
    notes: str | None = None
    items: list[DentalTreatmentPlanItemCreate] = Field(default_factory=list)


class DentalTreatmentPlanStatusUpdate(BaseModel):
    status: DentalTreatmentStatus


class DentalEncounterResponse(BaseModel):
    id: str
    encounter_id: str
    patient_id: str
    dentist_id: str
    chief_complaint: str | None
    dental_history: str | None
    examination_notes: str | None
    diagnosis: str | None
    status: DentalEncounterStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DentalToothFindingResponse(DentalToothFindingCreate):
    id: str
    dental_encounter_id: str
    recorded_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DentalTreatmentPlanItemResponse(DentalTreatmentPlanItemCreate):
    id: str
    treatment_plan_id: str
    status: DentalTreatmentStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class DentalTreatmentPlanResponse(BaseModel):
    id: str
    dental_encounter_id: str
    status: DentalTreatmentStatus
    notes: str | None
    estimated_total: float
    created_by: str
    created_at: datetime
    updated_at: datetime
    items: list[DentalTreatmentPlanItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DentalEncounterDetailResponse(DentalEncounterResponse):
    tooth_findings: list[DentalToothFindingResponse] = Field(default_factory=list)
    treatment_plan: DentalTreatmentPlanResponse | None = None
