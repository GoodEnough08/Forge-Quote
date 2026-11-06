from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class MaterialRate(models.Model):
    """
    Versioned raw material rate per kilogram with effective date range.
    Ensures non-overlapping periods for identical material grade.
    """
    material_name = models.CharField(max_length=120, db_index=True)
    material_grade = models.CharField(max_length=120, db_index=True)
    rate_per_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Base rate in INR per kg",
    )
    density_g_cm3 = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        default=Decimal("7.850"),
        help_text="Illustrative material density (e.g., 7.85 g/cm³ for steel)",
    )
    effective_from = models.DateField(db_index=True)
    effective_until = models.DateField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_material_rates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "material_rates"
        ordering = ["material_grade", "-effective_from"]

    def __str__(self):
        until_str = self.effective_until.isoformat() if self.effective_until else "present"
        return f"{self.material_grade} (₹{self.rate_per_kg}/kg) [{self.effective_from} to {until_str}]"

    def clean(self):
        super().clean()
        if self.effective_until and self.effective_until < self.effective_from:
            raise ValidationError({
                "effective_until": "Effective until date cannot precede effective from date."
            })

        # Prevent overlapping effective date ranges for the same material_grade
        qs = MaterialRate.objects.filter(
            material_grade__iexact=self.material_grade.strip(),
            is_active=True,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)

        for existing in qs:
            ex_until = existing.effective_until
            # Range 1: [self.effective_from, self.effective_until or infinity]
            # Range 2: [existing.effective_from, ex_until or infinity]
            overlaps = True
            if self.effective_until and self.effective_until < existing.effective_from:
                overlaps = False
            if ex_until and self.effective_from > ex_until:
                overlaps = False

            if overlaps:
                ex_until_label = ex_until.isoformat() if ex_until else "open-ended"
                raise ValidationError(
                    f"Overlapping rate period detected for {self.material_grade}: "
                    f"Conflicting entry exists from {existing.effective_from} to {ex_until_label}."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class MachineRate(models.Model):
    """
    Versioned machine or work center hourly rate in INR with effective date range.
    """
    machine_name = models.CharField(max_length=150, db_index=True)
    work_center = models.CharField(max_length=120, db_index=True)
    hourly_rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Machine burden rate in INR per hour",
    )
    effective_from = models.DateField(db_index=True)
    effective_until = models.DateField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_machine_rates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "machine_rates"
        ordering = ["work_center", "machine_name", "-effective_from"]

    def __str__(self):
        until_str = self.effective_until.isoformat() if self.effective_until else "present"
        return f"{self.machine_name} - {self.work_center} (₹{self.hourly_rate}/hr) [{self.effective_from} to {until_str}]"

    def clean(self):
        super().clean()
        if self.effective_until and self.effective_until < self.effective_from:
            raise ValidationError({
                "effective_until": "Effective until date cannot precede effective from date."
            })

        # Prevent overlapping effective date ranges for identical machine & work center
        qs = MachineRate.objects.filter(
            machine_name__iexact=self.machine_name.strip(),
            work_center__iexact=self.work_center.strip(),
            is_active=True,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)

        for existing in qs:
            ex_until = existing.effective_until
            overlaps = True
            if self.effective_until and self.effective_until < existing.effective_from:
                overlaps = False
            if ex_until and self.effective_from > ex_until:
                overlaps = False

            if overlaps:
                ex_until_label = ex_until.isoformat() if ex_until else "open-ended"
                raise ValidationError(
                    f"Overlapping rate period detected for machine {self.machine_name} ({self.work_center}): "
                    f"Conflicting entry exists from {existing.effective_from} to {ex_until_label}."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
