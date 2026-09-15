from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import require_patient
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.billing import BillingInvoice
from app.models.encounter import Encounter
from app.models.lab import LabOrder, LabOrderItem, LabTest
from app.models.patient_message import PatientMessage
from app.schemas.appointment import AppointmentListResponse, AppointmentResponse
from app.schemas.billing import InvoiceListResponse
from app.schemas.encounter import EncounterListResponse
from app.schemas.patient_auth import PatientMessageResponse, PatientAppointmentCreate
import uuid

# Reuses the same overlap-conflict check appointments.py uses for staff
# bookings — patients booking their own appointment should be subject to
# the identical double-booking rule.
from app.routers.appointments import _check_double_booking

router = APIRouter(prefix="/patient", tags=["patient-portal"])


@router.get("/appointments", response_model=list[AppointmentListResponse])
async def list_my_appointments(
    skip: int = 0,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    stmt = (
        select(Appointment)
        .where(Appointment.patient_id == current_patient.id)
        .order_by(Appointment.scheduled_datetime.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def book_my_appointment(
    body: PatientAppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    # Ownership is enforced server-side — patient_id is never taken from
    # the client body, only from the authenticated patient identity.
    if body.provider_id:
        conflict = await _check_double_booking(
            db, body.provider_id, body.scheduled_datetime, body.duration_minutes
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That provider already has an appointment overlapping this time slot.",
            )

    appt = Appointment(
        id=str(uuid.uuid4()),
        patient_id=current_patient.id,
        provider_id=body.provider_id,
        scheduled_datetime=body.scheduled_datetime,
        duration_minutes=body.duration_minutes,
        appointment_type=body.appointment_type,
        visit_reason=body.visit_reason,
        notes=body.notes,
        created_by_id=None,
    )
    db.add(appt)
    await db.flush()
    await db.refresh(appt)
    return appt


@router.get("/invoices", response_model=list[InvoiceListResponse])
async def list_my_invoices(
    skip: int = 0,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    stmt = (
        select(BillingInvoice)
        .where(BillingInvoice.patient_id == current_patient.id)
        .order_by(BillingInvoice.invoice_date.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/encounters", response_model=list[EncounterListResponse])
async def list_my_encounters(
    skip: int = 0,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    stmt = (
        select(Encounter)
        .where(Encounter.patient_id == current_patient.id)
        .order_by(Encounter.encounter_date.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/lab-results")
async def list_my_lab_results(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    """Same flattened shape as GET /lab/results (staff-facing), scoped to
    the authenticated patient only."""
    stmt = (
        select(LabOrderItem, LabOrder, LabTest)
        .join(LabOrder, LabOrderItem.lab_order_id == LabOrder.id)
        .join(LabTest, LabOrderItem.test_id == LabTest.id)
        .where(LabOrderItem.result_value.is_not(None), LabOrder.patient_id == current_patient.id)
        .order_by(LabOrderItem.resulted_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": item.id,
            "lab_order_id": item.lab_order_id,
            "test_name": test.name,
            "result_value": item.result_value,
            "result_unit": item.result_unit or test.unit,
            "reference_range": item.reference_range or test.normal_range_text,
            "result_flag": item.result_flag.value if item.result_flag else None,
            "resulted_at": item.resulted_at,
        }
        for item, order, test in rows
    ]


@router.get("/messages", response_model=list[PatientMessageResponse])
async def list_my_messages(
    skip: int = 0,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    stmt = (
        select(PatientMessage)
        .where(PatientMessage.patient_id == current_patient.id)
        .order_by(PatientMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/messages/{message_id}/read", response_model=PatientMessageResponse)
async def mark_message_read(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(require_patient()),
):
    result = await db.execute(
        select(PatientMessage).where(
            PatientMessage.id == message_id, PatientMessage.patient_id == current_patient.id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.read_at is None:
        message.read_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(message)
    return message
