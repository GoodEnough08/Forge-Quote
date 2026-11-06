from rest_framework import serializers
from .models import MaterialRate, MachineRate


class MaterialRateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = MaterialRate
        fields = [
            "id",
            "material_name",
            "material_grade",
            "rate_per_kg",
            "density_g_cm3",
            "effective_from",
            "effective_until",
            "is_active",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = MaterialRate(**attrs)
        if self.instance:
            instance.pk = self.instance.pk
        instance.clean()
        return attrs


class MachineRateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = MachineRate
        fields = [
            "id",
            "machine_name",
            "work_center",
            "hourly_rate",
            "effective_from",
            "effective_until",
            "is_active",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = MachineRate(**attrs)
        if self.instance:
            instance.pk = self.instance.pk
        instance.clean()
        return attrs

