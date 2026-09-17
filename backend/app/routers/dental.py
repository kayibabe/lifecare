import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_role
from app.core.database import get_db
from app.models.dental import (
    DentalEncounter, DentalEncounterStatus, DentalToothFinding,
    DentalTreatmentPlan, DentalTreatmentPlanItem, DentalTreatmentStatus,
)
from app.models.encounter import Encounter, EncounterType
from app.models.user import User, UserRole
from app.schemas.dental import (
    DentalEncounterCreate, DentalEncounterDetailResponse, DentalEncounterResponse,
    DentalEncounterUpdate, DentalToothFindingCreate, DentalToothFindingResponse,
    DentalTreatmentPlanCreate, DentalTreatmentPlanItemResponse,
    DentalTreatmentPlanResponse, DentalTreatmentPlanStatusUpdate,
)

router = APIRouter(prefix="/dental", tags=["dental"])
_DENTAL_WRITE = (UserRole.dentist, UserRole.doctor, UserRole.clinician, UserRole.admin)
_DENTAL_READ = _DENTAL_WRITE + (UserRole.nurse, UserRole.receptionist)


async def _get_dental(dental_encounter_id: str, db: AsyncSession) -> DentalEncounter:
    result = await db.execute(select(DentalEncounter).where(DentalEncounter.id == dental_encounter_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Dental encounter not found")
    return row


@router.get("/encounters", response_model=list[DentalEncounterResponse])
async def list_dental_encounters(
    patient_id: str | None = Query(None),
    status_filter: DentalEncounterStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_DENTAL_READ)),
):
    stmt = select(DentalEncounter).order_by(DentalEncounter.created_at.desc()).limit(limit)
    if patient_id:
        stmt = stmt.where(DentalEncounter.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(DentalEncounter.status == status_filter)
    return (await db.execute(stmt)).scalars().all()


@router.post("/encounters", response_model=DentalEncounterResponse, status_code=status.HTTP_201_CREATED)
async def create_dental_encounter(
    body: DentalEncounterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_DENTAL_WRITE)),
):
    encounter_id = body.encounter_id
    if encounter_id:
        existing = await db.execute(select(Encounter).where(Encounter.id == encounter_id, Encounter.patient_id == body.patient_id))
        if not existing.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Encounter not found for patient")
    else:
        encounter = Encounter(
            id=str(uuid.uuid4()), patient_id=body.patient_id, encounter_type=EncounterType.opd,
            encounter_date=datetime.now(timezone.utc), attending_doctor_id=current_user.id,
            chief_complaint=body.chief_complaint, queue_status="in_consultation",
            created_by=current_user.id,
        )
        db.add(encounter)
        await db.flush()
        encounter_id = encounter.id

    row = DentalEncounter(
        id=str(uuid.uuid4()), encounter_id=encounter_id, patient_id=body.patient_id,
        dentist_id=current_user.id, **body.model_dump(exclude={"patient_id", "encounter_id"}),
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    await log_action(db, action="create", entity_type="dental_encounter", entity_id=row.id, user_id=current_user.id)
    return row


@router.get("/encounters/{dental_encounter_id}", response_model=DentalEncounterDetailResponse)
async def get_dental_encounter(
    dental_encounter_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_DENTAL_READ)),
):
    row = await _get_dental(dental_encounter_id, db)
    findings = (await db.execute(select(DentalToothFinding).where(DentalToothFinding.dental_encounter_id == row.id).order_by(DentalToothFinding.created_at))).scalars().all()
    plan = (await db.execute(select(DentalTreatmentPlan).where(DentalTreatmentPlan.dental_encounter_id == row.id))).scalar_one_or_none()
    plan_response = None
    if plan:
        items = (await db.execute(select(DentalTreatmentPlanItem).where(DentalTreatmentPlanItem.treatment_plan_id == plan.id).order_by(DentalTreatmentPlanItem.created_at))).scalars().all()
        plan_response = DentalTreatmentPlanResponse.model_validate(plan).model_copy(update={"items": [DentalTreatmentPlanItemResponse.model_validate(i) for i in items]})
    return DentalEncounterDetailResponse.model_validate(row).model_copy(update={
        "tooth_findings": [DentalToothFindingResponse.model_validate(f) for f in findings],
        "treatment_plan": plan_response,
    })


@router.patch("/encounters/{dental_encounter_id}", response_model=DentalEncounterResponse)
async def update_dental_encounter(
    dental_encounter_id: str, body: DentalEncounterUpdate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role(*_DENTAL_WRITE)),
):
    row = await _get_dental(dental_encounter_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(row)
    await log_action(db, action="update", entity_type="dental_encounter", entity_id=row.id, user_id=current_user.id)
    return row


@router.post("/encounters/{dental_encounter_id}/tooth-findings", response_model=DentalToothFindingResponse, status_code=status.HTTP_201_CREATED)
async def add_tooth_finding(
    dental_encounter_id: str, body: DentalToothFindingCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role(*_DENTAL_WRITE)),
):
    await _get_dental(dental_encounter_id, db)
    row = DentalToothFinding(id=str(uuid.uuid4()), dental_encounter_id=dental_encounter_id, recorded_by=current_user.id, **body.model_dump())
    db.add(row)
    await db.flush()
    await db.refresh(row)
    await log_action(db, action="create", entity_type="dental_tooth_finding", entity_id=row.id, user_id=current_user.id)
    return row


@router.post("/encounters/{dental_encounter_id}/treatment-plan", response_model=DentalTreatmentPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_treatment_plan(
    dental_encounter_id: str, body: DentalTreatmentPlanCreate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role(*_DENTAL_WRITE)),
):
    await _get_dental(dental_encounter_id, db)
    existing = (await db.execute(select(DentalTreatmentPlan).where(DentalTreatmentPlan.dental_encounter_id == dental_encounter_id))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Treatment plan already exists")
    total = sum(item.fee for item in body.items)
    plan = DentalTreatmentPlan(id=str(uuid.uuid4()), dental_encounter_id=dental_encounter_id, created_by=current_user.id, estimated_total=total, notes=body.notes)
    db.add(plan)
    await db.flush()
    items = []
    for item in body.items:
        row = DentalTreatmentPlanItem(id=str(uuid.uuid4()), treatment_plan_id=plan.id, **item.model_dump())
        db.add(row)
        items.append(row)
    await db.flush()
    await db.refresh(plan)
    await log_action(db, action="create", entity_type="dental_treatment_plan", entity_id=plan.id, user_id=current_user.id)
    return DentalTreatmentPlanResponse.model_validate(plan).model_copy(update={"items": [DentalTreatmentPlanItemResponse.model_validate(i) for i in items]})


@router.patch("/treatment-plans/{plan_id}", response_model=DentalTreatmentPlanResponse)
async def update_treatment_plan_status(
    plan_id: str, body: DentalTreatmentPlanStatusUpdate,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role(*_DENTAL_WRITE)),
):
    plan = (await db.execute(select(DentalTreatmentPlan).where(DentalTreatmentPlan.id == plan_id))).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    plan.status = body.status
    plan.updated_at = datetime.now(timezone.utc)
    await db.flush()
    items = (await db.execute(select(DentalTreatmentPlanItem).where(DentalTreatmentPlanItem.treatment_plan_id == plan.id))).scalars().all()
    await log_action(db, action="update", entity_type="dental_treatment_plan", entity_id=plan.id, user_id=current_user.id)
    return DentalTreatmentPlanResponse.model_validate(plan).model_copy(update={"items": [DentalTreatmentPlanItemResponse.model_validate(i) for i in items]})
