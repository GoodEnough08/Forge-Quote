from rest_framework import serializers
from .models import HistoricalQuotation, HistoricalQuotationOperation


class HistoricalQuotationOperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistoricalQuotationOperation
        fields = [
            "id",
            "sequence",
            "operation_name",
            "work_center",
            "cycle_time_minutes",
            "machine_hourly_rate",
            "processing_cost",
        ]


class HistoricalQuotationSerializer(serializers.ModelSerializer):
    operations = HistoricalQuotationOperationSerializer(many=True, read_only=True)

    class Meta:
        model = HistoricalQuotation
        fields = [
            "id",
            "quote_number",
            "rfq_reference",
            "customer_name",
            "part_name",
            "drawing_number",
            "material_grade",
            "gross_weight_kg",
            "annual_volume",
            "quoted_date",
            "status",
            "material_rate_per_kg",
            "material_cost",
            "processing_cost",
            "labour_cost",
            "overhead_cost",
            "freight_cost",
            "margin_percentage",
            "final_price_per_unit",
            "total_quotation_value",
            "notes",
            "created_at",
            "is_locked",
            "operations",
        ]
        read_only_fields = fields  # Entire model is read-only via API for audit safety

