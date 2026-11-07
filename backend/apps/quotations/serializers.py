from rest_framework import serializers
from .models import Quotation, QuotationTier, APPROVAL_THRESHOLD_INR


class QuotationTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationTier
        fields = [
            "id",
            "quantity",
            "unit_price",
            "gst_amount",
            "unit_price_with_gst",
            "total_value",
            "total_with_gst",
        ]


class QuotationListSerializer(serializers.ModelSerializer):
    rfq_number = serializers.CharField(source="rfq.rfq_number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    latest_approval_status = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            "id",
            "quotation_number",
            "version",
            "rfq",
            "rfq_number",
            "status",
            "customer_name",
            "part_name",
            "drawing_number",
            "material_spec",
            "annual_volume",
            "unit_price",
            "total_annual_value",
            "requires_approval",
            "quotation_date",
            "created_by_name",
            "pdf_generated_at",
            "latest_approval_status",
        ]

    def get_latest_approval_status(self, obj):
        latest = obj.approvals.first()
        return latest.status if latest else None


class QuotationDetailSerializer(serializers.ModelSerializer):
    rfq_number = serializers.CharField(source="rfq.rfq_number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    tiers = QuotationTierSerializer(many=True, read_only=True)
    approvals_history = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            "id",
            "quotation_number",
            "version",
            "rfq",
            "rfq_number",
            "costing_sheet",
            "status",
            "customer_name",
            "customer_contact",
            "customer_address",
            "part_name",
            "drawing_number",
            "material_spec",
            "gross_weight_kg",
            "annual_volume",
            "unit_price",
            "total_annual_value",
            "gst_percentage",
            "requires_approval",
            "delivery_terms",
            "payment_terms",
            "validity_days",
            "quotation_date",
            "pdf_file_path",
            "pdf_generated_at",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "tiers",
            "approvals_history",
        ]

    def get_approvals_history(self, obj):
        return [
            {
                "id": a.id,
                "revision_number": a.revision_number,
                "status": a.status,
                "decision_reason": a.decision_reason,
                "submitted_at": a.submitted_at,
                "reviewed_at": a.reviewed_at,
                "submitted_by_name": a.submitted_by.full_name if a.submitted_by else "System",
                "reviewed_by_name": a.reviewed_by.full_name if a.reviewed_by else None,
            }
            for a in obj.approvals.all()
        ]

