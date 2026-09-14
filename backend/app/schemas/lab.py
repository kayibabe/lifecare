from pydantic import BaseModel
from datetime import datetime
from app.models.lab import LabOrderStatus, LabPriority, ResultFlag


class LabTestCreate(BaseModel):
    name: str
    code: str
    category: str
    sample_type: str
    unit: str | None = None
    normal_range_text: str | None = None
    normal_range_male_min: float | None = None
    normal_range_male_max: float | None = None
    normal_range_female_min: float | None = None
    normal_range_female_max: float | None = None
    turnaround_hours: int = 24
    price: float = 0.0


class LabOrderItemCreate(BaseModel):
    test_id: str
    priority: LabPriority = LabPriority.routine
    notes: str | None = None


class LabOrderCreate(BaseModel):
    encounter_id: str
    patient_id: str
    priority: LabPriority = LabPriority.routine
    notes: str | None = None
    items: list[LabOrderItemCreate]


class LabResultCreate(BaseModel):
    result_value: str
    result_unit: str | None = None
    reference_range: str | None = None
    result_flag: ResultFlag | None = None
    notes: str | None = None


class LabStatusUpdate(BaseModel):
    status: LabOrderStatus


class LabTestResponse(BaseModel):
    id: str
    name: str
    code: str
    category: str
    sample_type: str
    unit: str | None
    normal_range_text: str | None
    turnaround_hours: int
    price: float
    is_active: bool

    model_config = {"from_attributes": True}


class LabOrderItemResponse(BaseModel):
    id: str
    lab_order_id: str
    test_id: str
    sample_type: str | None
    result_value: str | None
    result_unit: str | None
    reference_range: str | None
    result_flag: ResultFlag | None
    resulted_at: datetime | None
    verified_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class LabOrderListResponse(BaseModel):
    id: str
    encounter_id: str
    patient_id: str
    ordered_by_id: str
    order_date: datetime
    status: LabOrderStatus
    priority: LabPriority
    created_at: datetime

    model_config = {"from_attributes": True}


class LabOrderResponse(LabOrderListResponse):
    notes: str | None
    updated_at: datetime
    items: list[LabOrderItemResponse] = []
