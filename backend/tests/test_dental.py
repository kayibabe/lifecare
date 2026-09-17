import pytest
from httpx import AsyncClient

from app.models.user import UserRole


@pytest.mark.asyncio
async def test_dentist_can_complete_core_dental_record(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.dentist, employee_id="DENTTEST1")
    headers = {"Authorization": f"Bearer {token}"}
    receptionist_token, _ = await auth_token(role=UserRole.receptionist, employee_id="DENTREC1")

    patient = await client.post(
        "/api/v1/patients",
        json={"first_name": "Dental", "last_name": "Patient", "gender": "female"},
        headers={"Authorization": f"Bearer {receptionist_token}"},
    )
    assert patient.status_code == 201

    created = await client.post(
        "/api/v1/dental/encounters",
        json={"patient_id": patient.json()["id"], "chief_complaint": "Tooth pain"},
        headers=headers,
    )
    assert created.status_code == 201
    dental_id = created.json()["id"]

    finding = await client.post(
        f"/api/v1/dental/encounters/{dental_id}/tooth-findings",
        json={"tooth_number": "36", "surface": "occlusal", "finding": "Caries", "severity": "moderate"},
        headers=headers,
    )
    assert finding.status_code == 201

    plan = await client.post(
        f"/api/v1/dental/encounters/{dental_id}/treatment-plan",
        json={"items": [{"procedure_code": "REST-01", "procedure_name": "Restoration", "tooth_number": "36", "fee": 125.0}]},
        headers=headers,
    )
    assert plan.status_code == 201
    assert plan.json()["estimated_total"] == 125.0

    detail = await client.get(f"/api/v1/dental/encounters/{dental_id}", headers=headers)
    assert detail.status_code == 200
    assert len(detail.json()["tooth_findings"]) == 1
    assert detail.json()["treatment_plan"]["items"][0]["procedure_code"] == "REST-01"


@pytest.mark.asyncio
async def test_receptionist_cannot_write_dental_record(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="DENTTEST2")
    response = await client.post(
        "/api/v1/dental/encounters",
        json={"patient_id": "missing", "chief_complaint": "No access"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
