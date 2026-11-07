from decimal import Decimal
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.approvals.models import QuotationApproval, ApprovalStatus
from apps.quotations.models import Quotation, QuotationStatus, APPROVAL_THRESHOLD_INR
from apps.quotations.services.pdf_generator import QuotationPDFGenerator
from apps.rfqs.models import RFQStatus


class QuotationApprovalService:
    """
    Orchestrates the commercial quotation approval lifecycle, audit trails,
    and enforces the mandatory ₹25,00,000 Sales Head authorization threshold.
    """

    @classmethod
    @transaction.atomic
    def submit_for_approval(cls, quotation_id: int, user: User) -> QuotationApproval:
        quotation = Quotation.objects.select_for_update().get(pk=quotation_id)

        # Check if already pending
        existing_pending = quotation.approvals.filter(status=ApprovalStatus.PENDING).first()
        if existing_pending:
            return existing_pending

        # Determine threshold
        if quotation.total_annual_value > APPROVAL_THRESHOLD_INR:
            quotation.requires_approval = True

        quotation.status = QuotationStatus.AWAITING_APPROVAL
        quotation.save(update_fields=["status", "requires_approval", "updated_at"])

        # Update RFQ status
        rfq = quotation.rfq
        rfq.status = RFQStatus.AWAITING_APPROVAL
        rfq.save(update_fields=["status", "updated_at"])

        # Create new audit cycle
        approval = QuotationApproval.objects.create(
            quotation=quotation,
            submitted_by=user,
            status=ApprovalStatus.PENDING,
            revision_number=quotation.version,
            decision_reason="",
        )
        return approval

    @classmethod
    @transaction.atomic
    def approve_quotation(cls, approval_id: int, user: User, reason: str = "") -> QuotationApproval:
        approval = QuotationApproval.objects.select_for_update().select_related("quotation").get(pk=approval_id)

        # RBAC Check: Only Sales Head can approve
        if user.role != UserRole.SALES_HEAD:
            raise PermissionDenied("Only a Sales Head is authorized to approve quotations.")

        # Guard: Estimator cannot approve their own quotation
        if approval.quotation.created_by_id == user.id:
            raise PermissionDenied("Estimators cannot approve their own quotations.")

        # Guard: Cannot approve already finalized quotation
        if approval.status == ApprovalStatus.APPROVED:
            raise ValidationError("This quotation approval has already been finalized as Approved.")

        # Update approval record
        approval.status = ApprovalStatus.APPROVED
        approval.reviewed_by = user
        approval.reviewed_at = timezone.now()
        approval.decision_reason = reason.strip() or "Commercial terms, margin, and delivery terms verified."
        approval.save()

        # Update quotation status
        quotation = approval.quotation
        quotation.status = QuotationStatus.APPROVED
        quotation.save(update_fields=["status", "updated_at"])

        # Update RFQ status
        rfq = quotation.rfq
        rfq.status = RFQStatus.APPROVED
        rfq.save(update_fields=["status", "updated_at"])

        # Generate official customer-facing PDF
        QuotationPDFGenerator.generate_pdf(quotation)

        return approval

    @classmethod
    @transaction.atomic
    def reject_quotation(cls, approval_id: int, user: User, reason: str) -> QuotationApproval:
        approval = QuotationApproval.objects.select_for_update().select_related("quotation").get(pk=approval_id)

        if user.role != UserRole.SALES_HEAD:
            raise PermissionDenied("Only a Sales Head is authorized to reject quotations.")

        # Strict requirement: Reason is mandatory
        if not reason or not reason.strip():
            raise ValidationError("A detailed decision reason is mandatory when rejecting a quotation.")

        approval.status = ApprovalStatus.REJECTED
        approval.reviewed_by = user
        approval.reviewed_at = timezone.now()
        approval.decision_reason = reason.strip()
        approval.save()

        quotation = approval.quotation
        quotation.status = QuotationStatus.REJECTED
        quotation.save(update_fields=["status", "updated_at"])

        # Revert RFQ to Estimating
        rfq = quotation.rfq
        rfq.status = RFQStatus.ESTIMATING
        rfq.save(update_fields=["status", "updated_at"])

        return approval

    @classmethod
    @transaction.atomic
    def request_revision(cls, approval_id: int, user: User, reason: str) -> QuotationApproval:
        approval = QuotationApproval.objects.select_for_update().select_related("quotation").get(pk=approval_id)

        if user.role != UserRole.SALES_HEAD:
            raise PermissionDenied("Only a Sales Head is authorized to request quotation revisions.")

        # Strict requirement: Reason is mandatory
        if not reason or not reason.strip():
            raise ValidationError("A detailed decision reason is mandatory when requesting a quotation revision.")

        approval.status = ApprovalStatus.REVISION_REQUESTED
        approval.reviewed_by = user
        approval.reviewed_at = timezone.now()
        approval.decision_reason = reason.strip()
        approval.save()

        quotation = approval.quotation
        quotation.status = QuotationStatus.REVISION_REQUESTED
        quotation.save(update_fields=["status", "updated_at"])

        rfq = quotation.rfq
        rfq.status = RFQStatus.ESTIMATING
        rfq.save(update_fields=["status", "updated_at"])

        return approval

    @classmethod
    @transaction.atomic
    def resubmit_quotation(cls, quotation_id: int, user: User) -> QuotationApproval:
        quotation = Quotation.objects.select_for_update().get(pk=quotation_id)

        # Increment quotation version
        quotation.version += 1
        quotation.status = QuotationStatus.AWAITING_APPROVAL
        quotation.save(update_fields=["version", "status", "updated_at"])

        rfq = quotation.rfq
        rfq.status = RFQStatus.AWAITING_APPROVAL
        rfq.save(update_fields=["status", "updated_at"])

        # Create a new approval record preserving the full historical audit trail
        new_approval = QuotationApproval.objects.create(
            quotation=quotation,
            submitted_by=user,
            status=ApprovalStatus.PENDING,
            revision_number=quotation.version,
            decision_reason="",
        )
        return new_approval

    @classmethod
    @transaction.atomic
    def send_quotation(cls, quotation_id: int, user: User) -> Quotation:
        quotation = Quotation.objects.select_for_update().get(pk=quotation_id)

        # CRITICAL BACKEND ENFORCEMENT: Above ₹25,00,000 must be approved!
        if quotation.total_annual_value > APPROVAL_THRESHOLD_INR:
            is_approved = quotation.approvals.filter(status=ApprovalStatus.APPROVED).exists()
            if not is_approved or quotation.status != QuotationStatus.APPROVED:
                raise ValidationError(
                    f"Quotation total annual value (₹{quotation.total_annual_value:,.2f}) exceeds ₹25,00,000 "
                    "and strictly requires Sales Head approval before it can be sent to the customer."
                )

        quotation.status = QuotationStatus.SENT
        quotation.save(update_fields=["status", "updated_at"])

        rfq = quotation.rfq
        rfq.status = RFQStatus.SENT
        rfq.save(update_fields=["status", "updated_at"])

        return quotation

