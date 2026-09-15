from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.ratelimit import limiter
from app.core.database import get_db
from app.core.security import (
    create_patient_access_token, create_patient_refresh_token, decode_token,
)
from app.core.auth import get_current_patient
from app.core.audit import log_action
from app.core.redis import get_redis
from app.models.patient import Patient
from app.schemas.patient_auth import (
    PatientLoginRequest, PatientTokenResponse, PatientRefreshRequest, CurrentPatientResponse,
)
from jose import JWTError

router = APIRouter(prefix="/patient", tags=["patient-auth"])


@router.post("/login", response_model=PatientTokenResponse)
@limiter.limit("5/minute")
async def patient_login(request: Request, body: PatientLoginRequest, db: AsyncSession = Depends(get_db)):
    # body.mrn is normalized to uppercase by the schema validator, but stored
    # MRNs are mixed-case ("LifeCareNNNNNN") — match case-insensitively.
    result = await db.execute(
        select(Patient).where(Patient.mrn.ilike(body.mrn), Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()

    def _digits(v: str | None) -> str:
        return "".join(c for c in (v or "") if c.isdigit())

    def _phone_matches(stored: str | None, submitted: str) -> bool:
        # Both sides must be non-empty — an unset phone on file must never
        # match a blank submission.
        stored_digits = _digits(stored)
        return bool(stored_digits) and bool(submitted) and stored_digits == submitted

    match = patient is not None and (
        _phone_matches(patient.phone, body.phone) or _phone_matches(patient.phone_alt, body.phone)
    )

    if not match:
        await log_action(
            db, action="patient_login_failed", entity_type="patient_auth",
            entity_id=body.mrn, request=request,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Patient ID or phone number")

    await log_action(
        db, action="patient_login", entity_type="patient_auth",
        entity_id=patient.id, request=request,
    )

    access_token = create_patient_access_token(patient.id)
    refresh_token = create_patient_refresh_token(patient.id)

    redis = await get_redis()
    await redis.setex(
        f"patient-refresh:{patient.id}:{refresh_token[-16:]}",
        86400 * 7,
        refresh_token,
    )

    return PatientTokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=PatientTokenResponse)
async def patient_refresh(body: PatientRefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "patient_refresh":
            raise ValueError
        patient_id = payload["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    redis = await get_redis()
    redis_key = f"patient-refresh:{patient_id}:{body.refresh_token[-16:]}"
    stored = await redis.get(redis_key)
    if not stored or stored != body.refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.is_deleted == False)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Patient not found")

    await redis.delete(redis_key)
    access_token = create_patient_access_token(patient.id)
    new_refresh_token = create_patient_refresh_token(patient.id)
    await redis.setex(
        f"patient-refresh:{patient.id}:{new_refresh_token[-16:]}",
        86400 * 7,
        new_refresh_token,
    )
    return PatientTokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=CurrentPatientResponse)
async def patient_me(current_patient: Patient = Depends(get_current_patient)):
    return current_patient
