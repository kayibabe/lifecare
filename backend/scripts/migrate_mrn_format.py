"""One-off migration: re-assign MRNs for patients still using the old LifeCareNNNNNN format.

Run from backend/:
    python scripts/migrate_mrn_format.py          # dry-run — shows what would change
    python scripts/migrate_mrn_format.py --apply  # writes to the database
"""
from __future__ import annotations

import argparse
import random
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncio
import asyncio as _asyncio
asyncio.set_event_loop_policy(_asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.patient import Patient

_MRN_CHARS = string.ascii_uppercase + string.digits


def _random_mrn(existing: set[str]) -> str:
    for _ in range(100):
        suffix = "".join(random.choices(_MRN_CHARS, k=5))
        candidate = f"LC-{suffix}"
        if candidate not in existing:
            return candidate
    raise RuntimeError("Could not generate a unique MRN after 100 attempts")


async def run(apply: bool, db_url: str) -> None:
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Load all patients with the old LifeCare prefix
        result = await session.execute(
            select(Patient.id, Patient.mrn, Patient.first_name, Patient.last_name)
            .where(Patient.mrn.like("LifeCare%"))
            .order_by(Patient.mrn)
        )
        old_patients = result.all()

        if not old_patients:
            print("No patients with old LifeCare MRN format found — nothing to do.")
            return

        # Collect all currently used MRNs so we don't collide
        all_mrns_result = await session.execute(select(Patient.mrn))
        used_mrns: set[str] = {row[0] for row in all_mrns_result.all()}

        print(f"{'DRY RUN — ' if not apply else ''}Found {len(old_patients)} patient(s) to migrate:\n")

        assignments: list[tuple[str, str, str]] = []  # (patient_id, old_mrn, new_mrn)
        for patient_id, old_mrn, first_name, last_name in old_patients:
            new_mrn = _random_mrn(used_mrns)
            used_mrns.add(new_mrn)
            assignments.append((patient_id, old_mrn, new_mrn))
            print(f"  {first_name} {last_name}:  {old_mrn}  →  {new_mrn}")

        if not apply:
            print("\nRun with --apply to commit these changes.")
            return

        for patient_id, old_mrn, new_mrn in assignments:
            await session.execute(
                update(Patient).where(Patient.id == patient_id).values(mrn=new_mrn)
            )

        await session.commit()
        print(f"\n{len(assignments)} MRN(s) updated successfully.")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate old LifeCare MRNs to LC-XXXXX format")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database")
    parser.add_argument("--database-url", help="Database URL (overrides settings; use the Railway public URL when running locally)")
    args = parser.parse_args()

    if args.database_url:
        db_url = args.database_url
    else:
        from app.core.config import settings
        db_url = settings.db_url

    asyncio.run(run(apply=args.apply, db_url=db_url))
