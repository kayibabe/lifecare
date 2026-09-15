"""Quick diagnostic — list all patient MRNs in the target database."""
import argparse, asyncio, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncio as _asyncio
asyncio.set_event_loop_policy(_asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.patient import Patient


async def run(db_url: str) -> None:
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        rows = (await session.execute(
            select(Patient.first_name, Patient.last_name, Patient.mrn).order_by(Patient.mrn)
        )).all()
    await engine.dispose()

    if not rows:
        print("No patients found in this database.")
        return
    print(f"{'Name':<30} {'MRN'}")
    print("-" * 45)
    for first, last, mrn in rows:
        print(f"{first} {last:<28} {mrn}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", required=True)
    args = parser.parse_args()
    asyncio.run(run(args.database_url))
