import pytest
from sqlalchemy import select

from app.models.encounter import ClinicalNote, Encounter
from app.models.patient import PatientAllergy
from app.models.user import UserRole


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_allergy_capture_is_persisted_and_returned(client, auth_token, db):
    token, _ = await auth_token(UserRole.receptionist, employee_id="REC-ALLERGY-E2E")
    patient = await client.post(
        "/api/v1/patients",
        json={"first_name": "Allergy", "last_name": "Persisted", "gender": "female"},
        headers=_headers(token),
    )
    assert patient.status_code == 201, patient.text

    created = await client.post(
        f"/api/v1/patients/{patient.json()['id']}/allergies",
        json={"allergen": "Penicillin", "reaction": "Anaphylaxis", "severity": "severe"},
        headers=_headers(token),
    )
    assert created.status_code == 201, created.text

    allergy_id = created.json()["id"]
    persisted = (await db.execute(
        select(PatientAllergy).where(PatientAllergy.id == allergy_id)
    )).scalar_one()
    assert persisted.patient_id == patient.json()["id"]
    assert persisted.allergen == "Penicillin"
    assert persisted.reaction == "Anaphylaxis"
    assert persisted.severity == "severe"

    listed = await client.get(
        f"/api/v1/patients/{patient.json()['id']}/allergies",
        headers=_headers(token),
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [allergy_id]


@pytest.mark.asyncio
async def test_structured_allergy_is_enforced_by_prescription_gate(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist, employee_id="REC-ALLERGY-GATE")
    doc_token, doctor = await auth_token(UserRole.doctor, employee_id="DOC-ALLERGY-GATE")
    pharm_token, _ = await auth_token(UserRole.pharmacist, employee_id="PHA-ALLERGY-GATE")
    patient = await client.post(
        "/api/v1/patients",
        json={"first_name": "Safety", "last_name": "Gate", "gender": "female"},
        headers=_headers(rec_token),
    )
    patient_id = patient.json()["id"]
    allergy = await client.post(
        f"/api/v1/patients/{patient_id}/allergies",
        json={"allergen": "Amoxicillin", "reaction": "Rash", "severity": "moderate"},
        headers=_headers(rec_token),
    )
    assert allergy.status_code == 201, allergy.text
    encounter = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient_id, "encounter_type": "opd", "attending_doctor_id": doctor.id},
        headers=_headers(doc_token),
    )
    drug = await client.post(
        "/api/v1/pharmacy/drugs",
        json={"name": "Amoxicillin 500mg", "form": "capsule", "unit_price": 100},
        headers=_headers(pharm_token),
    )
    blocked = await client.post(
        "/api/v1/pharmacy/prescriptions",
        json={
            "encounter_id": encounter.json()["id"],
            "patient_id": patient_id,
            "items": [{"drug_id": drug.json()["id"], "dose": "500mg", "frequency": "TDS", "quantity": 15}],
        },
        headers=_headers(doc_token),
    )
    assert blocked.status_code == 409, blocked.text
    assert "Amoxicillin" in str(blocked.json()["detail"]["conflicts"])


@pytest.mark.asyncio
async def test_consultation_fields_and_diagnosis_persist_end_to_end(client, auth_token, db):
    rec_token, _ = await auth_token(UserRole.receptionist, employee_id="REC-CONSULT-E2E")
    doc_token, doctor = await auth_token(UserRole.doctor, employee_id="DOC-CONSULT-E2E")
    patient = await client.post(
        "/api/v1/patients",
        json={"first_name": "Consult", "last_name": "Persisted", "gender": "male"},
        headers=_headers(rec_token),
    )
    assert patient.status_code == 201, patient.text
    encounter = await client.post(
        "/api/v1/encounters",
        json={
            "patient_id": patient.json()["id"],
            "encounter_type": "opd",
            "attending_doctor_id": doctor.id,
            "queue_status": "triaged",
        },
        headers=_headers(doc_token),
    )
    assert encounter.status_code == 201, encounter.text
    encounter_id = encounter.json()["id"]

    note_payload = {
        "chief_complaint": "Fever",
        "history_present_illness": "Three days of fever",
        "physical_examination": "Temperature 38.4 C",
        "assessment": "Uncomplicated malaria",
        "plan": "Start treatment and review",
        "clinical_notes": "Safety-net advice given",
        "diagnoses": [{"code": "B54", "label": "Malaria", "type": "primary"}],
    }
    created = await client.post(
        f"/api/v1/encounters/{encounter_id}/notes",
        json=note_payload,
        headers=_headers(doc_token),
    )
    assert created.status_code == 201, created.text
    note_id = created.json()["id"]

    persisted = (await db.execute(
        select(ClinicalNote).where(ClinicalNote.id == note_id)
    )).scalar_one()
    for field, expected in note_payload.items():
        assert getattr(persisted, field) == expected

    queue_update = await client.put(
        f"/api/v1/encounters/{encounter_id}",
        json={"queue_status": "in_consultation"},
        headers=_headers(doc_token),
    )
    assert queue_update.status_code == 200, queue_update.text
    stored_encounter = (await db.execute(
        select(Encounter).where(Encounter.id == encounter_id)
    )).scalar_one()
    assert stored_encounter.queue_status == "in_consultation"

    listed = await client.get(
        "/api/v1/encounters/clinical-notes",
        params={"encounter_id": encounter_id},
        headers=_headers(doc_token),
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()[0]["patient_id"] == patient.json()["id"]
    assert listed.json()[0]["clinical_notes"] == note_payload["clinical_notes"]


@pytest.mark.asyncio
async def test_allergy_capture_rejects_missing_patient_and_blank_allergen(client, auth_token):
    token, _ = await auth_token(UserRole.receptionist, employee_id="REC-ALLERGY-BOUNDARY")
    missing = await client.post(
        "/api/v1/patients/00000000-0000-0000-0000-000000000000/allergies",
        json={"allergen": "Penicillin"},
        headers=_headers(token),
    )
    assert missing.status_code == 404

    patient = await client.post(
        "/api/v1/patients",
        json={"first_name": "Boundary", "last_name": "Allergy", "gender": "female"},
        headers=_headers(token),
    )
    blank = await client.post(
        f"/api/v1/patients/{patient.json()['id']}/allergies",
        json={"allergen": "   "},
        headers=_headers(token),
    )
    assert blank.status_code == 422
