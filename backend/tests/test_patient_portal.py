"""Patient portal tests — patient self-service login (MRN + phone), the
two-way identity isolation from staff auth, and the ownership-scoped
appointments/invoices/messages endpoints."""
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.models.user import UserRole


def _future(days: float = 3, hour: int = 9) -> str:
    dt = (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return dt.isoformat()


async def _make_patient(client: AsyncClient, rec_token: str, *, n: int, phone: str) -> dict:
    r = await client.post(
        "/api/v1/patients",
        json={
            "first_name": f"Portal{n}",
            "last_name": "Test",
            "gender": "female",
            "date_of_birth": "1990-01-01",
            "phone": phone,
            "consent_given": True,
        },
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_patient_login_success_and_failure(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECPP1")
    patient = await _make_patient(client, rec_token, n=1, phone="0991112222")

    # Wrong phone
    r = await client.post("/api/v1/patient/login", json={"mrn": patient["mrn"], "phone": "0999999999"})
    assert r.status_code == 401

    # Unknown MRN
    r = await client.post("/api/v1/patient/login", json={"mrn": "LifeCare999999", "phone": "0991112222"})
    assert r.status_code == 401

    # Correct — also exercises phone normalization (spaces stripped)
    r = await client.post("/api/v1/patient/login", json={"mrn": patient["mrn"], "phone": "099 111 2222"})
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    # /patient/me reflects the authenticated patient
    r = await client.get("/api/v1/patient/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 200, r.text
    assert r.json()["mrn"] == patient["mrn"]


@pytest.mark.asyncio
async def test_patient_login_rejects_blank_phone_on_file(client: AsyncClient, auth_token):
    """Regression: a patient with no phone on file must never match a blank
    submission (both sides empty is not a match)."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECPP2")
    r = await client.post(
        "/api/v1/patients",
        json={"first_name": "NoPhone", "last_name": "Test", "gender": "male",
              "date_of_birth": "1990-01-01", "consent_given": True},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    patient = r.json()

    r = await client.post("/api/v1/patient/login", json={"mrn": patient["mrn"], "phone": ""})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_patient_and_staff_tokens_are_isolated(client: AsyncClient, auth_token):
    """The core security property: a patient token must never work against a
    staff-only endpoint, and a staff token must never work against a
    patient-only endpoint."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECPP3")
    patient = await _make_patient(client, rec_token, n=3, phone="0993334444")

    r = await client.post("/api/v1/patient/login", json={"mrn": patient["mrn"], "phone": "0993334444"})
    patient_token = r.json()["access_token"]

    # Patient token rejected by a staff-only endpoint
    r = await client.get("/api/v1/patients", headers={"Authorization": f"Bearer {patient_token}"})
    assert r.status_code == 401

    # Staff token rejected by a patient-only endpoint
    r = await client.get("/api/v1/patient/appointments", headers={"Authorization": f"Bearer {rec_token}"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_patient_appointments_scoped_to_self(client: AsyncClient, auth_token):
    """A patient can only ever see/book their own appointments — patient_id
    is taken from the token, never from the request body."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECPP4")
    doc_token, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCPP4")

    patient_a = await _make_patient(client, rec_token, n=4, phone="0994445555")
    patient_b = await _make_patient(client, rec_token, n=5, phone="0995556666")

    # Staff books an appointment for patient B (not the one who will log in)
    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient_b["id"], "scheduled_datetime": _future()},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text

    r = await client.post("/api/v1/patient/login", json={"mrn": patient_a["mrn"], "phone": "0994445555"})
    patient_a_token = r.json()["access_token"]

    # Patient A books their own appointment through the portal
    r = await client.post(
        "/api/v1/patient/appointments",
        json={"scheduled_datetime": _future(days=4)},
        headers={"Authorization": f"Bearer {patient_a_token}"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["patient_id"] == patient_a["id"]

    # Patient A's appointment list contains only their own booking
    r = await client.get("/api/v1/patient/appointments", headers={"Authorization": f"Bearer {patient_a_token}"})
    assert r.status_code == 200
    appts = r.json()
    assert len(appts) == 1
    assert appts[0]["patient_id"] == patient_a["id"]


@pytest.mark.asyncio
async def test_patient_messages_send_read_and_isolation(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECPP6")
    patient_a = await _make_patient(client, rec_token, n=6, phone="0996667777")
    patient_b = await _make_patient(client, rec_token, n=7, phone="0997778888")

    r = await client.post(
        f"/api/v1/patients/{patient_a['id']}/messages",
        json={"subject": "Lab results ready", "body": "Your recent blood panel results are ready."},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    message_id = r.json()["id"]
    assert r.json()["read_at"] is None

    r = await client.post("/api/v1/patient/login", json={"mrn": patient_a["mrn"], "phone": "0996667777"})
    token_a = r.json()["access_token"]
    r = await client.post("/api/v1/patient/login", json={"mrn": patient_b["mrn"], "phone": "0997778888"})
    token_b = r.json()["access_token"]

    # Patient A sees the message
    r = await client.get("/api/v1/patient/messages", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Patient B does not
    r = await client.get("/api/v1/patient/messages", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 200
    assert len(r.json()) == 0

    # Patient B cannot mark patient A's message read
    r = await client.patch(f"/api/v1/patient/messages/{message_id}/read", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 404

    # Patient A can
    r = await client.patch(f"/api/v1/patient/messages/{message_id}/read", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200, r.text
    assert r.json()["read_at"] is not None
