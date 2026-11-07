from decimal import Decimal
import io
import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
import openpyxl
import fitz

from apps.accounts.models import User, UserRole
from apps.ai_intake.models import (
    IntakeSession,
    IntakeDocument,
    ExtractedField,
    SuggestedRouting,
    IntakeSessionStatus,
    IntakeDocumentType,
    ExtractionFieldStatus,
)
from apps.ai_intake.services.document_parser import PDFParser, ExcelParser
from apps.ai_intake.services.ai_extraction import AIExtractionService
from apps.history.models import HistoricalQuotation, HistoricalQuotationOperation, HistoricalQuoteStatus
from apps.history.services import HistoricalQuoteSearchService
from apps.rfqs.models import RFQ, Part


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def estimator_user(db):
    user, _ = User.objects.get_or_create(
        email="test_estimator@forgequote.in",
        defaults={
            "full_name": "Test Estimator",
            "role": UserRole.ESTIMATOR,
            "is_active": True,
        },
    )
    user.set_password("Estimator@123")
    user.save()
    return user


@pytest.fixture
def sales_user(db):
    user, _ = User.objects.get_or_create(
        email="test_sales@forgequote.in",
        defaults={
            "full_name": "Test Sales Head",
            "role": UserRole.SALES_HEAD,
            "is_active": True,
        },
    )
    user.set_password("SalesHead@123")
    user.save()
    return user


@pytest.fixture
def sample_pdf_bytes():
    """Generates a real PDF in memory with RFQ drawing details."""
    doc = fitz.open()
    page = doc.new_page()
    text = (
        "BHARAT FORGE ENGINEERING TENDER\n"
        "Customer: Tata Motors Passenger Vehicles\n"
        "RFQ Number: RFQ-2611-999\n"
        "Part Name: Front Wheel Stub Axle\n"
        "Drawing Number: DRW-TMPV-7788\n"
        "Material Grade: 20MnCr5\n"
        "Gross Weight: 2.350 kg\n"
        "Annual Volume: 45,000 pcs\n"
        "Due Date: 2026-12-20\n"
        "Delivery Terms: FOB Sanand Plant\n"
    )
    page.insert_text((50, 72), text, fontsize=12)
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes


@pytest.fixture
def sample_excel_bytes():
    """Generates an Excel workbook with valid and invalid part rows."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "PartList"
    ws.append(["Part Name", "Drawing No", "Material Grade", "Gross Weight (kg)", "Annual Volume", "Customer"])
    # Valid row
    ws.append(["Bevel Pinion Gear", "DRW-BP-101", "20MnCr5", 1.85, 30000, "Carraro Drivetech"])
    # Invalid row: negative weight
    ws.append(["Damaged Shaft", "DRW-ERR-01", "EN8", -0.50, 10000, "Unknown"])
    # Invalid row: missing part name
    ws.append(["", "DRW-ERR-02", "EN19", 2.10, 5000, "Unknown"])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


@pytest.mark.django_db
class TestDocumentParsingAndIntake:

    def test_pdf_text_extraction(self, sample_pdf_bytes):
        pages = PDFParser.extract_text_pages(sample_pdf_bytes, "drawing_test.pdf")
        assert len(pages) == 1
        assert "Tata Motors" in pages[0]["text"]
        assert pages[0]["document_name"] == "drawing_test.pdf"

        candidates = PDFParser.extract_candidate_fields(pages)
        assert candidates["customer_name"]["suggested_value"] == "Tata Motors Passenger Vehicles"
        assert candidates["rfq_number"]["suggested_value"] == "RFQ-2611-999"
        assert candidates["part_name"]["suggested_value"] == "Front Wheel Stub Axle"
        assert candidates["drawing_number"]["suggested_value"] == "DRW-TMPV-7788"
        assert candidates["material_spec"]["suggested_value"] == "20MnCr5"
        assert Decimal(candidates["gross_weight_kg"]["suggested_value"]) == Decimal("2.350")
        assert candidates["annual_volume"]["suggested_value"] == "45000"
        assert candidates["due_date"]["suggested_value"] == "2026-12-20"
        assert candidates["delivery_requirements"]["suggested_value"] == "FOB Sanand Plant"

    def test_invalid_file_upload_rejected(self, api_client, estimator_user):
        api_client.force_authenticate(user=estimator_user)
        session = IntakeSession.objects.create(title="Invalid Upload Session", created_by=estimator_user)

        # Upload an illegal file type (.exe)
        bad_file = SimpleUploadedFile("payload.exe", b"binary content", content_type="application/octet-stream")
        resp = api_client.post(
            f"/api/v1/intake/sessions/{session.id}/upload",
            {"files": [bad_file]},
            format="multipart",
        )
        assert resp.status_code == 400
        assert "not supported" in resp.data["detail"]

    def test_excel_import_and_invalid_row_handling(self, sample_excel_bytes):
        result = ExcelParser.parse_excel_parts(sample_excel_bytes, "parts_import.xlsx")
        assert result["total_rows"] == 3
        assert len(result["valid_rows"]) == 1
        assert len(result["invalid_rows"]) == 2

        valid = result["valid_rows"][0]
        assert valid["part_name"] == "Bevel Pinion Gear"
        assert valid["gross_weight_kg"] == 1.85
        assert valid["annual_volume"] == 30000

        # Assert specific error messages on invalid rows
        inv1 = result["invalid_rows"][0]
        assert "Gross weight must be positive" in inv1["errors"]
        inv2 = result["invalid_rows"][1]
        assert "Missing Part Name" in inv2["errors"]

    def test_ai_extraction_response_validation(self, sample_pdf_bytes):
        docs = [{
            "file_name": "test_tender.pdf",
            "file_type": "PDF_RFQ",
            "file_bytes": sample_pdf_bytes,
        }]
        res = AIExtractionService.process_intake_documents(docs, intake_session_id=1)
        assert "extracted_fields" in res
        assert "routing_suggestions" in res

        fields = {f["field_key"]: f for f in res["extracted_fields"]}
        assert "part_name" in fields
        assert fields["part_name"]["suggested_value"] == "Front Wheel Stub Axle"
        assert fields["part_name"]["confidence_score"] >= Decimal("0.80")
        assert "source_snippet" in fields["part_name"]

    def test_rejected_ai_suggestion_not_saved_to_rfq(self, api_client, estimator_user):
        api_client.force_authenticate(user=estimator_user)
        session = IntakeSession.objects.create(title="Rejection Test Session", created_by=estimator_user)

        # Field 1: Accepted customer
        ExtractedField.objects.create(
            session=session,
            field_key="customer_name",
            field_label="Customer Name",
            suggested_value="Confirmed Automotive OEM",
            status=ExtractionFieldStatus.ACCEPTED,
            is_confirmed=True,
        )
        # Field 2: REJECTED AI suggestion
        ExtractedField.objects.create(
            session=session,
            field_key="drawing_number",
            field_label="Drawing Number",
            suggested_value="HALLUCINATED-DWG-999",
            status=ExtractionFieldStatus.REJECTED,
            is_confirmed=False,
        )
        # Mandatory fields
        ExtractedField.objects.create(
            session=session,
            field_key="part_name",
            field_label="Part Name",
            suggested_value="Spur Gear Blank",
            status=ExtractionFieldStatus.ACCEPTED,
        )

        resp = api_client.post(f"/api/v1/intake/sessions/{session.id}/commit", {})
        assert resp.status_code == 201

        created_rfq = RFQ.objects.get(id=resp.data["rfq_id"])
        part = created_rfq.parts.first()
        # The rejected hallucinated drawing number MUST NOT be saved!
        assert part.drawing_number != "HALLUCINATED-DWG-999"
        assert part.drawing_number == "DRW-PENDING"

    def test_edited_ai_suggestion_saved_correctly(self, api_client, estimator_user):
        api_client.force_authenticate(user=estimator_user)
        session = IntakeSession.objects.create(title="Edit Test Session", created_by=estimator_user)

        field = ExtractedField.objects.create(
            session=session,
            field_key="gross_weight_kg",
            field_label="Gross Weight (kg)",
            suggested_value="1.000",
            status=ExtractionFieldStatus.PENDING,
        )

        # Estimator edits the field
        patch_resp = api_client.patch(
            f"/api/v1/intake/sessions/{session.id}/fields/{field.id}",
            {"status": "EDITED", "confirmed_value": "3.450"},
        )
        assert patch_resp.status_code == 200
        assert patch_resp.data["confirmed_value"] == "3.450"

        # Commit
        commit_resp = api_client.post(f"/api/v1/intake/sessions/{session.id}/commit", {
            "customer_name": "Mahindra Auto",
            "part_name": "Heavy Yoke",
        })
        assert commit_resp.status_code == 201

        created_rfq = RFQ.objects.get(id=commit_resp.data["rfq_id"])
        part = created_rfq.parts.first()
        assert part.gross_weight_kg == Decimal("3.450")

    def test_estimator_authorization_enforced(self, api_client, sales_user):
        # Sales head cannot create or commit RFQ (only estimators can)
        api_client.force_authenticate(user=sales_user)
        session = IntakeSession.objects.create(title="Auth Session")

        resp = api_client.post(f"/api/v1/intake/sessions/{session.id}/commit", {})
        assert resp.status_code == 403


@pytest.mark.django_db
class TestHistoricalQuoteSearchAndImmutability:

    @pytest.fixture(autouse=True)
    def setup_historical_quotes(self):
        hq1 = HistoricalQuotation.objects.create(
            quote_number="HQ-TEST-001",
            rfq_reference="RFQ-TEST-A",
            customer_name="Tata Motors",
            part_name="Rear Axle Spindle",
            drawing_number="DRW-SP-01",
            material_grade="EN8",
            gross_weight_kg=Decimal("0.620"),
            annual_volume=180000,
            quoted_date="2025-05-10",
            status=HistoricalQuoteStatus.WON,
            material_rate_per_kg=Decimal("75.00"),
            material_cost=Decimal("46.50"),
            processing_cost=Decimal("40.00"),
            final_price_per_unit=Decimal("115.00"),
            is_locked=True,
        )
        HistoricalQuotationOperation.objects.create(
            quotation=hq1,
            sequence=1,
            operation_name="Hot Forging",
            work_center="Forging Press 1600T",
            cycle_time_minutes=Decimal("1.20"),
            machine_hourly_rate=Decimal("1800.00"),
            processing_cost=Decimal("36.00"),
        )
        HistoricalQuotationOperation.objects.create(
            quotation=hq1,
            sequence=2,
            operation_name="CNC Finish Turning",
            work_center="CNC Turning Center",
            cycle_time_minutes=Decimal("3.00"),
            machine_hourly_rate=Decimal("850.00"),
            processing_cost=Decimal("42.50"),
        )

        HistoricalQuotation.objects.create(
            quote_number="HQ-TEST-002",
            rfq_reference="RFQ-TEST-B",
            customer_name="Dana Spicer",
            part_name="Sun Gear Blank",
            drawing_number="DRW-GB-02",
            material_grade="20MnCr5",
            gross_weight_kg=Decimal("1.500"),
            annual_volume=60000,
            quoted_date="2025-07-15",
            status=HistoricalQuoteStatus.WON,
            material_rate_per_kg=Decimal("88.00"),
            material_cost=Decimal("132.00"),
            processing_cost=Decimal("70.00"),
            final_price_per_unit=Decimal("265.00"),
            is_locked=True,
        )

    def test_historical_quote_filtering_and_similarity_scoring(self, api_client, estimator_user):
        api_client.force_authenticate(user=estimator_user)

        # Search with target geometry: spindle in EN8 around 0.60 kg
        resp = api_client.get(
            "/api/v1/history/quotes",
            {
                "part_name": "Spindle",
                "material_grade": "EN8",
                "reference_weight": "0.610",
                "reference_grade": "EN8",
            },
        )
        assert resp.status_code == 200
        results = resp.data
        assert len(results) >= 1

        top_match = results[0]
        assert top_match["quote_number"] == "HQ-TEST-001"
        assert top_match["similarity_score"] >= 80
        assert any("EN8" in r for r in top_match["similarity_reasons"])
        assert any("Geometry" in r or "geometry" in r for r in top_match["similarity_reasons"])

    def test_historical_quotation_immutability(self):
        hq = HistoricalQuotation.objects.get(quote_number="HQ-TEST-001")
        # Attempting to mutate price or grade must raise ValidationError
        hq.final_price_per_unit = Decimal("999.99")
        with pytest.raises(ValidationError) as exc:
            hq.save()
        assert "immutable" in str(exc.value).lower()

    def test_routing_suggestions_from_history(self):
        # When extracting an EN8 spindle around 0.61 kg, routing should recommend forging + turning
        routings = AIExtractionService.suggest_routing_from_history(
            part_name="Rear Wheel Spindle",
            material_grade="EN8",
            gross_weight=Decimal("0.610"),
        )
        assert len(routings) >= 2
        op_names = [r["operation_name"] for r in routings]
        assert any("Forging" in name for name in op_names)
        assert any("Turning" in name for name in op_names)
        assert "HQ-TEST-001" in routings[0]["matched_historical_part_name"]

    def test_compare_two_quotes_variance(self, api_client, estimator_user):
        api_client.force_authenticate(user=estimator_user)
        q1 = HistoricalQuotation.objects.get(quote_number="HQ-TEST-001")
        q2 = HistoricalQuotation.objects.get(quote_number="HQ-TEST-002")

        resp = api_client.post(
            "/api/v1/history/compare",
            {"quote_id_a": q1.id, "quote_id_b": q2.id},
        )
        assert resp.status_code == 200
        variances = resp.data["variances"]
        assert variances["unit_price_delta"] == 150.00  # 265 - 115
        assert variances["weight_delta_kg"] == 0.880  # 1.500 - 0.620
        assert variances["material_match"] is False

