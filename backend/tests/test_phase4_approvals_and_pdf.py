from decimal import Decimal
import os
import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
import fitz

from apps.accounts.models import User, UserRole
from apps.approvals.models import QuotationApproval, ApprovalStatus
from apps.approvals.services import QuotationApprovalService
from apps.quotations.models import Quotation, QuotationTier, QuotationStatus, APPROVAL_THRESHOLD_INR
from apps.quotations.services.pdf_generator import QuotationPDFGenerator
from apps.rfqs.models import RFQ, Part, RFQStatus


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def estimator_user(db):
    user, _ = User.objects.get_or_create(
        email="test_est_phase4@forgequote.in",
        defaults={
            "full_name": "Phase 4 Estimator",
            "role": UserRole.ESTIMATOR,
            "is_active": True,
        },
    )
    user.set_password("Estimator@123")
    user.save()
    return user


@pytest.fixture
def sales_head_user(db):
    user, _ = User.objects.get_or_create(
        email="test_sales_phase4@forgequote.in",
        defaults={
            "full_name": "Phase 4 Sales Head",
            "role": UserRole.SALES_HEAD,
            "is_active": True,
        },
    )
    user.set_password("SalesHead@123")
    user.save()
    return user


@pytest.fixture
def sample_rfq_and_part(db, estimator_user):
    rfq = RFQ.objects.create(
        rfq_number="RFQ-P4-TEST",
        customer_name="Test Motors India Ltd",
        industry="Automotive",
        due_date="2026-12-31",
        assigned_estimator=estimator_user,
    )
    part = Part.objects.create(
        rfq=rfq,
        part_name="Test Flange Spindle",
        drawing_number="DRW-P4-001",
        material_spec="EN8",
        gross_weight_kg=Decimal("1.250"),
        annual_volume=30000,
        cycle_time_minutes=Decimal("3.50"),
        machine_hourly_rate_inr=Decimal("850.00"),
    )
    return rfq, part


@pytest.fixture
def high_value_quotation(db, sample_rfq_and_part, estimator_user):
    """Annual value = 30,000 pcs * ₹120.00 = ₹36,00,000 (> ₹25 Lakh)."""
    rfq, part = sample_rfq_and_part
    quote = Quotation.objects.create(
        quotation_number="QT-P4-HIGH-01",
        rfq=rfq,
        version=1,
        status=QuotationStatus.DRAFT,
        customer_name=rfq.customer_name,
        customer_contact="Mr. Sourcing Lead",
        customer_address="Plant 1, Pune",
        part_name=part.part_name,
        drawing_number=part.drawing_number,
        material_spec=part.material_spec,
        gross_weight_kg=part.gross_weight_kg,
        annual_volume=part.annual_volume,
        unit_price=Decimal("120.00"),
        total_annual_value=Decimal("3600000.00"),
        requires_approval=True,
        delivery_terms="Ex-Works Pune",
        payment_terms="30 Days Net",
        created_by=estimator_user,
    )
    QuotationTier.objects.create(
        quotation=quote,
        quantity=part.annual_volume,
        unit_price=Decimal("120.00"),
        gst_amount=Decimal("21.60"),
        unit_price_with_gst=Decimal("141.60"),
        total_value=Decimal("3600000.00"),
        total_with_gst=Decimal("4248000.00"),
    )
    return quote


@pytest.mark.django_db
class TestQuotationApprovalWorkflow:

    def test_submit_for_approval_creates_audit_record(self, high_value_quotation, estimator_user):
        approval = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)
        assert approval.status == ApprovalStatus.PENDING
        assert approval.revision_number == 1
        assert approval.submitted_by == estimator_user

        high_value_quotation.refresh_from_db()
        assert high_value_quotation.status == QuotationStatus.AWAITING_APPROVAL
        assert high_value_quotation.requires_approval is True
        assert high_value_quotation.rfq.status == RFQStatus.AWAITING_APPROVAL

    def test_sales_head_can_approve(self, high_value_quotation, estimator_user, sales_head_user):
        approval = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)

        # Sales head approves
        approved_rec = QuotationApprovalService.approve_quotation(
            approval.id, sales_head_user, reason="Commercial pricing and margin verified."
        )
        assert approved_rec.status == ApprovalStatus.APPROVED
        assert approved_rec.reviewed_by == sales_head_user
        assert approved_rec.reviewed_at is not None

        high_value_quotation.refresh_from_db()
        assert high_value_quotation.status == QuotationStatus.APPROVED
        assert high_value_quotation.rfq.status == RFQStatus.APPROVED
        # PDF is automatically generated upon approval
        assert high_value_quotation.pdf_file_path is not None
        assert os.path.exists(high_value_quotation.pdf_file_path)

    def test_estimator_cannot_approve(self, high_value_quotation, estimator_user):
        approval = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)

        with pytest.raises(PermissionDenied) as exc:
            QuotationApprovalService.approve_quotation(approval.id, estimator_user)
        assert "Only a Sales Head is authorized" in str(exc.value)

    def test_rejection_requires_reason(self, high_value_quotation, estimator_user, sales_head_user):
        approval = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)

        # Attempt to reject with empty reason
        with pytest.raises(ValidationError) as exc:
            QuotationApprovalService.reject_quotation(approval.id, sales_head_user, reason="   ")
        assert "mandatory when rejecting" in str(exc.value)

        # Valid rejection with reason
        rejected_rec = QuotationApprovalService.reject_quotation(
            approval.id, sales_head_user, reason="Margin too low for high-volume automotive tier."
        )
        assert rejected_rec.status == ApprovalStatus.REJECTED
        assert rejected_rec.decision_reason == "Margin too low for high-volume automotive tier."

        high_value_quotation.refresh_from_db()
        assert high_value_quotation.status == QuotationStatus.REJECTED

    def test_revision_request_requires_reason(self, high_value_quotation, estimator_user, sales_head_user):
        approval = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)

        with pytest.raises(ValidationError) as exc:
            QuotationApprovalService.request_revision(approval.id, sales_head_user, reason="")
        assert "mandatory when requesting a quotation revision" in str(exc.value)

        revised_rec = QuotationApprovalService.request_revision(
            approval.id, sales_head_user, reason="Please adjust scrap allowance from 5% to 4%."
        )
        assert revised_rec.status == ApprovalStatus.REVISION_REQUESTED
        high_value_quotation.refresh_from_db()
        assert high_value_quotation.status == QuotationStatus.REVISION_REQUESTED

    def test_approval_history_preserved_on_resubmission(self, high_value_quotation, estimator_user, sales_head_user):
        # Cycle 1: Submit and Request Revision
        app1 = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)
        QuotationApprovalService.request_revision(app1.id, sales_head_user, reason="Revise cycle time.")

        # Cycle 2: Estimator resubmits revised quotation
        app2 = QuotationApprovalService.resubmit_quotation(high_value_quotation.id, estimator_user)

        high_value_quotation.refresh_from_db()
        assert high_value_quotation.version == 2
        assert high_value_quotation.status == QuotationStatus.AWAITING_APPROVAL

        # Verify audit trail has BOTH records preserved
        history = list(high_value_quotation.approvals.order_by("revision_number"))
        assert len(history) == 2
        assert history[0].revision_number == 1
        assert history[0].status == ApprovalStatus.REVISION_REQUESTED
        assert history[1].revision_number == 2
        assert history[1].status == ApprovalStatus.PENDING

    def test_unapproved_quotation_above_25_lakh_cannot_be_sent(self, high_value_quotation, estimator_user):
        # Attempting to send unapproved quotation with value > ₹25L must fail on backend!
        with pytest.raises(ValidationError) as exc:
            QuotationApprovalService.send_quotation(high_value_quotation.id, estimator_user)
        assert "exceeds ₹25,00,000" in str(exc.value)

    def test_approved_quotation_can_be_sent(self, high_value_quotation, estimator_user, sales_head_user):
        app = QuotationApprovalService.submit_for_approval(high_value_quotation.id, estimator_user)
        QuotationApprovalService.approve_quotation(app.id, sales_head_user, reason="Approved")

        sent_quote = QuotationApprovalService.send_quotation(high_value_quotation.id, estimator_user)
        assert sent_quote.status == QuotationStatus.SENT
        assert sent_quote.rfq.status == RFQStatus.SENT


@pytest.mark.django_db
class TestQuotationPDFGenerationAndSecurity:

    def test_pdf_generation_succeeds_and_file_exists(self, high_value_quotation):
        pdf_path = QuotationPDFGenerator.generate_pdf(high_value_quotation)
        assert os.path.exists(pdf_path)
        assert pdf_path.endswith(".pdf")

        high_value_quotation.refresh_from_db()
        assert high_value_quotation.pdf_file_path == pdf_path
        assert high_value_quotation.pdf_generated_at is not None

    def test_pdf_contains_customer_info_and_never_exposes_internal_costs(self, high_value_quotation):
        pdf_path = QuotationPDFGenerator.generate_pdf(high_value_quotation)

        # Inspect generated PDF text using PyMuPDF
        doc = fitz.open(pdf_path)
        extracted_text = ""
        for page in doc:
            extracted_text += page.get_text() + "\n"
        doc.close()

        # 1. Assert customer-facing information IS PRESENT
        assert "COMMERCIAL QUOTATION" in extracted_text
        assert high_value_quotation.quotation_number in extracted_text
        assert high_value_quotation.customer_name in extracted_text
        assert high_value_quotation.part_name in extracted_text
        assert high_value_quotation.material_spec in extracted_text
        assert "30,000 pcs" in extracted_text
        assert "120.00" in extracted_text
        assert "Ex-Works Pune" in extracted_text

        # 2. CRITICAL SECURITY ASSERTIONS: NEVER EXPOSE INTERNAL COSTS!
        lower_text = extracted_text.lower()
        assert "internal margin" not in lower_text
        assert "margin percentage" not in lower_text
        assert "machine hourly rate" not in lower_text
        assert "cycle time" not in lower_text
        assert "scrap allowance" not in lower_text
        assert "internal material rate" not in lower_text

    def test_unauthorized_user_cannot_download_pdf(self, api_client, high_value_quotation):
        # Anonymous unauthenticated user
        resp = api_client.get(f"/api/v1/quotations/{high_value_quotation.id}/pdf")
        assert resp.status_code == 401

    def test_authorized_user_can_download_pdf(self, api_client, high_value_quotation, estimator_user):
        api_client.force_authenticate(user=estimator_user)
        resp = api_client.get(f"/api/v1/quotations/{high_value_quotation.id}/pdf")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/pdf"
        assert f'filename="{high_value_quotation.quotation_number}_v{high_value_quotation.version}.pdf"' in resp["Content-Disposition"]

