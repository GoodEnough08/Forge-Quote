from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class RFQStatus(models.TextChoices):
    NEW = "New", "New"
    ESTIMATING = "Estimating", "Estimating"
    AWAITING_APPROVAL = "Awaiting Approval", "Awaiting Approval"
    APPROVED = "Approved", "Approved"
    SENT = "Sent", "Sent"
    WON = "Won", "Won"
    LOST = "Lost", "Lost"


class RFQ(models.Model):
    rfq_number = models.CharField(max_length=64, unique=True, db_index=True)
    customer_name = models.CharField(max_length=255, db_index=True)
    industry = models.CharField(max_length=120, default="Automotive")
    delivery_requirements = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=RFQStatus.choices,
        default=RFQStatus.NEW,
        db_index=True,
    )
    due_date = models.DateField(db_index=True)
    assigned_estimator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_rfqs",
    )
    notes = models.TextField(max_length=2000, null=True, blank=True)
    is_demo_seed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rfqs"
        ordering = ["due_date", "id"]

    def __str__(self):
        return f"{self.rfq_number} - {self.customer_name}"


class Part(models.Model):
    rfq = models.ForeignKey(RFQ, on_delete=models.CASCADE, related_name="parts")
    part_name = models.CharField(max_length=255, db_index=True)
    drawing_number = models.CharField(max_length=120, default="TBD")
    material_spec = models.CharField(max_length=120, db_index=True)
    gross_weight_kg = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    annual_volume = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    cycle_time_minutes = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    machine_hourly_rate_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    process_type = models.CharField(max_length=255, default="CNC Turning + Grinding")

    class Meta:
        db_table = "parts"
        ordering = ["id"]

    def __str__(self):
        return f"{self.part_name} ({self.material_spec})"