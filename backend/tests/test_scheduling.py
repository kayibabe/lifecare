"""Scheduling module tests — doctor rosters, doctor-to-doctor handovers, and
department-level shift handover logs."""
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.models.user import UserRole


def _future_date(days: int = 1) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()


# ── Doctor Schedule ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_doctor_schedule_crud(client: AsyncClient, auth_token):
    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMSCH1")
    _, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCSCH1")

    r = await client.post(
        "/api/v1/doctor-schedules",
        json={
            "doctor_id": doctor.id,
            "doctor_name": doctor.full_name,
            "schedule_date": _future_date(),
            "shift_type": "morning",
            "shift_start_time": "08:00",
            "shift_end_time": "16:00",
            "department": "clinical",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201, r.text
    schedule = r.json()
    assert schedule["status"] == "scheduled"
    assert schedule["doctor_id"] == doctor.id
    schedule_id = schedule["id"]

    # List, filtered by date
    r = await client.get(
        "/api/v1/doctor-schedules",
        params={"schedule_date": schedule["schedule_date"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert any(s["id"] == schedule_id for s in r.json())

    # Update status
    r = await client.put(
        f"/api/v1/doctor-schedules/{schedule_id}",
        json={"status": "confirmed"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"

    # Delete
    r = await client.delete(
        f"/api/v1/doctor-schedules/{schedule_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204

    r = await client.get(
        "/api/v1/doctor-schedules",
        params={"schedule_date": schedule["schedule_date"]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert not any(s["id"] == schedule_id for s in r.json())


@pytest.mark.asyncio
async def test_doctor_schedule_blank_optional_fk_does_not_crash(client: AsyncClient, auth_token):
    """Regression: the frontend's 'No specific ward' option submits ward_id
    as '' rather than omitting it. '' cannot cast to the ward_id UUID column
    and must be treated as null instead of reaching the DB layer."""
    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMSCH3")
    _, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCSCH3")

    r = await client.post(
        "/api/v1/doctor-schedules",
        json={
            "doctor_id": doctor.id,
            "schedule_date": _future_date(),
            "shift_type": "morning",
            "department": "clinical",
            "ward_id": "",
            "ward_name": "",
            "specialty": "",
            "notes": "",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["ward_id"] is None


@pytest.mark.asyncio
async def test_doctor_schedule_rejects_unknown_doctor(client: AsyncClient, auth_token):
    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMSCH2")
    r = await client.post(
        "/api/v1/doctor-schedules",
        json={
            "doctor_id": "00000000-0000-0000-0000-000000000000",
            "schedule_date": _future_date(),
            "shift_type": "morning",
            "department": "clinical",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_doctor_schedule_role_gate(client: AsyncClient, auth_token):
    pharm_token, _ = await auth_token(role=UserRole.pharmacist, employee_id="PHASCH1")
    r = await client.get(
        "/api/v1/doctor-schedules",
        headers={"Authorization": f"Bearer {pharm_token}"},
    )
    assert r.status_code == 403


# ── Doctor Handover ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_doctor_handover_create_defaults_and_acknowledge(client: AsyncClient, auth_token):
    from_token, from_doc = await auth_token(role=UserRole.user, employee_id="USRHO1")
    _, to_doc = await auth_token(role=UserRole.doctor, employee_id="DOCHO1")

    # from_doctor_id and handover_date are omitted — backend should default
    # from_doctor_id to the authenticated user and handover_date to now.
    r = await client.post(
        "/api/v1/doctor-handovers",
        json={
            "to_doctor_id": to_doc.id,
            "shift_type": "night",
            "critical_cases": "Bed 4 — post-op monitoring",
            "linked_patient_ids": ["p1", "p2"],
        },
        headers={"Authorization": f"Bearer {from_token}"},
    )
    assert r.status_code == 201, r.text
    handover = r.json()
    assert handover["from_doctor_id"] == from_doc.id
    assert handover["to_doctor_id"] == to_doc.id
    assert handover["status"] == "pending"
    assert handover["acknowledged"] is False
    assert handover["handover_date"] is not None
    handover_id = handover["id"]

    # since-filtered list picks it up
    since = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    r = await client.get(
        "/api/v1/doctor-handovers",
        params={"since": since},
        headers={"Authorization": f"Bearer {from_token}"},
    )
    assert r.status_code == 200
    assert any(h["id"] == handover_id for h in r.json())

    # Acknowledge
    r = await client.put(
        f"/api/v1/doctor-handovers/{handover_id}",
        json={"acknowledged": True},
        headers={"Authorization": f"Bearer {from_token}"},
    )
    assert r.status_code == 200, r.text
    acked = r.json()
    assert acked["acknowledged"] is True
    assert acked["status"] == "acknowledged"
    assert acked["acknowledged_date"] is not None


# ── Shift Handover Log ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_shift_handover_log_admin_only_and_acknowledge(client: AsyncClient, auth_token):
    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMSHL1")
    _, recipient = await auth_token(role=UserRole.receptionist, employee_id="RECSHL1")
    nurse_token, _ = await auth_token(role=UserRole.nurse, employee_id="NURSHL1")

    # Non-admin cannot create
    r = await client.post(
        "/api/v1/shift-handover-logs",
        json={"shift_type": "reception", "handover_to_user_id": recipient.id},
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 403

    r = await client.post(
        "/api/v1/shift-handover-logs",
        json={
            "shift_type": "reception",
            "handover_to_user_id": recipient.id,
            "outstanding_tasks": "Chase pending lab results for bay 3",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201, r.text
    log = r.json()
    assert log["handover_to_user_id"] == recipient.id
    assert log["handover_from_user_id"] is not None  # defaulted to creator
    assert log["acknowledged"] is False
    log_id = log["id"]

    r = await client.patch(
        f"/api/v1/shift-handover-logs/{log_id}",
        json={"acknowledged": True, "acknowledged_by": recipient.full_name},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.text
    acked = r.json()
    assert acked["acknowledged"] is True
    assert acked["acknowledged_by"] == recipient.full_name
