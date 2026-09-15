"""Atomically merge a LifeCare SQLite database into configured PostgreSQL.

Existing users are matched by employee ID so clinical foreign keys can be
remapped without replacing PostgreSQL credentials. All other rows retain their
original primary keys. Any unexpected uniqueness or foreign-key conflict rolls
back the complete import.

Run from backend/:
    python scripts/import_sqlite_to_postgres.py PATH_TO_SQLITE --apply
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import Boolean, Date, DateTime, JSON, Numeric, create_engine, func, insert, select, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402
import app.models  # noqa: E402,F401


SKIP_TABLES = {"alembic_version"}


def _identity_keys(value) -> tuple[str, ...]:
    raw = str(value)
    try:
        return raw, str(uuid.UUID(raw))
    except (ValueError, AttributeError):
        return (raw,)


def _convert(value, column):
    if value is None:
        return None
    column_type = column.type
    if isinstance(column_type, Boolean):
        return bool(value)
    if isinstance(column_type, DateTime) and isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc)
    if isinstance(column_type, Date) and not isinstance(column_type, DateTime) and isinstance(value, str):
        return date.fromisoformat(value)
    if isinstance(column_type, Numeric) and not isinstance(value, Decimal):
        return Decimal(str(value))
    if isinstance(column_type, JSON) and isinstance(value, str):
        return json.loads(value)
    if column_type.__class__.__name__ == "UUID":
        parsed = uuid.UUID(str(value))
        return parsed if getattr(column_type, "as_uuid", False) else str(parsed)
    return value


def _source_rows(source: sqlite3.Connection, table_name: str) -> list[dict]:
    return [dict(row) for row in source.execute(f'SELECT * FROM "{table_name}"')]




def import_database(source_path: Path, *, apply: bool) -> dict[str, dict[str, int]]:
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    if not settings.db_url_sync.startswith("postgresql"):
        raise RuntimeError("Configured target is not PostgreSQL")

    source = sqlite3.connect(source_path)
    source.row_factory = sqlite3.Row
    source_tables = {
        row[0] for row in source.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    available = [
        table for table in Base.metadata.sorted_tables
        if table.name in source_tables and table.name not in SKIP_TABLES
    ]
    report = {
        table.name: {"source": len(_source_rows(source, table.name)), "inserted": 0, "mapped": 0}
        for table in available
        if source.execute(f'SELECT COUNT(*) FROM "{table.name}"').fetchone()[0]
    }
    if not apply:
        source.close()
        return report

    engine = create_engine(settings.db_url_sync)
    user_id_map: dict[str, str] = {}
    try:
        with engine.begin() as target:
            for table in available:
                rows = _source_rows(source, table.name)
                if not rows:
                    continue
                primary_keys = [column.name for column in table.primary_key.columns]
                if len(primary_keys) != 1:
                    raise RuntimeError(f"Unsupported composite primary key on {table.name}")
                primary_key = primary_keys[0]

                for raw in rows:
                    if table.name == "users":
                        existing = target.execute(
                            select(table.c.id).where(table.c.employee_id == raw["employee_id"])
                        ).scalar_one_or_none()
                        if existing is not None:
                            for key in _identity_keys(raw["id"]):
                                user_id_map[key] = str(existing)
                            report[table.name]["mapped"] += 1
                            continue

                    record = {
                        column.name: _convert(raw[column.name], column)
                        for column in table.columns
                        if column.name in raw
                    }
                    for column in table.columns:
                        if column.name not in record or record[column.name] is None:
                            continue
                        if any(fk.target_fullname == "users.id" for fk in column.foreign_keys):
                            mapped = next(
                                (user_id_map[key] for key in _identity_keys(raw[column.name]) if key in user_id_map),
                                record[column.name],
                            )
                            record[column.name] = _convert(mapped, column)

                    if table.name == "audit_log" and raw.get("entity_type") == "user":
                        record["entity_id"] = next(
                            (
                                user_id_map[key]
                                for key in _identity_keys(raw.get("entity_id"))
                                if key in user_id_map
                            ),
                            raw.get("entity_id"),
                        )

                    exists = target.execute(
                        select(func.count()).select_from(table).where(
                            table.c[primary_key] == record[primary_key]
                        )
                    ).scalar_one()
                    if exists:
                        report[table.name]["mapped"] += 1
                        continue
                    target.execute(insert(table).values(**record))
                    report[table.name]["inserted"] += 1

    finally:
        source.close()
        engine.dispose()

    for table_name, counts in report.items():
        if counts["inserted"] + counts["mapped"] != counts["source"]:
            raise RuntimeError(f"Import reconciliation failed for {table_name}: {counts}")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--apply", action="store_true", help="commit the atomic import")
    args = parser.parse_args()
    report = import_database(args.source.resolve(), apply=args.apply)
    print(json.dumps(report, indent=2, sort_keys=True))
    if not args.apply:
        print("Dry run only; pass --apply to commit the import.")


if __name__ == "__main__":
    main()
