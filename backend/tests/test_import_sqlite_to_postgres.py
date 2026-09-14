import sqlite3
from types import SimpleNamespace

from scripts.import_sqlite_to_postgres import _identity_keys, import_database


def test_identity_keys_normalise_sqlite_uuid():
    compact = "3d57a77ba2c84c44bcd4ccc5d4dfdbe9"
    assert _identity_keys(compact) == (
        compact,
        "3d57a77b-a2c8-4c44-bcd4-ccc5d4dfdbe9",
    )


def test_dry_run_reports_rows_without_writing(tmp_path, monkeypatch):
    source = tmp_path / "lifecare.sqlite3"
    connection = sqlite3.connect(source)
    connection.execute("CREATE TABLE users (id TEXT PRIMARY KEY, employee_id TEXT)")
    connection.execute("INSERT INTO users VALUES ('abc', 'DR001')")
    connection.commit()
    connection.close()

    monkeypatch.setattr(
        "scripts.import_sqlite_to_postgres.settings",
        SimpleNamespace(db_url_sync="postgresql+psycopg://unused:unused@localhost/unused"),
    )
    report = import_database(source, apply=False)

    assert report == {"users": {"source": 1, "inserted": 0, "mapped": 0}}
