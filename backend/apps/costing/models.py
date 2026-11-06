from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from apps.rfqs.models import RFQ, Part
from apps.rate_masters.models import MaterialRate, MachineRate


class CostingSheet(models.Model):
    """
    Immutable costing calculation sheet tied to an RFQ part.
    Saves and preserves snapshot values of material and machine rates so
    that future rate master edits never dynamically change old quotations.
    """
    part = models.OneToOneField(Part, on_delete=models.CASCADE, related_name="costing_sheet")
    costing_date = models.DateField(auto_now_add=True, db_index=True)
    status = models.CharField(max_length=30, default="Draft") # Draft, Saved, Frozen

    # Material Snapshot
    material_rate_record = models.ForeignKey(
        MaterialRate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="costing_sheets",
    )
    material_grade_snapshot = models.CharField(max_length=120)
    material_rate_per_kg_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    gross_weight_kg = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    scrap_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("5.00"),
    )
    material_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # Overheads and add-on costs
    labour_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    overhead_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    freight_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    other_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Processing & Manufacturing Subtotals
    total_processing_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    manufacturing_subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Margin & Quotation Unit Price
    margin_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("15.00"))
    margin_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    final_price_per_unit = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Taxes
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_price_with_gst = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "costing_sheets"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Costing #{self.id} for Part: {self.part.part_name} (₹{self.final_price_per_unit}/unit)"


class CostingOperation(models.Model):
    """
    Individual manufacturing operations snapshot for a costing sheet.
    """
    costing_sheet = models.ForeignKey(
        CostingSheet,
        on_delete=models.CASCADE,
        related_name="operations",
    )
    machine_rate_record = models.ForeignKey(
        MachineRate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    operation_name = models.CharField(max_length=150)
    work_center = models.CharField(max_length=120)
    cycle_time_minutes = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    machine_hourly_rate_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    processing_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    sequence = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = "costing_operations"
        ordering = ["sequence", "id"]

    def __str__(self):
        return f"{self.sequence}. {self.operation_name} ({self.work_center}) - ₹{self.processing_cost}"


class CostingVolumeTier(models.Model):
    """
    Tier-based quantity breaks (e.g. 10k, 50k, 180k) with per-unit price and total order value.
    """
    costing_sheet = models.ForeignKey(
        CostingSheet,
        on_delete=models.CASCADE,
        related_name="volume_tiers",
    )
    quantity = models.PositiveIntegerField()
    manufacturing_cost_per_unit = models.DecimalField(max_digits=12, decimal_places=2)
    margin_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    margin_per_unit = models.DecimalField(max_digits=12, decimal_places=2)
    quotation_price_per_unit = models.DecimalField(max_digits=12, decimal_places=2)
    gst_per_unit = models.DecimalField(max_digits=12, decimal_places=2)
    price_with_gst_per_unit = models.DecimalField(max_digits=12, decimal_places=2)
    total_quotation_value = models.DecimalField(max_digits=15, decimal_places=2)
    total_gst = models.DecimalField(max_digits=15, decimal_places=2)
    grand_total_with_gst = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        db_table = "costing_volume_tiers"
        ordering = ["quantity"]

    def __str__(self):
        return f"{self.quantity:,} pcs @ ₹{self.quotation_price_per_unit}/unit (Total: ₹{self.total_quotation_value:,})"

