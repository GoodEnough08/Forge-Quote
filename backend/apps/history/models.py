from decimal import Decimal
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class HistoricalQuoteStatus(models.TextChoices):
    WON = "Won", "Won"
    LOST = "Lost", "Lost"
    EXPIRED = "Expired", "Expired"
    QUOTED = "Quoted", "Quoted"


class HistoricalQuotation(models.Model):
    """
    Immutable archive of historical quotations used for retrieval,
    statistical similarity scoring, and reference routing.
    """
    quote_number = models.CharField(max_length=64, unique=True, db_index=True)
    rfq_reference = models.CharField(max_length=64, db_index=True)
    customer_name = models.CharField(max_length=255, db_index=True)
    part_name = models.CharField(max_length=255, db_index=True)
    drawing_number = models.CharField(max_length=120, db_index=True, default="TBD")
    material_grade = models.CharField(max_length=120, db_index=True)
    gross_weight_kg = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    annual_volume = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    quoted_date = models.DateField(db_index=True)
    status = models.CharField(
        max_length=32,
        choices=HistoricalQuoteStatus.choices,
        default=HistoricalQuoteStatus.QUOTED,
        db_index=True,
    )

    # Cost breakdown snapshot
    material_rate_per_kg = models.DecimalField(max_digits=12, decimal_places=2)
    material_cost = models.DecimalField(max_digits=12, decimal_places=2)
    processing_cost = models.DecimalField(max_digits=12, decimal_places=2)
    labour_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    overhead_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    freight_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    margin_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("15.00"))
    final_price_per_unit = models.DecimalField(max_digits=12, decimal_places=2)
    total_quotation_value = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_locked = models.BooleanField(default=True)

    class Meta:
        db_table = "historical_quotations"
        ordering = ["-quoted_date", "-id"]

    def __str__(self):
        return f"{self.quote_number} - {self.part_name} ({self.customer_name}) ₹{self.final_price_per_unit}/unit"

    def clean(self):
        if self.pk:
            original = HistoricalQuotation.objects.filter(pk=self.pk).first()
            if original and original.is_locked:
                raise ValidationError("Historical quotations are immutable and cannot be altered.")
        super().clean()

    def save(self, *args, **kwargs):
        if self.pk and self.is_locked:
            # Check if this instance exists in the database
            original = HistoricalQuotation.objects.filter(pk=self.pk).values("is_locked").first()
            if original and original["is_locked"]:
                raise ValidationError("Historical quotations are immutable and cannot be altered.")
        super().save(*args, **kwargs)


class HistoricalQuotationOperation(models.Model):
    """
    Individual manufacturing operations for a historical quotation.
    """
    quotation = models.ForeignKey(
        HistoricalQuotation,
        on_delete=models.CASCADE,
        related_name="operations",
    )
    sequence = models.PositiveSmallIntegerField(default=1)
    operation_name = models.CharField(max_length=150)
    work_center = models.CharField(max_length=120)
    cycle_time_minutes = models.DecimalField(max_digits=8, decimal_places=2)
    machine_hourly_rate = models.DecimalField(max_digits=12, decimal_places=2)
    processing_cost = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "historical_quotation_operations"
        ordering = ["sequence", "id"]

    def __str__(self):
        return f"{self.sequence}. {self.operation_name} ({self.work_center}) - {self.cycle_time_minutes} min"

