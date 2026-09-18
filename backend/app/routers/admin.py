from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date, datetime, time, timedelta, timezone
from app.models.encounter import Encounter, ClinicalNote
from app.models.lab import LabOrder
from app.models.pharmacy import Drug, Prescription, PrescriptionItem
from app.models.billing import BillingInvoice, Payment
from app.models.insurance import InsuranceClaim
from pydantic import BaseModel, field_validator
from app.core.database import get_db
from app.core.auth import require_role
from app.core.audit import log_action
from app.core.security import hash_password, validate_password_strength
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.models.admission import Admission, AdmissionStatus, BedStatus, Ward
from app.models.theatre import TheatreCase, TheatreCaseStatus, PreOpChecklist
from app.models.mortuary import DeathRecord, MortuaryAdmission, MortuaryStatus
from app.models.dental import DentalEncounter, DentalEncounterStatus, DentalTreatmentPlan, DentalTreatmentStatus, DentalToothFinding
from app.models.nursing import VitalSigns, MedicationAdministration, NursingNote, MARStatus
from app.models.scheduling import DoctorSchedule, DoctorScheduleStatus, DoctorHandover, ShiftHandoverLog
from app.models.appointment import Appointment
from app.models.referral import Referral
from app.models.report_export import ReportExport
from app.models.audit import AuditLog
import uuid
import hashlib
import json

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
    end_date: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*tuple(UserRole))),
):
    """Read-only operational analysis over persisted backend records.

    Counts are deliberately calculated here, against the system of record, so
    dashboards cannot silently drift from the database or invent stock.
    """
    today = end_date or date.today()
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

    # Operational aggregates are safe for authenticated staff. Financial
    # totals remain restricted because the report hub is available to all
    # clinical and operational roles.
    can_view_financials = current_user.role in {
        UserRole.admin, UserRole.cashier, UserRole.billing_clerk,
    }
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
                       "paid_revenue": float(sum((i.total or 0) for i in invoices)) if can_view_financials else None},
    }


@router.get("/reports/comparison")
async def get_report_comparison(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(*tuple(UserRole))),
):
    """Compare the current period with the immediately preceding period."""
    current_end = date.today()
    previous_end = current_end - timedelta(days=days)
    current = await get_analytics(days=days, end_date=current_end, db=db, current_user=current_user)
    previous = await get_analytics(days=days, end_date=previous_end, db=db, current_user=current_user)

    def values(report):
        return {
            "patients": report["patients"]["intake"],
            "encounters": report["operations"]["encounters"],
            "lab_orders": report["operations"]["lab_orders"],
            "prescription_items": report["operations"]["prescription_items"],
            "paid_revenue": report["operations"]["paid_revenue"],
        }

    current_values = values(current)
    previous_values = values(previous)
    changes = {}
    for key, current_value in current_values.items():
        previous_value = previous_values[key]
        changes[key] = None if current_value is None or previous_value is None else current_value - previous_value
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "current_period": current["period"], "previous_period": previous["period"],
        "current": current_values, "previous": previous_values, "change": changes,
    }


@router.get("/reports/clinical-activity")
async def get_clinical_activity_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*tuple(UserRole))),
):
    """Return aggregate clinical activity for a bounded reporting period.

    This endpoint intentionally returns counts and categories only. It does
    not expose patient identifiers or free-text clinical notes.
    """
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)

    patients = (await db.execute(
        select(Patient).where(
            Patient.created_at >= start_dt,
            Patient.created_at < end_dt,
            Patient.is_deleted == False,
        )
    )).scalars().all()
    encounters = (await db.execute(
        select(Encounter).where(
            Encounter.encounter_date >= start_dt,
            Encounter.encounter_date < end_dt,
        )
    )).scalars().all()
    lab_orders = (await db.execute(
        select(LabOrder).where(
            LabOrder.created_at >= start_dt,
            LabOrder.created_at < end_dt,
        )
    )).scalars().all()
    prescriptions = (await db.execute(
        select(Prescription).where(
            Prescription.prescribed_at >= start_dt,
            Prescription.prescribed_at < end_dt,
        )
    )).scalars().all()

    def counts(rows, attribute):
        result = {}
        for row in rows:
            value = getattr(row, attribute, None)
            key = value.value if hasattr(value, "value") else (value or "unknown")
            result[key] = result.get(key, 0) + 1
        return dict(sorted(result.items()))

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "patients": {
            "new_registrations": len(patients),
            "by_gender": counts(patients, "gender"),
        },
        "encounters": {
            "total": len(encounters),
            "by_type": counts(encounters, "encounter_type"),
            "by_status": counts(encounters, "status"),
        },
        "laboratory": {
            "orders": len(lab_orders),
            "by_status": counts(lab_orders, "status"),
            "by_priority": counts(lab_orders, "priority"),
        },
        "prescriptions": {
            "total": len(prescriptions),
            "by_status": counts(prescriptions, "status"),
        },
    }


@router.get("/reports/finance-summary")
async def get_finance_summary_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.cashier, UserRole.billing_clerk)),
):
    """Return aggregate finance and claims metrics for finance staff."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)

    invoices = (await db.execute(select(BillingInvoice).where(
        BillingInvoice.created_at >= start_dt, BillingInvoice.created_at < end_dt,
    ))).scalars().all()
    payments = (await db.execute(select(Payment).where(
        Payment.received_at >= start_dt, Payment.received_at < end_dt,
    ))).scalars().all()
    claims = (await db.execute(select(InsuranceClaim).where(
        InsuranceClaim.created_at >= start_dt, InsuranceClaim.created_at < end_dt,
    ))).scalars().all()
    aging = {"0_30_days": 0.0, "31_60_days": 0.0, "61_90_days": 0.0, "over_90_days": 0.0}
    for invoice in invoices:
        balance = float(invoice.balance or 0)
        if balance <= 0:
            continue
        age_days = max(0, (today - invoice.created_at.date()).days)
        bucket = "0_30_days" if age_days <= 30 else "31_60_days" if age_days <= 60 else "61_90_days" if age_days <= 90 else "over_90_days"
        aging[bucket] += balance

    def counts(rows, attribute):
        result = {}
        for row in rows:
            value = getattr(row, attribute, None)
            key = value.value if hasattr(value, "value") else (value or "unknown")
            result[key] = result.get(key, 0) + 1
        return dict(sorted(result.items()))

    def total(rows, attribute):
        return float(sum((getattr(row, attribute, 0) or 0) for row in rows))

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "invoices": {
            "count": len(invoices), "by_status": counts(invoices, "status"),
            "gross_total": total(invoices, "total"), "outstanding_balance": total(invoices, "balance"),
            "aging": {key: round(value, 2) for key, value in aging.items()},
        },
        "payments": {
            "count": len(payments), "by_method": counts(payments, "payment_mode"),
            "collected_total": total(payments, "amount"),
        },
        "claims": {
            "count": len(claims), "by_status": counts(claims, "status"),
            "claimed_total": total(claims, "claimed_amount"),
            "approved_total": total(claims, "approved_amount"),
        },
    }


@router.get("/reports/pharmacy-summary")
async def get_pharmacy_summary_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.pharmacist, UserRole.store_manager)),
):
    """Return aggregate inventory risk and dispensing metrics."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    expiry_30 = today + timedelta(days=30)
    expiry_90 = today + timedelta(days=90)

    drugs = (await db.execute(select(Drug).options(selectinload(Drug.stock)).where(
        Drug.is_active == True,
    ).order_by(Drug.name))).scalars().all()
    dispensed = (await db.execute(select(PrescriptionItem).where(
        PrescriptionItem.dispensed_at >= start_dt,
        PrescriptionItem.dispensed_at < end_dt,
        PrescriptionItem.dispensed_quantity > 0,
    ))).scalars().all()

    low_stock = out_of_stock = total_units = 0
    stock_value = 0.0
    expiry = {"expired": 0, "within_30_days": 0, "within_90_days": 0}
    controlled = {"medicines": 0, "units": 0}
    for drug in drugs:
        batches = [batch for batch in drug.stock if batch.quantity_current > 0]
        units = sum(batch.quantity_current for batch in batches)
        total_units += units
        stock_value += units * float(drug.unit_price or 0)
        if units == 0:
            out_of_stock += 1
        elif units <= drug.reorder_level:
            low_stock += 1
        if drug.is_controlled:
            controlled["medicines"] += 1
            controlled["units"] += units
        for batch in batches:
            if batch.expiry_date < today:
                expiry["expired"] += 1
            elif batch.expiry_date <= expiry_30:
                expiry["within_30_days"] += 1
            elif batch.expiry_date <= expiry_90:
                expiry["within_90_days"] += 1

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "inventory": {
            "active_medicines": len(drugs), "total_units": total_units,
            "estimated_value": round(stock_value, 2),
            "low_stock_medicines": low_stock, "out_of_stock_medicines": out_of_stock,
            "expiry_risk": expiry,
        },
        "dispensing": {
            "line_items": len(dispensed),
            "units_dispensed": sum(item.dispensed_quantity or 0 for item in dispensed),
        },
        "controlled": controlled,
    }


@router.get("/reports/moh-monthly")
async def get_moh_monthly_report(
    period: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Return a traceable monthly aggregate for MoH/DHIS2 preparation.

    Only indicators backed by the current system of record are emitted. The
    response includes explicit limitations so absent clinical domains are not
    mistaken for zero activity.
    """
    month_start = date.fromisoformat(f"{period}-01")
    month_end = date(month_start.year + (month_start.month == 12), 1 if month_start.month == 12 else month_start.month + 1, 1)
    start_dt = datetime.combine(month_start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(month_end, time.min, tzinfo=timezone.utc)

    patients = (await db.execute(select(Patient).where(
        Patient.created_at >= start_dt, Patient.created_at < end_dt,
        Patient.is_deleted == False,
    ))).scalars().all()
    encounters = (await db.execute(select(Encounter).where(
        Encounter.encounter_date >= start_dt, Encounter.encounter_date < end_dt,
    ))).scalars().all()
    lab_orders = (await db.execute(select(LabOrder).where(
        LabOrder.created_at >= start_dt, LabOrder.created_at < end_dt,
    ))).scalars().all()
    admissions = (await db.execute(select(Admission).where(
        Admission.admission_date >= start_dt, Admission.admission_date < end_dt,
    ))).scalars().all()

    def count_type(rows, attribute, value):
        return sum(1 for row in rows if getattr(getattr(row, attribute, None), "value", None) == value)

    return {
        "facility": {"name": "LifeCare"},
        "period": period,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "report_type": "aggregate_monthly",
        "aggregates": {
            "total_visits": len(encounters),
            "opd_visits": count_type(encounters, "encounter_type", "opd"),
            "emergency_visits": count_type(encounters, "encounter_type", "emergency"),
            "inpatient_admissions": len(admissions),
            "total_lab_orders": len(lab_orders),
            "new_patient_registrations": len(patients),
        },
        "quality": {
            "source_tables": ["patients", "encounters", "lab_orders", "admissions"],
            "point_in_time_filter": "created/admission/encounter timestamps within the calendar month",
            "maternal_indicators": None,
        },
        "limitations": [
            "Maternal, delivery, neonatal, and disease-burden indicators are not reported because their persisted source domains are not currently supported.",
            "This is a preparation/export payload; submission to DHIS2 is not performed by this endpoint.",
        ],
    }


@router.get("/reports/patient-flow")
async def get_patient_flow_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*tuple(UserRole))),
):
    """Return aggregate appointment and queue throughput metrics."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    appointments = (await db.execute(select(Appointment).where(
        Appointment.scheduled_datetime >= start_dt,
        Appointment.scheduled_datetime < end_dt,
    ))).scalars().all()
    encounters = (await db.execute(select(Encounter).where(
        Encounter.encounter_date >= start_dt,
        Encounter.encounter_date < end_dt,
    ))).scalars().all()

    def counts(rows, attribute):
        result = {}
        for row in rows:
            value = getattr(row, attribute, None)
            key = value.value if hasattr(value, "value") else (value or "unknown")
            result[key] = result.get(key, 0) + 1
        return dict(sorted(result.items()))

    no_shows = sum(1 for row in appointments if getattr(row.status, "value", row.status) == "no_show")
    completed = sum(1 for row in appointments if getattr(row.status, "value", row.status) == "completed")
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "appointments": {
            "total": len(appointments), "by_status": counts(appointments, "status"),
            "by_type": counts(appointments, "appointment_type"),
            "completed": completed, "no_shows": no_shows,
            "no_show_rate": round(no_shows / len(appointments), 4) if appointments else None,
        },
        "encounters": {"total": len(encounters), "by_queue_status": counts(encounters, "queue_status")},
    }


@router.get("/reports/data-quality")
async def get_data_quality_report(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Return non-destructive data-quality indicators for report governance."""
    patients = (await db.execute(select(Patient).where(Patient.is_deleted == False))).scalars().all()
    encounters = (await db.execute(select(Encounter))).scalars().all()
    appointments = (await db.execute(select(Appointment))).scalars().all()
    lab_orders = (await db.execute(select(LabOrder))).scalars().all()
    invoices = (await db.execute(select(BillingInvoice))).scalars().all()

    checks = {
        "patients_missing_consent": sum(1 for row in patients if not row.consent_given),
        "patients_missing_phone": sum(1 for row in patients if not (row.phone or row.phone_alt)),
        "patients_missing_date_of_birth": sum(1 for row in patients if row.date_of_birth is None),
        "appointments_without_provider": sum(1 for row in appointments if row.provider_id is None),
        "open_encounters": sum(1 for row in encounters if getattr(row.status, "value", row.status) == "open"),
        "lab_orders_pending_result": sum(1 for row in lab_orders if getattr(row.status, "value", row.status) not in {"resulted", "verified", "cancelled"}),
        "invoices_with_balance": sum(1 for row in invoices if float(row.balance or 0) > 0),
    }
    total_records = {
        "patients": len(patients), "encounters": len(encounters),
        "appointments": len(appointments), "lab_orders": len(lab_orders),
        "invoices": len(invoices),
    }
    issue_count = sum(checks.values())
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "total_records": total_records,
        "checks": checks,
        "issue_count": issue_count,
        "status": "attention_required" if issue_count else "clear",
        "limitations": [
            "These are completeness indicators, not proof that the underlying clinical or financial records are correct.",
            "Counts are current-state checks and are not restricted to a reporting period.",
        ],
    }


@router.get("/reports/provider-performance")
async def get_provider_performance_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Return aggregate provider workload and throughput metrics."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    encounters = (await db.execute(select(Encounter).where(
        Encounter.encounter_date >= start_dt, Encounter.encounter_date < end_dt,
    ))).scalars().all()
    appointments = (await db.execute(select(Appointment).where(
        Appointment.scheduled_datetime >= start_dt, Appointment.scheduled_datetime < end_dt,
    ))).scalars().all()
    provider_ids = {row.attending_doctor_id for row in encounters if row.attending_doctor_id}
    provider_ids.update(row.provider_id for row in appointments if row.provider_id)
    users = (await db.execute(select(User).where(User.id.in_(provider_ids)))).scalars().all() if provider_ids else []
    names = {user.id: user.full_name for user in users}
    rows = {}
    for row in encounters:
        if not row.attending_doctor_id:
            continue
        item = rows.setdefault(row.attending_doctor_id, {"provider_id": row.attending_doctor_id, "provider_name": names.get(row.attending_doctor_id, "Unknown provider"), "encounters": 0, "closed_encounters": 0, "appointments": 0, "completed_appointments": 0, "no_shows": 0})
        item["encounters"] += 1
        if getattr(row.status, "value", row.status) == "closed":
            item["closed_encounters"] += 1
    for row in appointments:
        if not row.provider_id:
            continue
        item = rows.setdefault(row.provider_id, {"provider_id": row.provider_id, "provider_name": names.get(row.provider_id, "Unknown provider"), "encounters": 0, "closed_encounters": 0, "appointments": 0, "completed_appointments": 0, "no_shows": 0})
        item["appointments"] += 1
        status_value = getattr(row.status, "value", row.status)
        if status_value == "completed":
            item["completed_appointments"] += 1
        elif status_value == "no_show":
            item["no_shows"] += 1
    for item in rows.values():
        item["completion_rate"] = round(item["completed_appointments"] / item["appointments"], 4) if item["appointments"] else None
    providers = sorted(rows.values(), key=lambda item: (-item["encounters"], -item["appointments"], item["provider_name"]))
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "providers": providers,
        "totals": {"providers": len(providers), "encounters": len(encounters), "appointments": len(appointments)},
        "limitations": ["Workload is attributed only when an attending doctor or appointment provider is recorded.", "This report measures recorded activity, not clinical quality or patient outcomes."],
    }


@router.get("/reports/audit-summary")
async def get_audit_summary_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Return aggregate audit activity without exposing audit payloads."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (await db.execute(select(AuditLog).where(AuditLog.timestamp >= since))).scalars().all()

    def counts(attribute):
        result = {}
        for row in rows:
            key = getattr(row, attribute) or "unknown"
            result[key] = result.get(key, 0) + 1
        return dict(sorted(result.items(), key=lambda item: (-item[1], item[0])))

    users = {row.user_id for row in rows if row.user_id}
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"days": days, "since": since.isoformat()},
        "total_events": len(rows),
        "active_users": len(users),
        "by_action": counts("action"),
        "by_entity": counts("entity_type"),
        "latest_event": max((row.timestamp for row in rows), default=None),
        "limitations": ["This summary excludes old_value/new_value payloads; use the detailed audit-log route for authorized investigation.", "Event presence does not by itself indicate that the underlying action was appropriate."],
    }


@router.get("/reports/demographics")
async def get_demographics_report(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*tuple(UserRole))),
):
    """Return aggregate patient demographics without identifiers or exact DOBs."""
    today = date.today()
    patients = (await db.execute(select(Patient).where(Patient.is_deleted == False))).scalars().all()
    gender = {}
    age_bands = {"0-4": 0, "5-14": 0, "15-24": 0, "25-44": 0, "45-64": 0, "65+": 0, "unknown": 0}
    districts = {}
    for patient in patients:
        gender_key = getattr(patient.gender, "value", patient.gender) or "unknown"
        gender[gender_key] = gender.get(gender_key, 0) + 1
        if patient.district:
            districts[patient.district] = districts.get(patient.district, 0) + 1
        if not patient.date_of_birth:
            age_bands["unknown"] += 1
            continue
        age = today.year - patient.date_of_birth.year - ((today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day))
        band = "0-4" if age <= 4 else "5-14" if age <= 14 else "15-24" if age <= 24 else "25-44" if age <= 44 else "45-64" if age <= 64 else "65+"
        age_bands[band] += 1
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "total_patients": len(patients), "by_gender": dict(sorted(gender.items())),
        "by_age_band": age_bands,
        "by_district": dict(sorted(districts.items(), key=lambda item: (-item[1], item[0]))),
        "limitations": ["Age groups are calculated as of the report date; exact dates of birth are not returned.", "District is based on the current registration value and may be incomplete."],
    }


@router.get("/reports/diagnoses")
async def get_diagnosis_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.clinician)),
):
    """Return aggregate structured-diagnosis counts without patient context."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    notes = (await db.execute(select(ClinicalNote).where(
        ClinicalNote.created_at >= start_dt, ClinicalNote.created_at < end_dt,
    ))).scalars().all()
    counts = {}
    with_diagnosis = 0
    for note in notes:
        diagnoses = note.diagnoses if isinstance(note.diagnoses, list) else []
        if diagnoses:
            with_diagnosis += 1
        for diagnosis in diagnoses:
            if isinstance(diagnosis, dict):
                label = diagnosis.get("label") or diagnosis.get("name") or diagnosis.get("code")
            else:
                label = str(diagnosis)
            if label:
                counts[label] = counts.get(label, 0) + 1
    top = [{"label": label, "count": count} for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:25]]
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "consultations_with_notes": len(notes), "consultations_with_structured_diagnosis": with_diagnosis,
        "consultations_without_structured_diagnosis": len(notes) - with_diagnosis,
        "top_diagnoses": top,
        "limitations": ["Only structured diagnoses stored on clinical notes are counted; free-text assessment is excluded.", "Counts are aggregate and do not include patient identifiers."],
    }


@router.get("/reports/referrals")
async def get_referral_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*tuple(UserRole))),
):
    """Return aggregate referral handoff metrics without reasons or notes."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    referrals = (await db.execute(select(Referral).where(
        Referral.created_at >= start_dt, Referral.created_at < end_dt,
    ))).scalars().all()

    def counts(attribute):
        result = {}
        for row in referrals:
            value = getattr(row, attribute, None)
            key = value.value if hasattr(value, "value") else (value or "unknown")
            result[key] = result.get(key, 0) + 1
        return dict(sorted(result.items(), key=lambda item: (-item[1], item[0])))

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "total_referrals": len(referrals), "by_status": counts("status"), "by_urgency": counts("urgency"),
        "by_destination": counts("destination_facility"),
        "feedback_recorded": sum(1 for row in referrals if row.feedback_date is not None),
        "limitations": ["Referral reasons, letters, and feedback notes are excluded from this aggregate report.", "A referral is counted by creation date, not by the date of destination response."],
    }


@router.get("/reports/inpatient")
async def get_inpatient_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*tuple(UserRole))),
):
    """Return aggregate inpatient activity and occupancy metrics."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    admissions = (await db.execute(select(Admission).where(
        Admission.admission_date >= start_dt, Admission.admission_date < end_dt,
    ))).scalars().all()
    def as_utc(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

    discharges = sum(
        1 for row in admissions
        if (discharge_date := as_utc(row.discharge_date)) is not None
        and start_dt <= discharge_date < end_dt
    )
    active_admissions = (await db.execute(select(Admission).where(Admission.status == AdmissionStatus.admitted))).scalars().all()
    wards = (await db.execute(select(Ward).options(selectinload(Ward.beds)).where(Ward.is_active == True))).scalars().all()
    occupied = sum(1 for ward in wards for bed in ward.beds if bed.status == BedStatus.occupied)
    capacity = sum(ward.total_beds for ward in wards)
    ward_rows = []
    for ward in wards:
        ward_occupied = sum(1 for bed in ward.beds if bed.status == BedStatus.occupied)
        ward_rows.append({"ward": ward.name, "ward_type": getattr(ward.ward_type, "value", ward.ward_type), "occupied": ward_occupied, "capacity": ward.total_beds})
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "admissions": len(admissions), "discharges": discharges, "active_admissions": len(active_admissions),
        "occupancy": {"occupied_beds": occupied, "total_beds": capacity, "occupancy_rate": round(occupied / capacity, 4) if capacity else None, "wards": ward_rows},
        "limitations": ["Occupancy is the current bed status, while admissions and discharges are period-based.", "Patient-level admission details and discharge summaries are excluded."],
    }


@router.get("/reports/theatre-mortuary")
async def get_theatre_mortuary_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(*tuple(UserRole))),
):
    """Return aggregate theatre utilization and mortuary activity metrics."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)

    theatre_rows = (await db.execute(select(TheatreCase).where(
        TheatreCase.scheduled_start >= start_dt, TheatreCase.scheduled_start < end_dt,
    ))).scalars().all()
    checklist_ids = {row.case_id for row in (await db.execute(select(PreOpChecklist))).scalars().all()}
    theatre_by_status = {}
    for row in theatre_rows:
        key = getattr(row.status, "value", row.status)
        theatre_by_status[key] = theatre_by_status.get(key, 0) + 1
    scheduled_minutes = sum(row.estimated_duration_minutes for row in theatre_rows if row.status != TheatreCaseStatus.cancelled)
    theatre_rooms = {}
    for row in theatre_rows:
        if row.status != TheatreCaseStatus.cancelled:
            theatre_rooms[row.theatre_room] = theatre_rooms.get(row.theatre_room, 0) + 1

    deaths = (await db.execute(select(DeathRecord).where(
        DeathRecord.date_of_death >= start_dt, DeathRecord.date_of_death < end_dt,
    ))).scalars().all()
    intakes = (await db.execute(select(MortuaryAdmission).where(
        MortuaryAdmission.received_at >= start_dt, MortuaryAdmission.received_at < end_dt,
    ))).scalars().all()
    active_intakes = (await db.execute(select(MortuaryAdmission).where(
        MortuaryAdmission.status == MortuaryStatus.admitted,
    ))).scalars().all()
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "theatre": {
            "cases": len(theatre_rows), "by_status": theatre_by_status,
            "completed_cases": sum(1 for row in theatre_rows if row.status == TheatreCaseStatus.completed),
            "cancelled_cases": sum(1 for row in theatre_rows if row.status == TheatreCaseStatus.cancelled),
            "pre_op_checklists": sum(1 for row in theatre_rows if row.id in checklist_ids),
            "scheduled_minutes": scheduled_minutes, "by_room": theatre_rooms,
        },
        "mortuary": {
            "deaths_recorded": len(deaths), "intakes": len(intakes),
            "active_intakes": len(active_intakes),
            "released_intakes": sum(1 for row in intakes if row.status == MortuaryStatus.released),
            "family_notification_pending": sum(1 for row in active_intakes if not row.family_notified),
        },
        "limitations": [
            "Theatre utilization is based on scheduled case duration, not actual room occupancy minutes.",
            "Procedure names, causes of death, patient identifiers, and mortuary notes are excluded.",
        ],
    }


@router.get("/reports/dental")
async def get_dental_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.dentist, UserRole.clinician)),
):
    """Return aggregate dental activity without clinical free text or identifiers."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    encounters = (await db.execute(select(DentalEncounter).where(
        DentalEncounter.created_at >= start_dt, DentalEncounter.created_at < end_dt,
    ))).scalars().all()
    plans = (await db.execute(select(DentalTreatmentPlan).where(
        DentalTreatmentPlan.created_at >= start_dt, DentalTreatmentPlan.created_at < end_dt,
    ))).scalars().all()
    findings = (await db.execute(select(DentalToothFinding).where(
        DentalToothFinding.created_at >= start_dt, DentalToothFinding.created_at < end_dt,
    ))).scalars().all()

    def counts(rows, attr):
        output = {}
        for row in rows:
            key = getattr(getattr(row, attr), "value", getattr(row, attr))
            output[key] = output.get(key, 0) + 1
        return output

    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "encounters": {"total": len(encounters), "by_status": counts(encounters, "status")},
        "treatment_plans": {
            "total": len(plans), "by_status": counts(plans, "status"),
            "estimated_value": round(sum(float(row.estimated_total or 0) for row in plans), 2),
        },
        "tooth_findings": {"total": len(findings), "by_severity": {
            str(row.severity or "unspecified"): sum(1 for item in findings if (item.severity or "unspecified") == (row.severity or "unspecified"))
            for row in findings
        }},
        "limitations": ["Diagnoses, complaints, examination notes, tooth numbers, and treatment notes are excluded.", "Estimated treatment value is not collected revenue or completed-care value."],
    }


@router.get("/reports/nursing-operations")
async def get_nursing_operations_report(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.nurse, UserRole.clinician)),
):
    """Return aggregate nursing documentation, medication, roster and handover metrics."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    vitals = (await db.execute(select(VitalSigns).where(VitalSigns.charted_at >= start_dt, VitalSigns.charted_at < end_dt))).scalars().all()
    mar = (await db.execute(select(MedicationAdministration).where(MedicationAdministration.scheduled_time >= start_dt, MedicationAdministration.scheduled_time < end_dt))).scalars().all()
    notes = (await db.execute(select(NursingNote).where(NursingNote.created_at >= start_dt, NursingNote.created_at < end_dt))).scalars().all()
    schedules = (await db.execute(select(DoctorSchedule).where(DoctorSchedule.schedule_date >= start, DoctorSchedule.schedule_date <= today))).scalars().all()
    doctor_handovers = (await db.execute(select(DoctorHandover).where(DoctorHandover.handover_date >= start_dt, DoctorHandover.handover_date < end_dt))).scalars().all()
    shift_handovers = (await db.execute(select(ShiftHandoverLog).where(ShiftHandoverLog.handover_date >= start_dt, ShiftHandoverLog.handover_date < end_dt))).scalars().all()

    def enum_counts(rows, field):
        result = {}
        for row in rows:
            value = getattr(row, field)
            key = getattr(value, "value", value)
            result[key] = result.get(key, 0) + 1
        return result

    department_counts = {}
    for row in schedules:
        key = getattr(row.department, "value", row.department)
        department_counts[key] = department_counts.get(key, 0) + 1
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "period": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "nursing": {
            "vital_sign_records": len(vitals), "notes": len(notes),
            "handover_notes": sum(1 for row in notes if row.note_type == "handover"),
            "medication_administrations": len(mar), "mar_by_status": enum_counts(mar, "status"),
        },
        "roster": {
            "scheduled_shifts": len(schedules), "by_department": department_counts,
            "by_status": enum_counts(schedules, "status"),
            "cancelled_shifts": sum(1 for row in schedules if row.status == DoctorScheduleStatus.cancelled),
        },
        "handovers": {
            "doctor_handovers": len(doctor_handovers),
            "doctor_acknowledged": sum(1 for row in doctor_handovers if row.acknowledged),
            "shift_handovers": len(shift_handovers),
            "shift_acknowledged": sum(1 for row in shift_handovers if row.acknowledged),
        },
        "limitations": ["Clinical observations, medication names/doses, staffing identities, handover text, and linked patient data are excluded.", "Roster counts reflect scheduled records and do not prove attendance or bedside completion."],
    }


@router.post("/reports/moh-monthly/exports", status_code=status.HTTP_201_CREATED)
async def create_moh_monthly_export(
    period: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Generate and append an auditable monthly MoH export record."""
    payload = await get_moh_monthly_report(period=period, db=db, _=current_user)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    export = ReportExport(
        id=str(uuid.uuid4()), report_type=payload["report_type"], period=period,
        export_format="json", payload=payload,
        payload_hash=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        source_revision="moh-monthly-v1", created_by_id=current_user.id,
    )
    db.add(export)
    await db.flush()
    return {"id": export.id, "report": payload, "payload_hash": export.payload_hash, "created_at": export.created_at}


@router.get("/reports/moh-monthly/exports")
async def list_moh_monthly_exports(
    period: str | None = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    stmt = select(ReportExport).where(ReportExport.report_type == "aggregate_monthly")
    if period:
        stmt = stmt.where(ReportExport.period == period)
    rows = (await db.execute(stmt.order_by(ReportExport.created_at.desc()).limit(limit))).scalars().all()
    return [{
        "id": row.id, "period": row.period, "report_type": row.report_type,
        "export_format": row.export_format, "payload_hash": row.payload_hash,
        "source_revision": row.source_revision, "created_by_id": row.created_by_id,
        "created_at": row.created_at, "report": row.payload,
    } for row in rows]
