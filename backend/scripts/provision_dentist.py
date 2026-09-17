"""Provision one dentist account in an explicitly selected database.

Required environment variables: DENTIST_EMPLOYEE_ID, DENTIST_NAME,
DENTIST_PASSWORD. Optional: DENTIST_EMAIL, DENTIST_PHONE.

Production requires the explicit --confirm-live flag. The script is create-only:
it never overwrites an existing employee account and never prints credentials.
"""

import argparse
import os
import sys
import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.security import hash_password, validate_password_strength
from app.models import User, UserRole


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm-live", action="store_true", help="Allow execution when ENVIRONMENT=production")
    args = parser.parse_args()

    if settings.ENVIRONMENT.lower() == "production" and not args.confirm_live:
        raise SystemExit("Refusing production mutation without --confirm-live")

    employee_id = os.environ.get("DENTIST_EMPLOYEE_ID", "").strip()
    full_name = os.environ.get("DENTIST_NAME", "").strip()
    password = os.environ.get("DENTIST_PASSWORD", "")
    if not employee_id or not full_name or not password:
        raise SystemExit("DENTIST_EMPLOYEE_ID, DENTIST_NAME, and DENTIST_PASSWORD are required")
    validate_password_strength(password)

    engine = create_engine(settings.db_url_sync)
    with Session(engine) as db:
        if db.scalar(select(User).where(User.employee_id == employee_id)):
            raise SystemExit(f"Employee ID already exists: {employee_id}")
        user = User(
            id=str(uuid.uuid4()),
            employee_id=employee_id,
            full_name=full_name,
            email=os.environ.get("DENTIST_EMAIL") or None,
            phone=os.environ.get("DENTIST_PHONE") or None,
            password_hash=hash_password(password),
            role=UserRole.dentist,
            department="Dental",
        )
        db.add(user)
        db.commit()
        print(f"Created dentist account {employee_id} in {settings.ENVIRONMENT} database")


if __name__ == "__main__":
    main()
