from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from apps.rfqs.models import RFQ
from apps.costing.models import CostingSheet

APPROVAL_THRESHOLD_INR = Decimal("2500000.00")  # ₹25,00,000 threshold


class QuotationStatus(models.TextChoices):
    DRAFT = "Draft", "Draft"
    AWAITING_APPROVAL = "Awaiting Approval", "Awaiting Approval"
    APPROVED = "Approved", "Approved"
    REJECTED = "Rejected", "Rejected"
    REVISION_REQUESTED = "Revision Requested", "Revision Requested"
    SENT = "Sent", "Sent"


class Quotation(models.Model):
    """
    Formal commercial quotation generated from an RFQ and CostingSheet.
    Subject to Sales Head approval if total annual value > ₹25,00,000.
    """
    quotation_number = models.CharField(max_length=64, unique=True, db_index=True)
    rfq = models.ForeignKey(RFQ, on_delete=models.CASCADE, related_name="quotations")
    costing_sheet = models.ForeignKey(
        CostingSheet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotations",
    )
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=32,
        choices=QuotationStatus.choices,
        default=QuotationStatus.DRAFT,
        db_index=True,
    )

    # Customer & Part Commercial Details
    customer_name = models.CharField(max_length=255, db_index=True)
    customer_contact = models.CharField(max_length=255, blank=True, default="")
    customer_address = models.TextField(blank=True, default="")
    part_name = models.CharField(max_length=255, db_index=True)
    drawing_number = models.CharField(max_length=120, default="DRW-PENDING")
    material_spec = models.CharField(max_length=120)
    gross_weight_kg = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    annual_volume = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    # Commercial Values
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    total_annual_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))
    requires_approval = models.BooleanField(default=True)

    # Commercial Terms
    delivery_terms = models.CharField(max_length=255, default="Ex-Works Pune Plant")
    payment_terms = models.CharField(max_length=255, default="30 Days Net from Invoice Date")
    validity_days = models.PositiveIntegerField(default=30)
    quotation_date = models.DateField(auto_now_add=True)

    # Private PDF document storage
    pdf_file_path = models.CharField(max_length=500, blank=True, null=True)
    pdf_generated_at = models.DateTimeField(blank=True, null=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_quotations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quotations"
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"{self.quotation_number} (v{self.version}) - {self.customer_name} [₹{self.unit_price}/pc]"

    def clean(self):
        # Auto-compute requires_approval based on ₹25,00,000 threshold
        if self.total_annual_value > APPROVAL_THRESHOLD_INR:
            self.requires_approval = True

        # Critical backend rule: Unapproved quotes requiring approval cannot be sent!
        if self.status == QuotationStatus.SENT and self.requires_approval:
            # Check if there is an approved status
            if not self.pk or not self.approvals.filter(status="Approved").exists():
                raise ValidationError(
                    "Quotation value exceeds ₹25,00,000 and requires Sales Head approval before it can be sent."
                )
        super().clean()

    def save(self, *args, **kwargs):
        if self.total_annual_value and self.total_annual_value > APPROVAL_THRESHOLD_INR:
            self.requires_approval = True
        self.clean()
        super().save(*args, **kwargs)


class QuotationTier(models.Model):
    """
    Tier-based pricing snapshot for commercial proposal (e.g. 10k, 50k, 180k units).
    """
    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name="tiers",
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price_with_gst = models.DecimalField(max_digits=12, decimal_places=2)
    total_value = models.DecimalField(max_digits=15, decimal_places=2)
    total_with_gst = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        db_table = "quotation_tiers"
        ordering = ["quantity"]

    def __str__(self):
        return f"{self.quantity:,} pcs @ ₹{self.unit_price}/pc"

