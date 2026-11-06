from decimal import Decimal
from rest_framework import serializers
from .models import CostingSheet, CostingOperation, CostingVolumeTier
from apps.rfqs.models import Part


class OperationInputSerializer(serializers.Serializer):
    operation_name = serializers.CharField(max_length=150)
    work_center = serializers.CharField(max_length=120)
    cycle_time_minutes = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal("0.00"))
    machine_hourly_rate = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"))
    machine_rate_id = serializers.IntegerField(required=False, allow_null=True)


class VolumeTierInputSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)
    fixed_setup_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), default=Decimal("0.00"), required=False
    )
    volume_margin_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), required=False, allow_null=True
    )


class CostingCalculationRequestSerializer(serializers.Serializer):
    gross_weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    material_rate_per_kg = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.00"))
    material_grade = serializers.CharField(max_length=120, default="EN8")
    material_rate_id = serializers.IntegerField(required=False, allow_null=True)
    scrap_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("5.00")
    )
    operations = OperationInputSerializer(many=True)
    labour_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), default=Decimal("0.00"), required=False
    )
    overhead_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), default=Decimal("0.00"), required=False
    )
    freight_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), default=Decimal("0.00"), required=False
    )
    other_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.00"), default=Decimal("0.00"), required=False
    )
    margin_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("15.00"), required=False
    )
    gst_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.00"), max_value=Decimal("100.00"), default=Decimal("18.00"), required=False
    )
    volume_tiers = VolumeTierInputSerializer(many=True, required=False)


class CostingSaveDraftSerializer(CostingCalculationRequestSerializer):
    part_id = serializers.IntegerField()


class CostingOperationReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CostingOperation
        fields = [
            "id",
            "operation_name",
            "work_center",
            "cycle_time_minutes",
            "machine_hourly_rate_snapshot",
            "processing_cost",
            "sequence",
        ]


class CostingVolumeTierReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CostingVolumeTier
        fields = [
            "id",
            "quantity",
            "manufacturing_cost_per_unit",
            "margin_percentage",
            "margin_per_unit",
            "quotation_price_per_unit",
            "gst_per_unit",
            "price_with_gst_per_unit",
            "total_quotation_value",
            "total_gst",
            "grand_total_with_gst",
        ]


class CostingSheetReadSerializer(serializers.ModelSerializer):
    operations = CostingOperationReadSerializer(many=True, read_only=True)
    volume_tiers = CostingVolumeTierReadSerializer(many=True, read_only=True)
    part_name = serializers.CharField(source="part.part_name", read_only=True)
    drawing_number = serializers.CharField(source="part.drawing_number", read_only=True)
    rfq_number = serializers.CharField(source="part.rfq.rfq_number", read_only=True)
    customer_name = serializers.CharField(source="part.rfq.customer_name", read_only=True)

    class Meta:
        model = CostingSheet
        fields = [
            "id",
            "part_id",
            "part_name",
            "drawing_number",
            "rfq_number",
            "customer_name",
            "costing_date",
            "status",
            "material_grade_snapshot",
            "material_rate_per_kg_snapshot",
            "gross_weight_kg",
            "scrap_percentage",
            "material_cost",
            "labour_cost",
            "overhead_cost",
            "freight_cost",
            "other_cost",
            "total_processing_cost",
            "manufacturing_subtotal",
            "margin_percentage",
            "margin_amount",
            "final_price_per_unit",
            "gst_percentage",
            "gst_amount",
            "total_price_with_gst",
            "operations",
            "volume_tiers",
            "created_at",
            "updated_at",
        ]

