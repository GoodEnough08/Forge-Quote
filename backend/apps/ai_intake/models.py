from decimal import Decimal
from django.conf import settings
from django.db import models
from apps.rfqs.models import RFQ


class IntakeSessionStatus(models.TextChoices):
    UPLOADED = "UPLOADED", "Uploaded"
    EXTRACTING = "EXTRACTING", "Extracting"
    REVIEW_READY = "REVIEW_READY", "Review Ready"
    COMMITTED = "COMMITTED", "Committed to RFQ"
    FAILED = "FAILED", "Extraction Failed"


class IntakeDocumentType(models.TextChoices):
    PDF_RFQ = "PDF_RFQ", "RFQ Document (PDF)"
    PDF_DRAWING = "PDF_DRAWING", "Engineering Drawing (PDF)"
    EXCEL_PART_LIST = "EXCEL_PART_LIST", "Excel Part List (XLSX/XLS)"
    EMAIL_TEXT = "EMAIL_TEXT", "RFQ Email / Tender Text"


class ExtractionFieldStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Review"
    ACCEPTED = "ACCEPTED", "Accepted"
    EDITED = "EDITED", "Edited by Estimator"
    REJECTED = "REJECTED", "Rejected"


class IntakeSession(models.Model):
    """
    Manages an AI-assisted document intake run where uploaded documents are parsed,
    extracted fields are presented for estimator validation, and confirmed data is
    committed to create or update an RFQ.
    """
    title = models.CharField(max_length=255, default="New RFQ Intake Session")
    status = models.CharField(
        max_length=32,
        choices=IntakeSessionStatus.choices,
        default=IntakeSessionStatus.UPLOADED,
        db_index=True,
    )
    rfq = models.ForeignKey(
        RFQ,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="intake_sessions",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="intake_sessions",
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "intake_sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Intake #{self.id}: {self.title} [{self.status}]"


class IntakeDocument(models.Model):
    """
    Confidential source documents securely stored in private storage (not publicly exposed).
    """
    session = models.ForeignKey(
        IntakeSession,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(
        max_length=32,
        choices=IntakeDocumentType.choices,
        default=IntakeDocumentType.PDF_RFQ,
    )
    file_path = models.CharField(max_length=500, blank=True)
    file_size_bytes = models.PositiveIntegerField(default=0)
    raw_text = models.TextField(blank=True)
    page_count = models.PositiveIntegerField(default=1)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "intake_documents"
        ordering = ["id"]

    def __str__(self):
        return f"{self.file_name} ({self.file_type})"


class ExtractedField(models.Model):
    """
    Advisory-only extracted field proposal. Shows suggested value, source document,
    provenance snippet, confidence score, and tracks estimator approval.
    """
    session = models.ForeignKey(
        IntakeSession,
        on_delete=models.CASCADE,
        related_name="extracted_fields",
    )
    field_key = models.CharField(max_length=64, db_index=True)
    field_label = models.CharField(max_length=120)
    suggested_value = models.TextField()
    confirmed_value = models.TextField(blank=True, null=True)
    confidence_score = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("0.85"),
    )
    source_document_name = models.CharField(max_length=255, blank=True)
    source_page_or_row = models.CharField(max_length=64, blank=True)
    source_snippet = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=ExtractionFieldStatus.choices,
        default=ExtractionFieldStatus.PENDING,
        db_index=True,
    )
    is_confirmed = models.BooleanField(default=False)

    class Meta:
        db_table = "intake_extracted_fields"
        ordering = ["id"]

    def __str__(self):
        return f"{self.field_label}: {self.confirmed_value or self.suggested_value} [{self.status}]"


class SuggestedRouting(models.Model):
    """
    Advisory manufacturing operations proposed via historical quote matching.
    Must be reviewed and confirmed by the estimator before costing.
    """
    session = models.ForeignKey(
        IntakeSession,
        on_delete=models.CASCADE,
        related_name="suggested_routings",
    )
    sequence = models.PositiveSmallIntegerField(default=1)
    operation_name = models.CharField(max_length=150)
    work_center = models.CharField(max_length=120)
    cycle_time_minutes = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    machine_hourly_rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    matched_historical_part_name = models.CharField(max_length=255, blank=True, null=True)
    recommendation_reason = models.TextField(blank=True)
    is_accepted = models.BooleanField(default=True)

    class Meta:
        db_table = "intake_suggested_routings"
        ordering = ["sequence", "id"]

    def __str__(self):
        return f"{self.sequence}. {self.operation_name} ({self.work_center}) - {self.cycle_time_minutes} min"

