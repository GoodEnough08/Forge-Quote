from decimal import Decimal, InvalidOperation
import difflib
from typing import Dict, List, Optional, Any
from django.db import transaction
from django.db.models import Q
from .models import HistoricalQuotation, HistoricalQuotationOperation


class HistoricalQuoteSearchService:
    """
    Search and similarity scoring engine for historical forge shop quotations.
    Provides deterministic scoring based on part geometry tokens, material grade,
    and gross weight proximity without external vector dependencies.
    """

    @classmethod
    def search_quotes(
        cls,
        part_name: Optional[str] = None,
        customer_name: Optional[str] = None,
        material_grade: Optional[str] = None,
        drawing_number: Optional[str] = None,
        min_weight: Optional[Decimal] = None,
        max_weight: Optional[Decimal] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        status: Optional[str] = None,
        reference_weight: Optional[Decimal] = None,
        reference_grade: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        qs = HistoricalQuotation.objects.prefetch_related("operations").all()

        if customer_name:
            qs = qs.filter(customer_name__icontains=customer_name.strip())
        if material_grade:
            qs = qs.filter(material_grade__icontains=material_grade.strip())
        if drawing_number:
            qs = qs.filter(drawing_number__icontains=drawing_number.strip())
        if min_weight is not None:
            qs = qs.filter(gross_weight_kg__gte=min_weight)
        if max_weight is not None:
            qs = qs.filter(gross_weight_kg__lte=max_weight)
        if from_date:
            qs = qs.filter(quoted_date__gte=from_date)
        if to_date:
            qs = qs.filter(quoted_date__lte=to_date)
        if status:
            qs = qs.filter(status__iexact=status.strip())

        if part_name:
            # Match broad term or tokens
            tokens = part_name.strip().split()
            name_q = Q()
            for token in tokens:
                name_q |= Q(part_name__icontains=token)
            qs = qs.filter(name_q)

        results = []
        for quote in qs:
            score, reasons = cls.calculate_similarity(
                candidate=quote,
                target_name=part_name,
                target_grade=reference_grade or material_grade,
                target_weight=reference_weight,
            )
            data = cls.serialize_quote_with_score(quote, score, reasons)
            results.append(data)

        # Sort primarily by similarity score descending, then quoted_date descending
        results.sort(key=lambda x: (x["similarity_score"], x["quoted_date"]), reverse=True)
        return results

    @classmethod
    def calculate_similarity(
        cls,
        candidate: HistoricalQuotation,
        target_name: Optional[str],
        target_grade: Optional[str],
        target_weight: Optional[Decimal],
    ) -> (int, List[str]):
        """
        Calculates similarity score (0 to 100%) and generates human-readable explanations.
        - Part Name Token Match: 40%
        - Material Grade Match: 30%
        - Gross Weight Proximity: 30%
        """
        score = 0.0
        reasons = []

        # 1. Part name matching (40 points)
        if target_name:
            name_a = candidate.part_name.lower().strip()
            name_b = target_name.lower().strip()
            matcher = difflib.SequenceMatcher(None, name_a, name_b)
            name_ratio = matcher.ratio()

            # Token overlap boost
            tokens_a = set(name_a.replace("-", " ").split())
            tokens_b = set(name_b.replace("-", " ").split())
            common_tokens = tokens_a.intersection(tokens_b)
            if common_tokens:
                token_ratio = len(common_tokens) / max(len(tokens_b), 1)
                name_score = max(name_ratio, token_ratio)
            else:
                name_score = name_ratio

            score += name_score * 40.0
            if name_score >= 0.70:
                reasons.append(f"Geometry match: '{candidate.part_name}' aligns with target component")
            elif name_score >= 0.40:
                reasons.append(f"Partial geometry match ({int(name_score * 100)}% name match)")
        else:
            score += 20.0  # Neutral baseline

        # 2. Material grade matching (30 points)
        if target_grade:
            cand_grade = candidate.material_grade.upper().strip()
            tgt_grade = target_grade.upper().strip()
            if cand_grade == tgt_grade:
                score += 30.0
                reasons.append(f"Exact material grade match ({cand_grade})")
            elif cand_grade[:3] == tgt_grade[:3]:  # same alloy family
                score += 15.0
                reasons.append(f"Alloy family match ({cand_grade} vs {tgt_grade})")
            else:
                score += 0.0
        else:
            score += 15.0  # Neutral baseline

        # 3. Gross weight proximity (30 points)
        if target_weight and target_weight > Decimal("0.000"):
            cand_weight = candidate.gross_weight_kg
            try:
                diff = abs(Decimal(str(cand_weight)) - Decimal(str(target_weight)))
                max_w = max(Decimal(str(cand_weight)), Decimal(str(target_weight)))
                proximity = max(Decimal("0.0"), Decimal("1.0") - (diff / max_w))
                weight_points = float(proximity) * 30.0
                score += weight_points

                pct_diff = float((diff / target_weight) * 100)
                if pct_diff <= 15:
                    reasons.append(f"Weight proximity: within {pct_diff:.1f}% ({cand_weight} kg vs {target_weight} kg)")
            except (InvalidOperation, ZeroDivisionError):
                score += 15.0
        else:
            score += 15.0  # Neutral baseline

        final_score = int(min(max(score, 0.0), 100.0))
        return final_score, reasons

    @classmethod
    def serialize_quote_with_score(
        cls, quote: HistoricalQuotation, score: int, reasons: List[str]
    ) -> Dict[str, Any]:
        operations = [
            {
                "sequence": op.sequence,
                "operation_name": op.operation_name,
                "work_center": op.work_center,
                "cycle_time_minutes": float(op.cycle_time_minutes),
                "machine_hourly_rate": float(op.machine_hourly_rate),
                "processing_cost": float(op.processing_cost),
            }
            for op in quote.operations.all()
        ]
        return {
            "id": quote.id,
            "quote_number": quote.quote_number,
            "rfq_reference": quote.rfq_reference,
            "customer_name": quote.customer_name,
            "part_name": quote.part_name,
            "drawing_number": quote.drawing_number,
            "material_grade": quote.material_grade,
            "gross_weight_kg": float(quote.gross_weight_kg),
            "annual_volume": quote.annual_volume,
            "quoted_date": str(quote.quoted_date),
            "status": quote.status,
            "material_rate_per_kg": float(quote.material_rate_per_kg),
            "material_cost": float(quote.material_cost),
            "processing_cost": float(quote.processing_cost),
            "labour_cost": float(quote.labour_cost),
            "overhead_cost": float(quote.overhead_cost),
            "freight_cost": float(quote.freight_cost),
            "margin_percentage": float(quote.margin_percentage),
            "final_price_per_unit": float(quote.final_price_per_unit),
            "total_quotation_value": float(quote.total_quotation_value),
            "notes": quote.notes or "",
            "operations": operations,
            "similarity_score": score,
            "similarity_reasons": reasons,
        }

    @classmethod
    def compare_two_quotes(cls, quote_id_a: int, quote_id_b: int) -> Dict[str, Any]:
        """
        Performs side-by-side comparison between two historical quotations.
        """
        qa = HistoricalQuotation.objects.prefetch_related("operations").get(id=quote_id_a)
        qb = HistoricalQuotation.objects.prefetch_related("operations").get(id=quote_id_b)

        price_a = float(qa.final_price_per_unit)
        price_b = float(qb.final_price_per_unit)
        price_delta = round(price_b - price_a, 2)
        price_pct = round((price_delta / price_a) * 100, 2) if price_a else 0

        weight_a = float(qa.gross_weight_kg)
        weight_b = float(qb.gross_weight_kg)
        weight_delta = round(weight_b - weight_a, 3)

        mat_rate_a = float(qa.material_rate_per_kg)
        mat_rate_b = float(qb.material_rate_per_kg)
        mat_rate_delta = round(mat_rate_b - mat_rate_a, 2)

        data_a = cls.serialize_quote_with_score(qa, 100, [])
        data_b = cls.serialize_quote_with_score(qb, 100, [])

        return {
            "quote_a": data_a,
            "quote_b": data_b,
            "variances": {
                "unit_price_delta": price_delta,
                "unit_price_pct_change": price_pct,
                "weight_delta_kg": weight_delta,
                "material_rate_delta_per_kg": mat_rate_delta,
                "customer_match": qa.customer_name.strip().lower() == qb.customer_name.strip().lower(),
                "material_match": qa.material_grade.strip().lower() == qb.material_grade.strip().lower(),
            },
        }

    @classmethod
    def batch_import_excel_quotations(cls, file_content: bytes) -> Dict[str, Any]:
        """
        Batch imports legacy quotation spreadsheets using openpyxl and pandas.
        """
        import io
        import pandas as pd

        df = pd.read_excel(io.BytesIO(file_content))
        df.columns = [str(c).strip() for c in df.columns]

        created_count = 0
        errors = []

        with transaction.atomic():
            for idx, row in df.iterrows():
                row_idx = idx + 2  # Excel 1-based indexing plus header
                try:
                    quote_number = str(row.get("Quote Number", f"HIST-EXCEL-{row_idx}")).strip()
                    part_name = str(row.get("Part Name", "")).strip()
                    customer = str(row.get("Customer", "Legacy Client")).strip()
                    grade = str(row.get("Material Grade", row.get("Grade", "EN8"))).strip()

                    if not part_name:
                        errors.append(f"Row {row_idx}: Missing Part Name")
                        continue

                    gross_weight = Decimal(str(row.get("Gross Weight (kg)", row.get("Weight", 1.0))))
                    volume = int(row.get("Annual Volume", row.get("Volume", 10000)))
                    unit_price = Decimal(str(row.get("Final Price", row.get("Unit Price", 500.0))))
                    mat_rate = Decimal(str(row.get("Material Rate", 75.0)))
                    status = str(row.get("Status", "Won")).strip()

                    # Avoid duplicate quote numbers
                    final_quote_num = quote_number
                    if HistoricalQuotation.objects.filter(quote_number=final_quote_num).exists():
                        final_quote_num = f"{quote_number}-R{row_idx}"

                    hq = HistoricalQuotation.objects.create(
                        quote_number=final_quote_num,
                        rfq_reference=str(row.get("RFQ Reference", f"LEGACY-RFQ-{row_idx}")).strip(),
                        customer_name=customer,
                        part_name=part_name,
                        drawing_number=str(row.get("Drawing No", f"DRW-{row_idx}")).strip(),
                        material_grade=grade,
                        gross_weight_kg=gross_weight,
                        annual_volume=volume,
                        quoted_date=str(row.get("Date", "2025-06-15"))[:10],
                        status=status if status in ["Won", "Lost", "Expired", "Quoted"] else "Won",
                        material_rate_per_kg=mat_rate,
                        material_cost=gross_weight * mat_rate,
                        processing_cost=unit_price * Decimal("0.35"),
                        labour_cost=unit_price * Decimal("0.05"),
                        overhead_cost=unit_price * Decimal("0.05"),
                        margin_percentage=Decimal("15.00"),
                        final_price_per_unit=unit_price,
                        total_quotation_value=unit_price * Decimal(volume),
                        notes=f"Imported from legacy Excel batch row #{row_idx}",
                        is_locked=True,
                    )

                    # Default standard operations if not provided
                    HistoricalQuotationOperation.objects.create(
                        quotation=hq,
                        sequence=1,
                        operation_name="Hot Forging + Trimming",
                        work_center="Forging Press 1600T",
                        cycle_time_minutes=Decimal("1.50"),
                        machine_hourly_rate=Decimal("1800.00"),
                        processing_cost=Decimal("45.00"),
                    )
                    HistoricalQuotationOperation.objects.create(
                        quotation=hq,
                        sequence=2,
                        operation_name="CNC Finish Turning",
                        work_center="CNC Turning Center",
                        cycle_time_minutes=Decimal("3.20"),
                        machine_hourly_rate=Decimal("850.00"),
                        processing_cost=Decimal("45.33"),
                    )

                    created_count += 1
                except Exception as ex:
                    errors.append(f"Row {row_idx}: {str(ex)}")

        return {
            "total_imported": created_count,
            "errors": errors,
        }

