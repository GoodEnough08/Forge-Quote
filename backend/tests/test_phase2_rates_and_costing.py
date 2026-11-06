import pytest
from datetime import date, timedelta
from decimal import Decimal
from django.core.exceptions import ValidationError

from apps.costing.services.costing_engine import CostingEngine, OperationInput
from apps.rate_masters.models import MaterialRate, MachineRate
from apps.rate_masters.services import RateService
from apps.costing.models import CostingSheet, CostingOperation, CostingVolumeTier
from apps.rfqs.models import RFQ, Part

pytestmark = pytest.mark.django_db


def get_auth_headers(api_client, email: str = "estimator@forgequote.in", password: str = "Estimator@123") -> dict:
    response = api_client.post(
        "/api/v1/auth/login",
        {"email": email, "password": password},
        format="json",
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class TestCostingEngineDeterministicCalculations:
    def test_material_cost_and_scrap_precision(self):
        # Gross weight 0.610 kg, rate 72.50, scrap 5%
        # Formula: 0.610 * 72.50 * 1.05 = 46.43625 -> 46.44
        result = CostingEngine.calculate(
            gross_weight_kg=Decimal("0.610"),
            material_rate_per_kg=Decimal("72.50"),
            scrap_percentage=Decimal("5.00"),
            operations=[],
            margin_percentage=Decimal("0.00"),
            gst_percentage=Decimal("0.00"),
        )
        assert result.material_cost == Decimal("46.44")
        assert result.manufacturing_subtotal == Decimal("46.44")

    def test_single_operation_processing_cost(self):
        # 3.20 min @ ₹850/hr -> (3.20 / 60) * 850 = 45.333... -> 45.33
        op = OperationInput(
            operation_name="CNC Turning",
            work_center="CNC",
            cycle_time_minutes=Decimal("3.20"),
            machine_hourly_rate=Decimal("850.00"),
        )
        result = CostingEngine.calculate(
            gross_weight_kg=Decimal("0.000"),
            material_rate_per_kg=Decimal("0.00"),
            scrap_percentage=Decimal("0.00"),
            operations=[op],
            margin_percentage=Decimal("0.00"),
            gst_percentage=Decimal("0.00"),
        )
        assert len(result.operations) == 1
        assert result.operations[0].processing_cost == Decimal("45.33")
        assert result.total_processing_cost == Decimal("45.33")

    def test_multiple_operations_accumulation(self):
        # Op 1: 10.0 min @ ₹1200/hr = (10/60)*1200 = 200.00
        # Op 2: 5.0 min @ ₹600/hr = (5/60)*600 = 50.00
        # Op 3: 2.0 min @ ₹900/hr = (2/60)*900 = 30.00
        # Total processing = 280.00
        ops = [
            OperationInput("Rough Turning", "CNC-1", Decimal("10.00"), Decimal("1200.00")),
            OperationInput("Drilling", "Drill-Line", Decimal("5.00"), Decimal("600.00")),
            OperationInput("Deburring", "Bench", Decimal("2.00"), Decimal("900.00")),
        ]
        result = CostingEngine.calculate(
            gross_weight_kg=Decimal("1.000"),
            material_rate_per_kg=Decimal("100.00"),
            scrap_percentage=Decimal("0.00"), # material = 100.00
            operations=ops,
            labour_cost=Decimal("20.00"),
            overhead_cost=Decimal("15.00"),
            margin_percentage=Decimal("10.00"),
            gst_percentage=Decimal("18.00"),
        )
        assert result.material_cost == Decimal("100.00")
        assert result.total_processing_cost == Decimal("280.00")
        # Subtotal: 100 + 280 + 20 + 15 = 415.00
        assert result.manufacturing_subtotal == Decimal("415.00")
        # Margin: 415 * 0.10 = 41.50
        assert result.margin_amount == Decimal("41.50")
        # Unit price: 415 + 41.50 = 456.50
        assert result.final_price_per_unit == Decimal("456.50")
        # GST: 456.50 * 0.18 = 82.17
        assert result.gst_amount == Decimal("82.17")
        assert result.total_price_with_gst_per_unit == Decimal("538.67")

    def test_negative_inputs_and_invalid_percentages_rejected(self):
        with pytest.raises(ValueError, match="Gross weight cannot be negative"):
            CostingEngine.calculate(
                gross_weight_kg=Decimal("-1.00"),
                material_rate_per_kg=Decimal("50.00"),
                scrap_percentage=Decimal("5.00"),
                operations=[],
            )

        with pytest.raises(ValueError, match="Margin percentage must be between 0 and 100%"):
            CostingEngine.calculate(
                gross_weight_kg=Decimal("1.00"),
                material_rate_per_kg=Decimal("50.00"),
                scrap_percentage=Decimal("5.00"),
                operations=[],
                margin_percentage=Decimal("150.00"),
            )

    def test_volume_tier_calculations(self):
        op = OperationInput("Turning", "CNC", Decimal("6.00"), Decimal("1000.00")) # 100.00
        base = CostingEngine.calculate(
            gross_weight_kg=Decimal("2.000"),
            material_rate_per_kg=Decimal("50.00"),
            scrap_percentage=Decimal("0.00"), # 100.00
            operations=[op],
            margin_percentage=Decimal("20.00"),
            gst_percentage=Decimal("18.00"),
        )
        # Subtotal: 200.00
        # Tier 1: 10,000 pcs, fixed setup = 50,000 -> unit setup = 5.00 -> subtotal = 205.00
        tier1 = CostingEngine.calculate_volume_tier(
            base,
            quantity=10000,
            fixed_setup_cost=Decimal("50000.00"),
            volume_margin_percentage=Decimal("20.00"),
        )
        assert Decimal(tier1["manufacturing_cost_per_unit"]) == Decimal("205.00")
        assert Decimal(tier1["margin_per_unit"]) == Decimal("41.00") # 205 * 0.2
        assert Decimal(tier1["quotation_price_per_unit"]) == Decimal("246.00")
        assert Decimal(tier1["total_quotation_value"]) == Decimal("2460000.00") # 246 * 10,000


class TestRateMasterVersioningAndSnapshotPreservation:
    def test_rate_lookup_by_effective_date(self):
        # EN8 seeded rate is 72.50 valid from 60 days ago
        today = date.today()
        mat = RateService.get_applicable_material_rate("EN8", as_of_date=today)
        assert mat is not None
        assert mat.rate_per_kg == Decimal("72.50")

    def test_prevent_overlapping_rate_periods(self):
        today = date.today()
        # Trying to create another active rate for EN8 that overlaps with the open-ended period
        with pytest.raises(ValidationError):
            rate = MaterialRate(
                material_name="Carbon Steel",
                material_grade="EN8",
                rate_per_kg=Decimal("80.00"),
                effective_from=today,
                effective_until=None,
                is_active=True,
            )
            rate.clean()

    def test_updating_master_rate_does_not_modify_existing_quotation_snapshot(self):
        part = Part.objects.first()
        assert part is not None

        # Create a saved CostingSheet snapshot with 72.50 rate
        sheet = CostingSheet.objects.create(
            part=part,
            material_grade_snapshot="EN8",
            material_rate_per_kg_snapshot=Decimal("72.50"),
            gross_weight_kg=Decimal("1.000"),
            scrap_percentage=Decimal("0.00"),
            material_cost=Decimal("72.50"),
            manufacturing_subtotal=Decimal("172.50"),
            final_price_per_unit=Decimal("200.00"),
            total_price_with_gst=Decimal("236.00"),
        )

        # Now simulate market price hike in rate master for EN8
        current_rate = MaterialRate.objects.filter(material_grade__iexact="EN8").first()
        assert current_rate is not None
        current_rate.rate_per_kg = Decimal("110.00")
        current_rate.save()

        # Reload the saved costing sheet from database
        sheet.refresh_from_db()
        assert sheet.material_rate_per_kg_snapshot == Decimal("72.50")
        assert sheet.final_price_per_unit == Decimal("200.00")


class TestCostingAndRateAPIs:
    def test_rate_masters_list_and_lookup_api(self, api_client):
        headers = get_auth_headers(api_client)
        res = api_client.get("/api/v1/rates/materials", **headers)
        assert res.status_code == 200
        assert len(res.json()) >= 3

        mach_res = api_client.get("/api/v1/rates/machines", **headers)
        assert mach_res.status_code == 200
        assert len(mach_res.json()) >= 3

        lookup = api_client.get("/api/v1/rates/lookup?grade=EN8&work_center=CNC Turning", **headers)
        assert lookup.status_code == 200
        data = lookup.json()
        assert data["material_rate"]["material_grade"] == "EN8"
        assert Decimal(data["material_rate"]["rate_per_kg"]) > Decimal("0.00")

    def test_calculate_costing_api(self, api_client):
        headers = get_auth_headers(api_client)
        payload = {
            "gross_weight_kg": "0.610",
            "material_rate_per_kg": "72.50",
            "material_grade": "EN8",
            "scrap_percentage": "5.00",
            "operations": [
                {
                    "operation_name": "Cold Forging + CNC Turning",
                    "work_center": "CNC Turning",
                    "cycle_time_minutes": "3.20",
                    "machine_hourly_rate": "850.00",
                }
            ],
            "margin_percentage": "15.00",
            "gst_percentage": "18.00",
        }
        res = api_client.post("/api/v1/costing/calculate", payload, format="json", **headers)
        assert res.status_code == 200
        body = res.json()
        assert Decimal(body["material_cost"]) == Decimal("46.44")
        assert Decimal(body["total_processing_cost"]) == Decimal("45.33")
        assert len(body["volume_tiers"]) == 3

    def test_save_and_retrieve_costing_draft(self, api_client):
        headers = get_auth_headers(api_client)
        part = Part.objects.first()
        rfq = part.rfq

        payload = {
            "part_id": part.id,
            "gross_weight_kg": "0.610",
            "material_rate_per_kg": "72.50",
            "material_grade": "EN8",
            "scrap_percentage": "5.00",
            "operations": [
                {
                    "operation_name": "Cold Forging + CNC",
                    "work_center": "CNC",
                    "cycle_time_minutes": "3.20",
                    "machine_hourly_rate": "850.00",
                }
            ],
            "labour_cost": "5.00",
            "overhead_cost": "10.00",
            "margin_percentage": "15.00",
            "gst_percentage": "18.00",
        }
        save_res = api_client.post("/api/v1/costing/draft", payload, format="json", **headers)
        assert save_res.status_code == 201
        assert save_res.json()["part_id"] == part.id

        # Retrieve via RFQ
        get_res = api_client.get(f"/api/v1/costing/rfq/{rfq.id}", **headers)
        assert get_res.status_code == 200
        assert get_res.json()["has_draft"] is True
        assert get_res.json()["costing_sheet"]["material_grade_snapshot"] == "EN8"

