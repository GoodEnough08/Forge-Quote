from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


ROUNDING = Decimal("0.01")


def quantize_money(val: Decimal) -> Decimal:
    """Consistent rounding to 2 decimal places for financial amounts in INR."""
    return val.quantize(ROUNDING, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class OperationInput:
    operation_name: str
    work_center: str
    cycle_time_minutes: Decimal
    machine_hourly_rate: Decimal


@dataclass(frozen=True)
class OperationResult:
    operation_name: str
    work_center: str
    cycle_time_minutes: Decimal
    machine_hourly_rate: Decimal
    processing_cost: Decimal


@dataclass(frozen=True)
class CostingCalculationResult:
    gross_weight_kg: Decimal
    material_rate_per_kg: Decimal
    scrap_percentage: Decimal
    material_cost: Decimal
    operations: List[OperationResult]
    total_processing_cost: Decimal
    labour_cost: Decimal
    overhead_cost: Decimal
    freight_cost: Decimal
    other_cost: Decimal
    manufacturing_subtotal: Decimal
    margin_percentage: Decimal
    margin_amount: Decimal
    final_price_per_unit: Decimal
    gst_percentage: Decimal
    gst_amount: Decimal
    total_price_with_gst_per_unit: Decimal

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gross_weight_kg": str(self.gross_weight_kg),
            "material_rate_per_kg": str(self.material_rate_per_kg),
            "scrap_percentage": str(self.scrap_percentage),
            "material_cost": str(self.material_cost),
            "operations": [
                {
                    "operation_name": op.operation_name,
                    "work_center": op.work_center,
                    "cycle_time_minutes": str(op.cycle_time_minutes),
                    "machine_hourly_rate": str(op.machine_hourly_rate),
                    "processing_cost": str(op.processing_cost),
                }
                for op in self.operations
            ],
            "total_processing_cost": str(self.total_processing_cost),
            "labour_cost": str(self.labour_cost),
            "overhead_cost": str(self.overhead_cost),
            "freight_cost": str(self.freight_cost),
            "other_cost": str(self.other_cost),
            "manufacturing_subtotal": str(self.manufacturing_subtotal),
            "margin_percentage": str(self.margin_percentage),
            "margin_amount": str(self.margin_amount),
            "final_price_per_unit": str(self.final_price_per_unit),
            "gst_percentage": str(self.gst_percentage),
            "gst_amount": str(self.gst_amount),
            "total_price_with_gst_per_unit": str(self.total_price_with_gst_per_unit),
        }


class CostingEngine:
    """
    Pure Python Decimal deterministic manufacturing costing engine.
    Calculates raw material, multi-operation machining, overheads, margins, and GST.
    All inputs and calculations are validated and strictly avoid floating point errors.
    """

    @staticmethod
    def calculate(
        gross_weight_kg: Decimal,
        material_rate_per_kg: Decimal,
        scrap_percentage: Decimal,
        operations: List[OperationInput],
        labour_cost: Decimal = Decimal("0.00"),
        overhead_cost: Decimal = Decimal("0.00"),
        freight_cost: Decimal = Decimal("0.00"),
        other_cost: Decimal = Decimal("0.00"),
        margin_percentage: Decimal = Decimal("15.00"),
        gst_percentage: Decimal = Decimal("18.00"),
    ) -> CostingCalculationResult:
        # 1. Validations
        if gross_weight_kg < Decimal("0.00"):
            raise ValueError("Gross weight cannot be negative.")
        if material_rate_per_kg < Decimal("0.00"):
            raise ValueError("Material rate cannot be negative.")
        if scrap_percentage < Decimal("0.00") or scrap_percentage > Decimal("100.00"):
            raise ValueError("Scrap percentage must be between 0 and 100%.")
        if labour_cost < Decimal("0.00") or overhead_cost < Decimal("0.00"):
            raise ValueError("Labour and overhead costs cannot be negative.")
        if freight_cost < Decimal("0.00") or other_cost < Decimal("0.00"):
            raise ValueError("Freight and other costs cannot be negative.")
        if margin_percentage < Decimal("0.00") or margin_percentage > Decimal("100.00"):
            raise ValueError("Margin percentage must be between 0 and 100%.")
        if gst_percentage < Decimal("0.00") or gst_percentage > Decimal("100.00"):
            raise ValueError("GST percentage must be between 0 and 100%.")

        # 2. Material Cost Calculation
        # Formula: gross_weight * material_rate * (1 + scrap_percentage / 100)
        scrap_factor = Decimal("1.00") + (scrap_percentage / Decimal("100.00"))
        material_cost_raw = gross_weight_kg * material_rate_per_kg * scrap_factor
        material_cost = quantize_money(material_cost_raw)

        # 3. Processing / Machining Cost Calculation
        # Formula: (cycle_time_minutes / 60) * machine_hourly_rate
        # For multiple operations: sum of each operation
        operation_results: List[OperationResult] = []
        total_processing_raw = Decimal("0.00")

        for op in operations:
            if op.cycle_time_minutes < Decimal("0.00"):
                raise ValueError(f"Cycle time for operation '{op.operation_name}' cannot be negative.")
            if op.machine_hourly_rate < Decimal("0.00"):
                raise ValueError(f"Hourly rate for operation '{op.operation_name}' cannot be negative.")

            op_cost_raw = (op.cycle_time_minutes / Decimal("60.00")) * op.machine_hourly_rate
            op_cost = quantize_money(op_cost_raw)
            total_processing_raw += op_cost_raw
            operation_results.append(
                OperationResult(
                    operation_name=op.operation_name,
                    work_center=op.work_center,
                    cycle_time_minutes=op.cycle_time_minutes,
                    machine_hourly_rate=op.machine_hourly_rate,
                    processing_cost=op_cost,
                )
            )

        total_processing_cost = quantize_money(total_processing_raw)

        # 4. Manufacturing Subtotal
        # Formula: material cost + processing cost + labour + overhead + freight + other costs
        subtotal_raw = (
            material_cost
            + total_processing_cost
            + labour_cost
            + overhead_cost
            + freight_cost
            + other_cost
        )
        manufacturing_subtotal = quantize_money(subtotal_raw)

        # 5. Margin Calculation
        # Formula: manufacturing_subtotal * (margin_percentage / 100)
        margin_raw = manufacturing_subtotal * (margin_percentage / Decimal("100.00"))
        margin_amount = quantize_money(margin_raw)

        # 6. Final Quotation Price per Unit (Excluding GST)
        # Formula: manufacturing_subtotal + margin_amount
        final_price_per_unit = manufacturing_subtotal + margin_amount

        # 7. GST Calculation (Separated clearly)
        # Formula: final_price_per_unit * (gst_percentage / 100)
        gst_raw = final_price_per_unit * (gst_percentage / Decimal("100.00"))
        gst_amount = quantize_money(gst_raw)

        total_with_gst = final_price_per_unit + gst_amount

        return CostingCalculationResult(
            gross_weight_kg=gross_weight_kg,
            material_rate_per_kg=material_rate_per_kg,
            scrap_percentage=scrap_percentage,
            material_cost=material_cost,
            operations=operation_results,
            total_processing_cost=total_processing_cost,
            labour_cost=labour_cost,
            overhead_cost=overhead_cost,
            freight_cost=freight_cost,
            other_cost=other_cost,
            manufacturing_subtotal=manufacturing_subtotal,
            margin_percentage=margin_percentage,
            margin_amount=margin_amount,
            final_price_per_unit=final_price_per_unit,
            gst_percentage=gst_percentage,
            gst_amount=gst_amount,
            total_price_with_gst_per_unit=total_with_gst,
        )

    @classmethod
    def calculate_volume_tier(
        cls,
        base_result: CostingCalculationResult,
        quantity: int,
        fixed_setup_cost: Decimal = Decimal("0.00"),
        volume_margin_percentage: Optional[Decimal] = None,
    ) -> Dict[str, Any]:
        """
        Calculates unit and total values for a specific volume tier (e.g. 10k, 50k, 180k).
        Distinguishes per-unit price from total quotation contract value.
        """
        if quantity <= 0:
            raise ValueError("Quantity must be positive.")

        unit_setup = (fixed_setup_cost / Decimal(quantity)) if fixed_setup_cost > 0 else Decimal("0.00")
        subtotal = base_result.manufacturing_subtotal + unit_setup

        margin_pct = volume_margin_percentage if volume_margin_percentage is not None else base_result.margin_percentage
        margin_val = quantize_money(subtotal * (margin_pct / Decimal("100.00")))
        unit_price = quantize_money(subtotal + margin_val)
        unit_gst = quantize_money(unit_price * (base_result.gst_percentage / Decimal("100.00")))
        unit_price_with_gst = unit_price + unit_gst

        total_quotation_value = quantize_money(unit_price * Decimal(quantity))
        total_gst = quantize_money(unit_gst * Decimal(quantity))
        grand_total = total_quotation_value + total_gst

        return {
            "quantity": quantity,
            "manufacturing_cost_per_unit": str(subtotal),
            "margin_percentage": str(margin_pct),
            "margin_per_unit": str(margin_val),
            "quotation_price_per_unit": str(unit_price),
            "gst_per_unit": str(unit_gst),
            "price_with_gst_per_unit": str(unit_price_with_gst),
            "total_quotation_value": str(total_quotation_value),
            "total_gst": str(total_gst),
            "grand_total_with_gst": str(grand_total),
        }

