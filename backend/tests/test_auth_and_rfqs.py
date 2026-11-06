import pytest
from datetime import date, timedelta

pytestmark = pytest.mark.django_db


def get_auth_headers(api_client, email: str, password: str) -> dict:
    response = api_client.post(
        "/api/v1/auth/login",
        {"email": email, "password": password},
        format="json",
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def test_login_success_and_me(api_client):
    res = api_client.post(
        "/api/v1/auth/login",
        {"email": "estimator@forgequote.in", "password": "Estimator@123"},
        format="json",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "ESTIMATOR"
    assert "access_token" in data

    me_res = api_client.get(
        "/api/v1/auth/me",
        HTTP_AUTHORIZATION=f"Bearer {data['access_token']}",
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "estimator@forgequote.in"


def test_login_invalid_password(api_client):
    res = api_client.post(
        "/api/v1/auth/login",
        {"email": "estimator@forgequote.in", "password": "WrongPassword999"},
        format="json",
    )
    assert res.status_code == 401


def test_protected_endpoint_requires_jwt(api_client):
    res = api_client.get("/api/v1/rfqs")
    assert res.status_code == 401


def test_seeded_rfqs_exist(api_client):
    headers = get_auth_headers(api_client, "estimator@forgequote.in", "Estimator@123")
    res = api_client.get("/api/v1/rfqs", **headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 3
    rfq_numbers = {item["rfq_number"] for item in body["items"]}
    assert {"RFQ-2611-014", "RFQ-2611-019", "RFQ-2611-023"} == rfq_numbers


def test_role_restriction_sales_head_cannot_create_rfq(api_client):
    headers = get_auth_headers(api_client, "saleshead@forgequote.in", "SalesHead@123")
    payload = {
        "rfq_number": "RFQ-2611-099",
        "customer_name": "Company X",
        "industry": "Automotive",
        "due_date": str(date.today() + timedelta(days=7)),
        "part": {
            "part_name": "Pinion Shaft",
            "drawing_number": "DRW-991",
            "material_spec": "16MnCr5",
            "gross_weight_kg": "1.250",
            "annual_volume": 45000,
            "cycle_time_minutes": "4.10",
            "machine_hourly_rate_inr": "900.00",
        },
    }
    res = api_client.post("/api/v1/rfqs", payload, format="json", **headers)
    assert res.status_code == 403


def test_estimator_can_create_and_update_rfq(api_client):
    headers = get_auth_headers(api_client, "estimator@forgequote.in", "Estimator@123")
    payload = {
        "rfq_number": "RFQ-2611-050",
        "customer_name": "Bharat Axles Ltd",
        "industry": "Commercial Vehicles",
        "due_date": str(date.today() + timedelta(days=6)),
        "part": {
            "part_name": "Stub Axle Forging",
            "drawing_number": "DRW-CV-332",
            "material_spec": "42CrMo4",
            "gross_weight_kg": "6.800",
            "annual_volume": 15000,
            "cycle_time_minutes": "14.50",
            "machine_hourly_rate_inr": "1550.00",
        },
    }
    create_res = api_client.post("/api/v1/rfqs", payload, format="json", **headers)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    patch_res = api_client.patch(
        f"/api/v1/rfqs/{created_id}",
        {"status": "Estimating", "annual_volume": 18000},
        format="json",
        **headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "Estimating"
    assert patch_res.json()["parts"][0]["annual_volume"] == 18000