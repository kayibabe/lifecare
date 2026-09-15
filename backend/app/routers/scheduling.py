from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User, UserRole
from app.models.scheduling import (
    DoctorSchedule, DoctorHandover, ShiftHandoverLog,
    DoctorScheduleStatus, HandoverStatus,
)
from app.schemas.scheduling import (
    DoctorScheduleCreate, DoctorScheduleUpdate, DoctorScheduleResponse,
    DoctorHandoverCreate, DoctorHandoverUpdate, DoctorHandoverResponse,
    ShiftHandoverLogCreate, ShiftHandoverLogAcknowledge, ShiftHandoverLogResponse,
)
import uuid

router = APIRouter(tags=["scheduling"])

_SCHEDULE_ROLES = (UserRole.admin, UserRole.user, UserRole.receptionist)
_HANDOVER_ROLES = (UserRole.admin, UserRole.user)
_SHIFT_LOG_WRITE_ROLES = (UserRole.admin,)
_SHIFT_LOG_READ_ROLES = (UserRole.admin, UserRole.user, UserRole.receptionist)


# ─── Doctor Schedule ────────────────────────────────────────────────────────

@router.post("/doctor-schedules", response_model=DoctorScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor_schedule(
    body: DoctorScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_SCHEDULE_ROLES)),
):
    doctor_result = await db.execute(select(User).where(User.id == body.doctor_id))
    if not doctor_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Doctor not found")

    schedule = DoctorSchedule(
        id=str(uuid.uuid4()),
        created_by_id=current_user.id,
        **body.model_dump(),
    )
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return schedule


@router.get("/doctor-schedules", response_model=list[DoctorScheduleResponse])
async def list_doctor_schedules(
    schedule_date: date | None = Query(None),
    department: str | None = Query(None),
    doctor_id: str | None = Query(None),
    skip: int = 0,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SCHEDULE_ROLES)),
):
    stmt = select(DoctorSchedule)
    if schedule_date:
        stmt = stmt.where(DoctorSchedule.schedule_date == schedule_date)
    if department:
        stmt = stmt.where(DoctorSchedule.department == department)
    if doctor_id:
        stmt = stmt.where(DoctorSchedule.doctor_id == doctor_id)
    stmt = stmt.order_by(DoctorSchedule.schedule_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/doctor-schedules/{schedule_id}", response_model=DoctorScheduleResponse)
async def update_doctor_schedule(
    schedule_id: str,
    body: DoctorScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SCHEDULE_ROLES)),
):
    result = await db.execute(select(DoctorSchedule).where(DoctorSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Doctor schedule not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(schedule, field, value)
    schedule.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(schedule)
    return schedule


@router.delete("/doctor-schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SCHEDULE_ROLES)),
):
    result = await db.execute(select(DoctorSchedule).where(DoctorSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Doctor schedule not found")
    await db.delete(schedule)
    await db.flush()


# ─── Doctor Handover ────────────────────────────────────────────────────────

@router.post("/doctor-handovers", response_model=DoctorHandoverResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor_handover(
    body: DoctorHandoverCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_HANDOVER_ROLES)),
):
    data = body.model_dump()
    data.setdefault("from_doctor_id", None)
    if not data.get("from_doctor_id"):
        data["from_doctor_id"] = current_user.id
    if not data.get("handover_date"):
        data["handover_date"] = datetime.now(timezone.utc)

    handover = DoctorHandover(
        id=str(uuid.uuid4()),
        created_by_id=current_user.id,
        **data,
    )
    db.add(handover)
    await db.flush()
    await db.refresh(handover)
    return handover


@router.get("/doctor-handovers", response_model=list[DoctorHandoverResponse])
async def list_doctor_handovers(
    to_doctor_id: str | None = Query(None),
    since: datetime | None = Query(None),
    skip: int = 0,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_HANDOVER_ROLES)),
):
    stmt = select(DoctorHandover)
    if to_doctor_id:
        stmt = stmt.where(DoctorHandover.to_doctor_id == to_doctor_id)
    if since:
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)
        stmt = stmt.where(DoctorHandover.created_at >= since)
    stmt = stmt.order_by(DoctorHandover.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/doctor-handovers/{handover_id}", response_model=DoctorHandoverResponse)
async def update_doctor_handover(
    handover_id: str,
    body: DoctorHandoverUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_HANDOVER_ROLES)),
):
    result = await db.execute(select(DoctorHandover).where(DoctorHandover.id == handover_id))
    handover = result.scalar_one_or_none()
    if not handover:
        raise HTTPException(status_code=404, detail="Doctor handover not found")
    update_data = body.model_dump(exclude_none=True)
    if update_data.get("acknowledged"):
        update_data.setdefault("status", HandoverStatus.acknowledged)
        handover.acknowledged_date = datetime.now(timezone.utc)
    for field, value in update_data.items():
        setattr(handover, field, value)
    handover.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(handover)
    return handover


# ─── Shift Handover Log (department-level) ─────────────────────────────────

@router.post("/shift-handover-logs", response_model=ShiftHandoverLogResponse, status_code=status.HTTP_201_CREATED)
async def create_shift_handover_log(
    body: ShiftHandoverLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*_SHIFT_LOG_WRITE_ROLES)),
):
    to_user_result = await db.execute(select(User).where(User.id == body.handover_to_user_id))
    if not to_user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Handover recipient not found")

    data = body.model_dump()
    if not data.get("handover_from_user_id"):
        data["handover_from_user_id"] = current_user.id
    if not data.get("handover_date"):
        data["handover_date"] = datetime.now(timezone.utc)

    log = ShiftHandoverLog(
        id=str(uuid.uuid4()),
        created_by_id=current_user.id,
        **data,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    return log


@router.get("/shift-handover-logs", response_model=list[ShiftHandoverLogResponse])
async def list_shift_handover_logs(
    since: datetime | None = Query(None),
    until: datetime | None = Query(None),
    skip: int = 0,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SHIFT_LOG_READ_ROLES)),
):
    stmt = select(ShiftHandoverLog)
    if since:
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)
        stmt = stmt.where(ShiftHandoverLog.handover_date >= since)
    if until:
        if until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        stmt = stmt.where(ShiftHandoverLog.handover_date < until)
    stmt = stmt.order_by(ShiftHandoverLog.handover_date.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/shift-handover-logs/{log_id}", response_model=ShiftHandoverLogResponse)
async def acknowledge_shift_handover_log(
    log_id: str,
    body: ShiftHandoverLogAcknowledge,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*_SHIFT_LOG_WRITE_ROLES)),
):
    result = await db.execute(select(ShiftHandoverLog).where(ShiftHandoverLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Shift handover log not found")
    log.acknowledged = body.acknowledged
    log.acknowledged_by = body.acknowledged_by
    log.acknowledged_date = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(log)
    return log
