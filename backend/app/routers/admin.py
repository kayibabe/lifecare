from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date, datetime, time, timedelta, timezone
from app.models.encounter import Encounter
from app.models.lab import LabOrder
from app.models.pharmacy import Drug, Prescription
from app.models.billing import BillingInvoice
from pydantic import BaseModel, field_validator
from app.core.database import get_db
from app.core.auth import require_role
from app.core.audit import log_action
from app.core.security import hash_password, validate_password_strength
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.audit import AuditLog
import uuid

router = APIRouter(prefix="/admin", tags=["admin"])


class UserCreate(BaseModel):
    employee_id: str
    full_name: str
    role: UserRole
    department: str | None = None
    phone: str | None = None
    email: str | None = None
    password: str

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return validate_password_strength(v)


class UserResponse(BaseModel):
    id: str
    employee_id: str
    full_name: str
    role: UserRole
    department: str | None
    phone: str | None
    email: str | None
    is_active: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    department: str | None = None
    phone: str | None = None
    email: str | None = None
    password: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str | None) -> str | None:
        return validate_password_strength(v) if v else v


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    result = await db.execute(select(User).order_by(User.full_name))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    existing = await db.execute(select(User).where(User.employee_id == body.employee_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee ID already exists")

    user = User(
        id=str(uuid.uuid4()),
        employee_id=body.employee_id,
        full_name=body.full_name,
        role=body.role,
        department=body.department,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await log_action(
        db, action="create", entity_type="user",
        user_id=current_user.id, entity_id=user.id,
        new_value={"employee_id": user.employee_id, "role": user.role.value},
        request=request,
    )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    if user_id == current_user.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old = {"full_name": user.full_name, "department": user.department, "phone": user.phone, "email": user.email, "is_active": user.is_active, "role": user.role.value}
    if body.full_name is not None:
        if not body.full_name.strip():
            raise HTTPException(status_code=422, detail="Full name cannot be blank")
        user.full_name = body.full_name.strip()
    if body.department is not None:
        user.department = body.department or None
    if body.phone is not None:
        user.phone = body.phone or None
    if body.email is not None:
        user.email = body.email or None
    if body.password:
        user.password_hash = hash_password(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role
    await db.flush()
    await db.refresh(user)

    await log_action(
        db, action="update", entity_type="user",
        user_id=current_user.id, entity_id=user.id,
        old_value=old, new_value={"full_name": user.full_name, "department": user.department, "phone": user.phone, "email": user.email, "is_active": user.is_active, "role": user.role.value, "password_changed": bool(body.password)},
        request=request,
    )
    return user


@router.get("/audit-logs")
async def list_audit_logs(
    action: str | None = None,
    entity_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    stmt = stmt.order_by(AuditLog.timestamp.desc()).limit(min(limit, 500))
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "ip_address": r.ip_address,
            "timestamp": r.timestamp,
            "created_date": r.timestamp,
        }
        for r in rows
    ]


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    total_patients = (await db.execute(select(func.count()).select_from(Patient))).scalar_one()
    return {
        "total_patients": total_patients,
    }


@router.get("/analytics")
async def get_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Read-only operational analysis over persisted backend records.

    Counts are deliberately calculated here, against the system of record, so
    dashboards cannot silently drift from the database or invent stock.
    """
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)

    patients = (await db.execute(select(Patient).where(Patient.is_deleted == False))).scalars().all()
    encounters = (await db.execute(select(Encounter).where(Encounter.encounter_date >= start_dt, Encounter.encounter_date < end_dt))).scalars().all()
    lab_orders = (await db.execute(select(LabOrder).where(LabOrder.created_at >= start_dt, LabOrder.created_at < end_dt))).scalars().all()
    prescription_rows = (await db.execute(
        select(Prescription).options(selectinload(Prescription.items)).where(
            Prescription.prescribed_at >= start_dt, Prescription.prescribed_at < end_dt
        )
    )).scalars().all()
    prescriptions = [item for row in prescription_rows for item in row.items]
    invoices = (await db.execute(select(BillingInvoice).where(BillingInvoice.created_at >= start_dt, BillingInvoice.created_at < end_dt))).scalars().all()
    drugs = (await db.execute(select(Drug).options(selectinload(Drug.stock)).where(Drug.is_active == True).order_by(Drug.name))).scalars().all()

    intake_by_day = {start + timedelta(days=i): 0 for i in range(days)}
    for patient in patients:
        created = patient.created_at.date()
        if created in intake_by_day:
            intake_by_day[created] += 1

    commodities = []
    low_count = out_count = in_stock_count = 0
    first_expiry = None
    first_expiry_date = None
    for drug in drugs:
        batches = [b for b in drug.stock if b.quantity_current > 0]
        quantity = sum(b.quantity_current for b in batches)
        nearest = min((b.expiry_date for b in batches), default=None)
        if quantity == 0:
            out_count += 1
            status = "out_of_stock"
        elif quantity <= drug.reorder_level:
            low_count += 1
            in_stock_count += 1
            status = "low_stock"
        else:
            in_stock_count += 1
            status = "in_stock"
        if nearest and (first_expiry_date is None or nearest < first_expiry_date):
            first_expiry = {"drug": drug.name, "expiry_date": nearest.isoformat(), "quantity": quantity}
            first_expiry_date = nearest
        commodities.append({
            "id": drug.id, "name": drug.name, "generic_name": drug.generic_name,
            "category": drug.category, "unit": drug.unit_of_measure,
            "quantity": quantity, "reorder_level": drug.reorder_level,
            "expiry_date": nearest.isoformat() if nearest else None, "status": status,
        })

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "range_days": days,
        "period": {"start": start.isoformat(), "end": today.isoformat()},
        "patients": {"total": len(patients), "intake": sum(intake_by_day.values()),
                     "daily_intake": [{"date": d.isoformat(), "count": count} for d, count in intake_by_day.items()]},
        "stock": {"in_stock": in_stock_count, "issued": sum(i.dispensed_quantity or 0 for i in prescriptions),
                  "first_to_expire": first_expiry, "low_stock": low_count,
                  "out_of_stock": out_count, "commodities": commodities},
        "operations": {"encounters": len(encounters), "lab_orders": len(lab_orders),
                       "prescription_items": len(prescriptions),
                       "paid_revenue": float(sum((i.total or 0) for i in invoices))},
    }
