from django.conf import settings
from django.db import models
from apps.quotations.models import Quotation


class ApprovalStatus(models.TextChoices):
    PENDING = "Pending", "Pending"
    APPROVED = "Approved", "Approved"
    REJECTED = "Rejected", "Rejected"
    REVISION_REQUESTED = "Revision Requested", "Revision Requested"


class QuotationApproval(models.Model):
    """
    Audit-safe approval lifecycle record for quotations.
    Maintains an immutable historical log of all review cycles, reasons, and timestamps.
    """
    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name="approvals",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="submitted_approvals",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_approvals",
    )
    status = models.CharField(
        max_length=32,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        db_index=True,
    )
    decision_reason = models.TextField(blank=True, default="")
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    revision_number = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "quotation_approvals"
        ordering = ["-submitted_at", "-id"]

    def __str__(self):
        reviewer = self.reviewed_by.full_name if self.reviewed_by else "Pending Review"
        return f"Approval #{self.id} for {self.quotation.quotation_number} (Rev {self.revision_number}): {self.status} by {reviewer}"

