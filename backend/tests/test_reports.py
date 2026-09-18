import pytest
from httpx import AsyncClient

from app.models.user import UserRole


@pytest.mark.asyncio
async def test_operational_analytics_is_available_to_staff_but_hides_financials(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECREPORT")
    response = await client.get(
        "/api/v1/admin/analytics?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["range_days"] == 7
    assert body["period"]["start"] <= body["period"]["end"]
    assert "encounters" in body["operations"]
    assert body["operations"]["paid_revenue"] is None


@pytest.mark.asyncio
async def test_admin_analytics_includes_financials(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.admin, employee_id="ADMREPORT")
    response = await client.get(
        "/api/v1/admin/analytics?days=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["operations"]["paid_revenue"] >= 0.0


@pytest.mark.asyncio
async def test_clinical_activity_report_returns_aggregate_sections(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCREPORT")
    response = await client.get(
        "/api/v1/admin/reports/clinical-activity?days=14",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 14
    assert body["patients"]["new_registrations"] >= 0
    assert body["encounters"]["total"] >= 0
    assert body["laboratory"]["orders"] >= 0
    assert body["prescriptions"]["total"] >= 0


@pytest.mark.asyncio
async def test_finance_summary_is_restricted_to_finance_roles(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCFINREPORT")
    response = await client.get(
        "/api/v1/admin/reports/finance-summary?days=30",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_finance_summary_returns_control_totals_for_admin(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.admin, employee_id="ADMFINREPORT")
    response = await client.get(
        "/api/v1/admin/reports/finance-summary?days=30",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["invoices"]["gross_total"] >= 0.0
    assert body["payments"]["collected_total"] >= 0.0
    assert body["claims"]["claimed_total"] >= 0.0
    assert set(body["invoices"]["aging"]) == {"0_30_days", "31_60_days", "61_90_days", "over_90_days"}


@pytest.mark.asyncio
async def test_pharmacy_summary_is_restricted_to_pharmacy_roles(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCPHAREPORT")
    response = await client.get(
        "/api/v1/admin/reports/pharmacy-summary?days=30",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_pharmacy_summary_returns_zero_safe_sections_for_admin(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.admin, employee_id="ADMPHAREPORT")
    response = await client.get(
        "/api/v1/admin/reports/pharmacy-summary?days=30",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["inventory"]["active_medicines"] >= 0
    assert body["inventory"]["estimated_value"] >= 0.0
    assert body["dispensing"]["units_dispensed"] >= 0


@pytest.mark.asyncio
async def test_moh_monthly_report_is_admin_only_and_traceable(
    client: AsyncClient, auth_token
):
    doctor_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCMOHREPORT")
    denied = await client.get(
        "/api/v1/admin/reports/moh-monthly?period=2026-09",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert denied.status_code == 403

    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMMOHREPORT")
    response = await client.get(
        "/api/v1/admin/reports/moh-monthly?period=2026-09",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "2026-09"
    assert body["report_type"] == "aggregate_monthly"
    assert "encounters" in body["quality"]["source_tables"]
    assert body["quality"]["maternal_indicators"] is None


@pytest.mark.asyncio
async def test_moh_export_is_append_only_and_hashable(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.admin, employee_id="ADMEXPORTREPORT")
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/api/v1/admin/reports/moh-monthly/exports?period=2026-08", headers=headers
    )
    assert created.status_code == 201
    body = created.json()
    assert len(body["payload_hash"]) == 64
    assert body["report"]["period"] == "2026-08"

    history = await client.get(
        "/api/v1/admin/reports/moh-monthly/exports?period=2026-08", headers=headers
    )
    assert history.status_code == 200
    assert any(item["id"] == body["id"] for item in history.json())


@pytest.mark.asyncio
async def test_patient_flow_report_is_available_as_aggregate_data(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECFLOWREPORT")
    response = await client.get(
        "/api/v1/admin/reports/patient-flow?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert body["appointments"]["total"] >= 0
    assert body["appointments"]["no_shows"] >= 0
    assert body["encounters"]["total"] >= 0


@pytest.mark.asyncio
async def test_data_quality_report_is_admin_only_and_explicit(
    client: AsyncClient, auth_token
):
    doctor_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCDATAQUALITY")
    denied = await client.get(
        "/api/v1/admin/reports/data-quality",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert denied.status_code == 403

    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMDATAQUALITY")
    response = await client.get(
        "/api/v1/admin/reports/data-quality",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"clear", "attention_required"}
    assert body["issue_count"] >= 0
    assert "patients_missing_consent" in body["checks"]


@pytest.mark.asyncio
async def test_provider_performance_report_is_admin_only_and_aggregate(
    client: AsyncClient, auth_token
):
    doctor_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCPROVIDERREPORT")
    denied = await client.get(
        "/api/v1/admin/reports/provider-performance?days=7",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert denied.status_code == 403

    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMPROVIDERREPORT")
    response = await client.get(
        "/api/v1/admin/reports/provider-performance?days=7",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert body["totals"]["providers"] >= 0
    assert isinstance(body["providers"], list)


@pytest.mark.asyncio
async def test_audit_summary_is_admin_only_and_excludes_payloads(
    client: AsyncClient, auth_token
):
    doctor_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCAUDITREPORT")
    denied = await client.get(
        "/api/v1/admin/reports/audit-summary?days=7",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert denied.status_code == 403

    admin_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMAUDITREPORT")
    response = await client.get(
        "/api/v1/admin/reports/audit-summary?days=7",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_events"] >= 0
    assert "by_action" in body
    assert "old_value" not in body
    assert "new_value" not in body


@pytest.mark.asyncio
async def test_demographics_report_returns_aggregate_bands_without_identifiers(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECDEMOREPORT")
    response = await client.get(
        "/api/v1/admin/reports/demographics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_patients"] >= 0
    assert "unknown" in body["by_age_band"]
    assert "first_name" not in body
    assert "date_of_birth" not in body


@pytest.mark.asyncio
async def test_diagnosis_report_is_clinical_role_limited_and_aggregate(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECDIAGREPORT")
    denied = await client.get(
        "/api/v1/admin/reports/diagnoses?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert denied.status_code == 403

    doctor_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCDIAGREPORT")
    response = await client.get(
        "/api/v1/admin/reports/diagnoses?days=7",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["consultations_with_notes"] >= 0
    assert isinstance(body["top_diagnoses"], list)


@pytest.mark.asyncio
async def test_period_comparison_returns_current_previous_and_change(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECCOMPREPORT")
    response = await client.get(
        "/api/v1/admin/reports/comparison?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["current_period"]["end"] != body["previous_period"]["end"]
    assert set(body["current"]) == {"patients", "encounters", "lab_orders", "prescription_items", "paid_revenue"}
    assert body["current"]["paid_revenue"] is None


@pytest.mark.asyncio
async def test_referral_report_returns_aggregate_handoff_metrics(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECREFREPORT")
    response = await client.get(
        "/api/v1/admin/reports/referrals?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert body["total_referrals"] >= 0
    assert "by_status" in body
    assert "reason" not in body


@pytest.mark.asyncio
async def test_inpatient_report_returns_occupancy_aggregates(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.nurse, employee_id="NURINPATIENTREPORT")
    response = await client.get(
        "/api/v1/admin/reports/inpatient?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert body["admissions"] >= 0
    assert body["occupancy"]["occupied_beds"] >= 0
    assert isinstance(body["occupancy"]["wards"], list)


@pytest.mark.asyncio
async def test_theatre_mortuary_report_returns_aggregate_sections(
    client: AsyncClient, auth_token
):
    token, _ = await auth_token(role=UserRole.nurse, employee_id="NURTHEATREMORTREPORT")
    response = await client.get(
        "/api/v1/admin/reports/theatre-mortuary?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert "theatre" in body and "mortuary" in body
    assert "procedure_name" not in body
    assert body["mortuary"]["active_intakes"] >= 0


@pytest.mark.asyncio
async def test_dental_report_is_aggregate_only(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.dentist, employee_id="DENTREPORT")
    response = await client.get(
        "/api/v1/admin/reports/dental?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert "encounters" in body and "treatment_plans" in body
    assert "diagnosis" not in body


@pytest.mark.asyncio
async def test_nursing_operations_report_excludes_clinical_text(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.nurse, employee_id="NUROPSREPORT")
    response = await client.get(
        "/api/v1/admin/reports/nursing-operations?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["period"]["days"] == 7
    assert "nursing" in body and "roster" in body and "handovers" in body
    assert "note_text" not in body


@pytest.mark.asyncio
async def test_new_clinical_reports_enforce_role_boundaries(client: AsyncClient, auth_token):
    token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECREPORTBOUNDARY")
    headers = {"Authorization": f"Bearer {token}"}
    dental = await client.get("/api/v1/admin/reports/dental?days=7", headers=headers)
    nursing = await client.get("/api/v1/admin/reports/nursing-operations?days=7", headers=headers)
    assert dental.status_code == 403
    assert nursing.status_code == 403
