from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import require_role
from app.core.audit import log_action
from app.models.user import User, UserRole
from app.models.patient import Patient, PatientAllergy
from app.models.patient_message import PatientMessage
from app.schemas.patient import (
    PatientCreate, PatientUpdate, PatientResponse, PatientListResponse,
    PatientAllergyCreate, PatientAllergyResponse,
)
from app.schemas.patient_auth import PatientMessageCreate, PatientMessageResponse
import uuid
import random
import string

router = APIRouter(prefix="/patients", tags=["patients"])

_MRN_CHARS = string.ascii_uppercase + string.digits  # A-Z + 0-9 → 36 chars, 36^5 ≈ 60.5M combinations


async def _generate_mrn(db: AsyncSession) -> str:
    """Generate a unique LC-XXXXX patient ID (5 random uppercase alphanumeric chars).
    Retries on the rare collision; the search space is ~60.5 million so this almost
    never loops more than once even at large patient volumes."""
    for _ in range(20):
        suffix = "".join(random.choices(_MRN_CHARS, k=5))
        candidate = f"LC-{suffix}"
        exists = (await db.execute(select(Patient.id).where(Patient.mrn == candidate))).first()
        if not exists:
            return candidate
    raise RuntimeError("Unable to generate a unique MRN after 20 attempts — this should never happen")


@router.get("", response_model=list[PatientListResponse])
async def list_patients(
    q: str | None = Query(None, max_length=100, description="Search by name, MRN, or phone"),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse, UserRole.clinician)),
):
    stmt = select(Patient).where(Patient.is_deleted == False)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Patient.first_name.ilike(pattern),
                Patient.last_name.ilike(pattern),
                Patient.mrn.ilike(pattern),
                Patient.phone.ilike(pattern),
            )
        )
    stmt = stmt.order_by(Patient.last_name, Patient.first_name).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    body: PatientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse)),
):
    # S12 — Under-18 consent gate: if patient is a minor, consent and a guardian
    # contact are mandatory. Enforced here rather than in the schema so the check
    # has access to today's date and remains consistent across all call sites.
    if body.date_of_birth is not None:
        today = date.today()
        age_years = (today - body.date_of_birth).days // 365
        if age_years < 18:
            if not body.consent_given:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Patients under 18 require consent_given=true (MDA 2024 §4.2). "
                           "A parent or guardian must give consent before registration proceeds.",
                )
            if not (body.emergency_contact_name or body.emergency_contact_phone):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Patients under 18 require a guardian contact "
                           "(emergency_contact_name or emergency_contact_phone).",
                )

    # S16 — Duplicate detection: block if an active patient with the same
    # phone AND last name already exists (case-insensitive). Returns the
    # existing MRN so the receptionist can look them up instead of re-registering.
    if body.phone:
        normalised_phone = "".join(c for c in body.phone if c.isdigit())
        dup_stmt = (
            select(Patient)
            .where(
                Patient.is_deleted == False,
                Patient.last_name.ilike(body.last_name),
            )
        )
        dup_result = await db.execute(dup_stmt)
        candidates = dup_result.scalars().all()
        for candidate in candidates:
            if candidate.phone:
                candidate_phone = "".join(c for c in candidate.phone if c.isdigit())
                if candidate_phone == normalised_phone:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "message": "A patient with this name and phone number already exists.",
                            "existing_mrn": candidate.mrn,
                            "existing_id": candidate.id,
                            "hint": "Look up the existing patient by MRN before registering a new record.",
                        },
                    )

    mrn = await _generate_mrn(db)

    patient = Patient(
        id=str(uuid.uuid4()),
        mrn=mrn,
        **body.model_dump(),
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient)

    await log_action(
        db, action="create", entity_type="patient",
        user_id=current_user.id, entity_id=patient.id,
        new_value={"mrn": mrn, "name": f"{patient.first_name} {patient.last_name}"},
        request=request,
    )
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse, UserRole.clinician, UserRole.pharmacist, UserRole.lab_technician)),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    body: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse)),
):
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    await log_action(db, action="update", entity_type="patient", user_id=current_user.id, entity_id=patient_id, request=None)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(patient, field, value)
    patient.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(patient)
    return patient


@router.get("/{patient_id}/allergies", response_model=list[PatientAllergyResponse])
async def list_patient_allergies(
    patient_id: str,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(
        UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse,
        UserRole.clinician, UserRole.pharmacist,
    )),
):
    if not (await db.execute(select(Patient.id).where(
        Patient.id == patient_id, Patient.is_deleted == False
    ))).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")
    stmt = select(PatientAllergy).where(PatientAllergy.patient_id == patient_id)
    if active_only:
        stmt = stmt.where(PatientAllergy.is_active == True)
    result = await db.execute(stmt.order_by(PatientAllergy.created_at.desc()))
    return result.scalars().all()


@router.post("/{patient_id}/allergies", response_model=PatientAllergyResponse, status_code=status.HTTP_201_CREATED)
async def create_patient_allergy(
    patient_id: str,
    body: PatientAllergyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse,
        UserRole.clinician,
    )),
):
    if not (await db.execute(select(Patient.id).where(
        Patient.id == patient_id, Patient.is_deleted == False
    ))).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")
    allergy = PatientAllergy(id=str(uuid.uuid4()), patient_id=patient_id, **body.model_dump())
    db.add(allergy)
    await db.flush()
    await db.refresh(allergy)
    await log_action(
        db, action="create", entity_type="patient_allergy",
        user_id=current_user.id, entity_id=allergy.id, request=None,
        new_value={"patient_id": patient_id, "allergen": allergy.allergen, "severity": allergy.severity},
    )
    return allergy


@router.post("/{patient_id}/messages", response_model=PatientMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_patient_message(
    patient_id: str,
    body: PatientMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.nurse,
        UserRole.clinician, UserRole.lab_technician, UserRole.pharmacist,
    )),
):
    """Minimal one-way send for the patient portal inbox — results ready,
    reminders, etc. No dedicated staff compose UI yet; this endpoint exists
    so one can be bolted onto an existing page without a new router."""
    if not (await db.execute(select(Patient.id).where(
        Patient.id == patient_id, Patient.is_deleted == False
    ))).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")
    message = PatientMessage(
        id=str(uuid.uuid4()), patient_id=patient_id, created_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    await log_action(
        db, action="create", entity_type="patient_message",
        user_id=current_user.id, entity_id=message.id,
        new_value={"patient_id": patient_id, "subject": message.subject},
    )
    return message
