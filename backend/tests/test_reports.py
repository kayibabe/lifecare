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
