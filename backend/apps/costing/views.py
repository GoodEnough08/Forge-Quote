from datetime import date
from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEstimatorOrSalesHead
from apps.rfqs.models import Part, RFQ
from apps.rate_masters.models import MaterialRate, MachineRate
from apps.rate_masters.services import RateService
from .models import CostingSheet, CostingOperation, CostingVolumeTier
from .serializers import (
    CostingCalculationRequestSerializer,
    CostingSaveDraftSerializer,
    CostingSheetReadSerializer,
)
from .services.costing_engine import CostingEngine, OperationInput


class CalculateCostingView(APIView):
    """
    Stateless / dynamic calculation endpoint.
    Calculates cost breakdown and 3 volume tiers without persisting changes.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CostingCalculationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ops = [
            OperationInput(
                operation_name=op["operation_name"],
                work_center=op["work_center"],
                cycle_time_minutes=op["cycle_time_minutes"],
                machine_hourly_rate=op["machine_hourly_rate"],
            )
            for op in data["operations"]
        ]

        result = CostingEngine.calculate(
            gross_weight_kg=data["gross_weight_kg"],
            material_rate_per_kg=data["material_rate_per_kg"],
            scrap_percentage=data["scrap_percentage"],
            operations=ops,
            labour_cost=data.get("labour_cost", Decimal("0.00")),
            overhead_cost=data.get("overhead_cost", Decimal("0.00")),
            freight_cost=data.get("freight_cost", Decimal("0.00")),
            other_cost=data.get("other_cost", Decimal("0.00")),
            margin_percentage=data.get("margin_percentage", Decimal("15.00")),
            gst_percentage=data.get("gst_percentage", Decimal("18.00")),
        )

        # Volume tiers
        volume_tiers_input = data.get("volume_tiers")
        if not volume_tiers_input:
            volume_tiers_input = [
                {"quantity": 10000, "fixed_setup_cost": Decimal("0.00")},
                {"quantity": 50000, "fixed_setup_cost": Decimal("0.00")},
                {"quantity": 180000, "fixed_setup_cost": Decimal("0.00")},
            ]

        calculated_tiers = [
            CostingEngine.calculate_volume_tier(
                base_result=result,
                quantity=tier["quantity"],
                fixed_setup_cost=tier.get("fixed_setup_cost", Decimal("0.00")),
                volume_margin_percentage=tier.get("volume_margin_percentage"),
            )
            for tier in volume_tiers_input
        ]

        resp = result.to_dict()
        resp["volume_tiers"] = calculated_tiers
        return Response(resp, status=status.HTTP_200_OK)


class SaveCostingDraftView(APIView):
    """
    Saves or updates a CostingSheet draft for an RFQ Part.
    Saves immutable rate snapshots into CostingSheet and CostingOperation records.
    """
    permission_classes = [IsEstimatorOrSalesHead]

    @transaction.atomic
    def post(self, request):
        serializer = CostingSaveDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        part = get_object_or_404(Part, id=data["part_id"])

        # Execute deterministic calculation
        ops_inputs = [
            OperationInput(
                operation_name=op["operation_name"],
                work_center=op["work_center"],
                cycle_time_minutes=op["cycle_time_minutes"],
                machine_hourly_rate=op["machine_hourly_rate"],
            )
            for op in data["operations"]
        ]

        calc = CostingEngine.calculate(
            gross_weight_kg=data["gross_weight_kg"],
            material_rate_per_kg=data["material_rate_per_kg"],
            scrap_percentage=data["scrap_percentage"],
            operations=ops_inputs,
            labour_cost=data.get("labour_cost", Decimal("0.00")),
            overhead_cost=data.get("overhead_cost", Decimal("0.00")),
            freight_cost=data.get("freight_cost", Decimal("0.00")),
            other_cost=data.get("other_cost", Decimal("0.00")),
            margin_percentage=data.get("margin_percentage", Decimal("15.00")),
            gst_percentage=data.get("gst_percentage", Decimal("18.00")),
        )

        mat_record = None
        if data.get("material_rate_id"):
            mat_record = MaterialRate.objects.filter(id=data["material_rate_id"]).first()
        if not mat_record:
            mat_record = RateService.get_applicable_material_rate(data.get("material_grade", part.material_spec))

        # Update or create costing sheet with all required snapshot values
        costing_sheet, _ = CostingSheet.objects.update_or_create(
            part=part,
            defaults={
                "material_rate_record": mat_record,
                "material_grade_snapshot": data.get("material_grade", part.material_spec),
                "material_rate_per_kg_snapshot": calc.material_rate_per_kg,
                "gross_weight_kg": calc.gross_weight_kg,
                "scrap_percentage": calc.scrap_percentage,
                "material_cost": calc.material_cost,
                "labour_cost": calc.labour_cost,
                "overhead_cost": calc.overhead_cost,
                "freight_cost": calc.freight_cost,
                "other_cost": calc.other_cost,
                "total_processing_cost": calc.total_processing_cost,
                "manufacturing_subtotal": calc.manufacturing_subtotal,
                "margin_percentage": calc.margin_percentage,
                "margin_amount": calc.margin_amount,
                "final_price_per_unit": calc.final_price_per_unit,
                "gst_percentage": calc.gst_percentage,
                "gst_amount": calc.gst_amount,
                "total_price_with_gst": calc.total_price_with_gst_per_unit,
                "status": "Draft",
                "created_by": request.user,
            }
        )

        # Update operations
        costing_sheet.operations.all().delete()
        for idx, op in enumerate(calc.operations, start=1):
            mach_id = data["operations"][idx - 1].get("machine_rate_id")
            mach_record = MachineRate.objects.filter(id=mach_id).first() if mach_id else None
            CostingOperation.objects.create(
                costing_sheet=costing_sheet,
                machine_rate_record=mach_record,
                operation_name=op.operation_name,
                work_center=op.work_center,
                cycle_time_minutes=op.cycle_time_minutes,
                machine_hourly_rate_snapshot=op.machine_hourly_rate,
                processing_cost=op.processing_cost,
                sequence=idx,
            )

        # Update volume tiers
        costing_sheet.volume_tiers.all().delete()
        tier_inputs = data.get("volume_tiers") or [
            {"quantity": 10000, "fixed_setup_cost": Decimal("0.00")},
            {"quantity": 50000, "fixed_setup_cost": Decimal("0.00")},
            {"quantity": 180000, "fixed_setup_cost": Decimal("0.00")},
        ]

        for tier_data in tier_inputs:
            tier_calc = CostingEngine.calculate_volume_tier(
                base_result=calc,
                quantity=tier_data["quantity"],
                fixed_setup_cost=tier_data.get("fixed_setup_cost", Decimal("0.00")),
                volume_margin_percentage=tier_data.get("volume_margin_percentage"),
            )
            CostingVolumeTier.objects.create(
                costing_sheet=costing_sheet,
                quantity=tier_calc["quantity"],
                manufacturing_cost_per_unit=Decimal(tier_calc["manufacturing_cost_per_unit"]),
                margin_percentage=Decimal(tier_calc["margin_percentage"]),
                margin_per_unit=Decimal(tier_calc["margin_per_unit"]),
                quotation_price_per_unit=Decimal(tier_calc["quotation_price_per_unit"]),
                gst_per_unit=Decimal(tier_calc["gst_per_unit"]),
                price_with_gst_per_unit=Decimal(tier_calc["price_with_gst_per_unit"]),
                total_quotation_value=Decimal(tier_calc["total_quotation_value"]),
                total_gst=Decimal(tier_calc["total_gst"]),
                grand_total_with_gst=Decimal(tier_calc["grand_total_with_gst"]),
            )

        return Response(CostingSheetReadSerializer(costing_sheet).data, status=status.HTTP_201_CREATED)


class CostingDetailByRFQView(APIView):
    """
    Retrieves the CostingSheet for the first part of an RFQ.
    If no costing exists yet, returns default pre-filled parameters based on RFQ Part.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, rfq_id: int):
        rfq = get_object_or_404(RFQ, id=rfq_id)
        part = rfq.parts.first()
        if not part:
            return Response({"detail": "RFQ has no associated part."}, status=status.HTTP_404_NOT_FOUND)

        sheet = CostingSheet.objects.filter(part=part).first()
        if sheet:
            return Response({
                "has_draft": True,
                "costing_sheet": CostingSheetReadSerializer(sheet).data,
            })

        # Pre-fill defaults from Part & Rate Masters
        applicable_mat = RateService.get_applicable_material_rate(part.material_spec)
        applicable_mach = RateService.get_applicable_machine_rate(part.process_type.split("+")[0].strip())

        mat_rate = applicable_mat.rate_per_kg if applicable_mat else Decimal("78.50")
        mach_rate = applicable_mach.hourly_rate if applicable_mach else part.machine_hourly_rate_inr

        # Return suggested template
        default_calc = CostingEngine.calculate(
            gross_weight_kg=part.gross_weight_kg,
            material_rate_per_kg=mat_rate,
            scrap_percentage=Decimal("5.00"),
            operations=[
                OperationInput(
                    operation_name=part.process_type,
                    work_center="Forging / CNC Line",
                    cycle_time_minutes=part.cycle_time_minutes,
                    machine_hourly_rate=mach_rate,
                )
            ],
            margin_percentage=Decimal("15.00"),
            gst_percentage=Decimal("18.00"),
        )

        vol_tiers = [
            CostingEngine.calculate_volume_tier(default_calc, qty)
            for qty in [10000, 50000, 180000]
        ]

        resp = default_calc.to_dict()
        resp["volume_tiers"] = vol_tiers

        return Response({
            "has_draft": False,
            "part": {
                "id": part.id,
                "part_name": part.part_name,
                "material_spec": part.material_spec,
                "drawing_number": part.drawing_number,
                "gross_weight_kg": str(part.gross_weight_kg),
                "annual_volume": part.annual_volume,
                "cycle_time_minutes": str(part.cycle_time_minutes),
                "machine_hourly_rate_inr": str(part.machine_hourly_rate_inr),
                "process_type": part.process_type,
                "rfq_id": rfq.id,
                "rfq_number": rfq.rfq_number,
                "customer_name": rfq.customer_name,
            },
            "suggested_rates": {
                "material_rate": str(mat_rate),
                "material_rate_id": applicable_mat.id if applicable_mat else None,
                "machine_rate": str(mach_rate),
                "machine_rate_id": applicable_mach.id if applicable_mach else None,
            },
            "calculation": resp,
        })
