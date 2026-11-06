from decimal import Decimal
from rest_framework import serializers
from apps.rfqs.models import RFQ, Part, RFQStatus


class PartCreateSerializer(serializers.Serializer):
    part_name = serializers.CharField(min_length=2, max_length=255)
    drawing_number = serializers.CharField(default="DRW-PENDING", max_length=120, allow_blank=True)
    material_spec = serializers.CharField(min_length=2, max_length=120)
    gross_weight_kg = serializers.DecimalField(max_digits=10, decimal_places=3, min_value=Decimal("0.001"))
    annual_volume = serializers.IntegerField(min_value=1)
    cycle_time_minutes = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    machine_hourly_rate_inr = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    process_type = serializers.CharField(default="Forging + CNC Machining", max_length=255, required=False)


class PartReadSerializer(serializers.ModelSerializer):
    rfq_id = serializers.IntegerField(source="rfq.id", read_only=True)

    class Meta:
        model = Part
        fields = [
            "id",
            "rfq_id",
            "part_name",
            "drawing_number",
            "material_spec",
            "gross_weight_kg",
            "annual_volume",
            "cycle_time_minutes",
            "machine_hourly_rate_inr",
            "process_type",
        ]


class RFQCreateSerializer(serializers.Serializer):
    rfq_number = serializers.CharField(min_length=4, max_length=64)
    customer_name = serializers.CharField(min_length=2, max_length=255)
    industry = serializers.CharField(default="Automotive", max_length=120)
    delivery_requirements = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    due_date = serializers.DateField()
    assigned_estimator_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    part = PartCreateSerializer()


class RFQUpdateSerializer(serializers.Serializer):
    customer_name = serializers.CharField(required=False, max_length=255)
    industry = serializers.CharField(required=False, max_length=120)
    delivery_requirements = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    status = serializers.ChoiceField(choices=RFQStatus.choices, required=False)
    due_date = serializers.DateField(required=False)
    assigned_estimator_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    part_name = serializers.CharField(required=False, max_length=255)
    drawing_number = serializers.CharField(required=False, max_length=120)
    material_spec = serializers.CharField(required=False, max_length=120)
    gross_weight_kg = serializers.DecimalField(
        required=False, max_digits=10, decimal_places=3, min_value=Decimal("0.001")
    )
    annual_volume = serializers.IntegerField(required=False, min_value=1)
    cycle_time_minutes = serializers.DecimalField(
        required=False, max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )
    machine_hourly_rate_inr = serializers.DecimalField(
        required=False, max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )


class RFQReadSerializer(serializers.ModelSerializer):
    assigned_estimator_id = serializers.IntegerField(source="assigned_estimator.id", read_only=True, default=None)
    assigned_estimator_name = serializers.CharField(
        source="assigned_estimator.full_name", read_only=True, default=None
    )
    parts = PartReadSerializer(many=True, read_only=True)

    class Meta:
        model = RFQ
        fields = [
            "id",
            "rfq_number",
            "customer_name",
            "industry",
            "delivery_requirements",
            "status",
            "due_date",
            "assigned_estimator_id",
            "assigned_estimator_name",
            "notes",
            "is_demo_seed",
            "created_at",
            "updated_at",
            "parts",
        ]