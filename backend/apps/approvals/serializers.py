from rest_framework import serializers
from .models import QuotationApproval


class QuotationApprovalSerializer(serializers.ModelSerializer):
    quotation_number = serializers.CharField(source="quotation.quotation_number", read_only=True)
    customer_name = serializers.CharField(source="quotation.customer_name", read_only=True)
    part_name = serializers.CharField(source="quotation.part_name", read_only=True)
    drawing_number = serializers.CharField(source="quotation.drawing_number", read_only=True)
    material_spec = serializers.CharField(source="quotation.material_spec", read_only=True)
    annual_volume = serializers.IntegerField(source="quotation.annual_volume", read_only=True)
    total_annual_value = serializers.DecimalField(
        source="quotation.total_annual_value", max_digits=15, decimal_places=2, read_only=True
    )
    unit_price = serializers.DecimalField(
        source="quotation.unit_price", max_digits=12, decimal_places=2, read_only=True
    )
    margin_percentage = serializers.SerializerMethodField()
    rfq_id = serializers.IntegerField(source="quotation.rfq_id", read_only=True)
    rfq_number = serializers.CharField(source="quotation.rfq.rfq_number", read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.full_name", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.full_name", read_only=True)

    class Meta:
        model = QuotationApproval
        fields = [
            "id",
            "quotation",
            "quotation_number",
            "rfq_id",
            "rfq_number",
            "customer_name",
            "part_name",
            "drawing_number",
            "material_spec",
            "annual_volume",
            "total_annual_value",
            "unit_price",
            "margin_percentage",
            "revision_number",
            "status",
            "decision_reason",
            "submitted_by",
            "submitted_by_name",
            "reviewed_by",
            "reviewed_by_name",
            "submitted_at",
            "reviewed_at",
        ]
        read_only_fields = fields

    def get_margin_percentage(self, obj):
        if obj.quotation.costing_sheet:
            return float(obj.quotation.costing_sheet.margin_percentage)
        return 15.0

