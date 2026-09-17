"""
Seed staff users for every role using one development-only password.

Run from backend/ directory:
    python seed_users.py

WARNING: Development/staging use only. Set SEED_USER_PASSWORD in backend/.env.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import engine, Base
from app.core.security import hash_password, validate_password_strength
from app.models.user import User, UserRole


# employee_id, full_name, role, department, email
SEED_USERS = [
    ("USER001", "Tadala Banda",         UserRole.user,          "General",     "tadala.banda@lifecare.mw"),
    ("DOC001",  "Dr. Chimwemwe Phiri",  UserRole.doctor,        "Outpatient",  "c.phiri@lifecare.mw"),
    ("CLN001",  "Dr. Yamikani Gondwe",  UserRole.clinician,     "Outpatient",  "y.gondwe@lifecare.mw"),
    ("NUR001",  "Grace Mhango",         UserRole.nurse,         "Inpatient",   "g.mhango@lifecare.mw"),
    ("MID001",  "Esther Nkhoma",        UserRole.midwife,       "Maternity",   "e.nkhoma@lifecare.mw"),
    ("PHA001",  "Limbani Kachale",      UserRole.pharmacist,    "Pharmacy",    "l.kachale@lifecare.mw"),
    ("LAB001",  "Mphatso Chirwa",       UserRole.lab_technician, "Laboratory", "m.chirwa@lifecare.mw"),
    ("RAD001",  "Thoko Mwale",          UserRole.radiographer,  "Imaging",     "t.mwale@lifecare.mw"),
    ("CSH001",  "Patrick Zulu",         UserRole.cashier,       "Billing",     "p.zulu@lifecare.mw"),
    ("REC001",  "Memory Kumwenda",      UserRole.receptionist,  "Reception",   "m.kumwenda@lifecare.mw"),
    ("SRG001",  "Dr. Blessings Tembo",  UserRole.surgical_lead, "Theatre",     "b.tembo@lifecare.mw"),
    ("STO001",  "Daniel Kanyenda",      UserRole.store_manager, "Stores",      "d.kanyenda@lifecare.mw"),
]


async def ensure_enum_values():
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        for role in UserRole:
            await conn.execute(
                text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{role.value}'")
            )
    print("Enum values ensured.")


async def seed():
    common_password = validate_password_strength(settings.SEED_USER_PASSWORD)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await ensure_enum_values()

    created, updated = 0, 0
    async with AsyncSession(engine) as db:
        for emp_id, name, role, dept, email in SEED_USERS:
            result = await db.execute(select(User).where(User.employee_id == emp_id))
            existing = result.scalar_one_or_none()
            if existing:
                existing.password_hash = hash_password(common_password)
                print(f"  update {emp_id:8} ({role.value}) — {name}")
                updated += 1
            else:
                db.add(User(
                    employee_id=emp_id,
                    full_name=name,
                    email=email,
                    password_hash=hash_password(common_password),
                    role=role,
                    department=dept,
                    is_active=True,
                ))
                print(f"  create {emp_id:8} ({role.value}) — {name}")
                created += 1
        await db.commit()

    print(f"\nDone. Created {created}, updated {updated}.")
    await engine.dispose()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed())
