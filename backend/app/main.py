import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.core.ratelimit import limiter
from app.core.redis import close_redis
from app.routers import auth, patients, admin, sync
from app.routers import encounters, billing, lab, pharmacy, admissions, nursing, referrals, appointments
from app.routers import theatre, mortuary, insurance, scheduling
from app.routers import patient_auth, patient_portal
import app.models.referral       # ensure Referral table is registered with Base.metadata
import app.models.appointment    # ensure Appointment table is registered with Base.metadata
import app.models.theatre        # ensure theatre tables are registered with Base.metadata
import app.models.mortuary       # ensure mortuary tables are registered with Base.metadata
import app.models.insurance      # ensure insurance tables are registered with Base.metadata
import app.models.scheduling     # ensure scheduling tables are registered with Base.metadata
import app.models.patient_message  # ensure patient_messages table is registered with Base.metadata

_log = logging.getLogger(__name__)

_LOCALHOST_ONLY = {"http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:8080"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT == "production":
        origins = set(settings.allowed_origins_list)
        if origins <= _LOCALHOST_ONLY or not origins:
            _log.warning(
                "CORS WARNING: ALLOWED_ORIGINS contains only localhost origins in production. "
                "Cross-origin requests from the Railway frontend will be blocked. "
                "Set ALLOWED_ORIGINS to the frontend's public URL on the backend Railway service."
            )
        else:
            _log.info("CORS origins: %s", ", ".join(sorted(origins)))
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="LifeCare API",
    description="Clinical management system for LifeCare — Malawi",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)  # applies the default limit to all endpoints (audit H8)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,  # Using Bearer tokens, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(encounters.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(lab.router, prefix="/api/v1")
app.include_router(pharmacy.router, prefix="/api/v1")
app.include_router(admissions.router, prefix="/api/v1")
app.include_router(nursing.router, prefix="/api/v1")
app.include_router(referrals.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(theatre.router, prefix="/api/v1")
app.include_router(mortuary.router, prefix="/api/v1")
app.include_router(insurance.router, prefix="/api/v1")
app.include_router(scheduling.router, prefix="/api/v1")
app.include_router(patient_auth.router, prefix="/api/v1")
app.include_router(patient_portal.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "clinic": settings.CLINIC_NAME}
