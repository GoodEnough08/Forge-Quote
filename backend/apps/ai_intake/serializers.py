from rest_framework import serializers
from .models import (
    IntakeSession,
    IntakeDocument,
    ExtractedField,
    SuggestedRouting,
    IntakeSessionStatus,
    ExtractionFieldStatus,
)


class IntakeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntakeDocument
        fields = [
            "id",
            "file_name",
            "file_type",
            "file_size_bytes",
            "page_count",
            "uploaded_at",
        ]
        read_only_fields = ["id", "uploaded_at"]


class ExtractedFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractedField
        fields = [
            "id",
            "field_key",
            "field_label",
            "suggested_value",
            "confirmed_value",
            "confidence_score",
            "source_document_name",
            "source_page_or_row",
            "source_snippet",
            "status",
            "is_confirmed",
        ]
        read_only_fields = ["id", "field_key", "field_label", "source_document_name", "source_page_or_row", "source_snippet"]


class SuggestedRoutingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuggestedRouting
        fields = [
            "id",
            "sequence",
            "operation_name",
            "work_center",
            "cycle_time_minutes",
            "machine_hourly_rate",
            "matched_historical_part_name",
            "recommendation_reason",
            "is_accepted",
        ]


class IntakeSessionDetailSerializer(serializers.ModelSerializer):
    documents = IntakeDocumentSerializer(many=True, read_only=True)
    extracted_fields = ExtractedFieldSerializer(many=True, read_only=True)
    suggested_routings = SuggestedRoutingSerializer(many=True, read_only=True)
    rfq_number = serializers.CharField(source="rfq.rfq_number", read_only=True)

    class Meta:
        model = IntakeSession
        fields = [
            "id",
            "title",
            "status",
            "rfq",
            "rfq_number",
            "notes",
            "created_at",
            "updated_at",
            "documents",
            "extracted_fields",
            "suggested_routings",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class IntakeSessionListSerializer(serializers.ModelSerializer):
    documents_count = serializers.IntegerField(source="documents.count", read_only=True)
    rfq_number = serializers.CharField(source="rfq.rfq_number", read_only=True)

    class Meta:
        model = IntakeSession
        fields = [
            "id",
            "title",
            "status",
            "rfq",
            "rfq_number",
            "notes",
            "created_at",
            "updated_at",
            "documents_count",
        ]
        read_only_fields = fields

