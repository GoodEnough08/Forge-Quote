from datetime import date
from typing import Optional, Tuple, List
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError, NotFound

from apps.accounts.models import User
from apps.rfqs.models import RFQ, Part, RFQStatus


def list_rfqs(
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    customer: Optional[str] = None,
    estimator_id: Optional[int] = None,
    due_before: Optional[date] = None,
    sort_by: str = "due_date",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 10,
) -> Tuple[List[RFQ], int]:
    queryset = RFQ.objects.select_related("assigned_estimator").prefetch_related("parts").all()

    if search:
        term = search.strip()
        queryset = queryset.filter(
            Q(rfq_number__icontains=term)
            | Q(customer_name__icontains=term)
            | Q(parts__part_name__icontains=term)
            | Q(parts__material_spec__icontains=term)
        ).distinct()

    if status_filter:
        queryset = queryset.filter(status=status_filter)
    if customer:
        queryset = queryset.filter(customer_name__icontains=customer.strip())
    if estimator_id:
        queryset = queryset.filter(assigned_estimator_id=estimator_id)
    if due_before:
        queryset = queryset.filter(due_date__lte=due_before)

    allowed_sort_fields = {"due_date", "rfq_number", "customer_name", "status", "created_at", "updated_at"}
    order_field = sort_by if sort_by in allowed_sort_fields else "due_date"
    if sort_order.lower() == "desc":
        order_field = f"-{order_field}"

    queryset = queryset.order_by(order_field, "id")
    total = queryset.count()

    offset = (page - 1) * page_size
    items = list(queryset[offset : offset + page_size])
    return items, total


def get_rfq_by_id(rfq_id: int) -> RFQ:
    try:
        return RFQ.objects.select_related("assigned_estimator").prefetch_related("parts").get(pk=rfq_id)
    except RFQ.DoesNotExist:
        raise NotFound(detail="RFQ not found")


@transaction.atomic
def create_rfq(validated_data: dict, current_user: User) -> RFQ:
    rfq_num = validated_data["rfq_number"].strip().upper()
    if RFQ.objects.filter(rfq_number=rfq_num).exists():
        raise ValidationError({"detail": f"RFQ with number '{rfq_num}' already exists."})

    estimator_id = validated_data.get("assigned_estimator_id") or current_user.id
    part_data = validated_data["part"]

    rfq = RFQ.objects.create(
        rfq_number=rfq_num,
        customer_name=validated_data["customer_name"].strip(),
        industry=validated_data.get("industry", "Automotive").strip(),
        delivery_requirements=validated_data.get("delivery_requirements"),
        status=RFQStatus.NEW,
        due_date=validated_data["due_date"],
        assigned_estimator_id=estimator_id,
        notes=validated_data.get("notes"),
        is_demo_seed=False,
    )

    Part.objects.create(
        rfq=rfq,
        part_name=part_data["part_name"],
        drawing_number=part_data.get("drawing_number") or "DRW-PENDING",
        material_spec=part_data["material_spec"],
        gross_weight_kg=part_data["gross_weight_kg"],
        annual_volume=part_data["annual_volume"],
        cycle_time_minutes=part_data["cycle_time_minutes"],
        machine_hourly_rate_inr=part_data["machine_hourly_rate_inr"],
        process_type=part_data.get("process_type", "Forging + CNC Machining"),
    )

    return get_rfq_by_id(rfq.id)


@transaction.atomic
def update_rfq(rfq_id: int, validated_data: dict) -> RFQ:
    rfq = get_rfq_by_id(rfq_id)

    rfq_fields = [
        "customer_name",
        "industry",
        "delivery_requirements",
        "status",
        "due_date",
        "assigned_estimator_id",
        "notes",
    ]
    for field in rfq_fields:
        if field in validated_data and validated_data[field] is not None:
            setattr(rfq, field, validated_data[field])
    rfq.save()

    part = rfq.parts.first()
    if part:
        part_fields = [
            "part_name",
            "drawing_number",
            "material_spec",
            "gross_weight_kg",
            "annual_volume",
            "cycle_time_minutes",
            "machine_hourly_rate_inr",
        ]
        for p_field in part_fields:
            if p_field in validated_data and validated_data[p_field] is not None:
                setattr(part, p_field, validated_data[p_field])
        part.save()

    return get_rfq_by_id(rfq.id)


def get_dashboard_summary() -> dict:
    all_rfqs = list(
        RFQ.objects.select_related("assigned_estimator")
        .prefetch_related("parts")
        .order_by("due_date", "id")
    )
    today = date.today()

    total = len(all_rfqs)
    awaiting_est = sum(1 for r in all_rfqs if r.status in (RFQStatus.NEW, RFQStatus.ESTIMATING))
    awaiting_app = sum(1 for r in all_rfqs if r.status == RFQStatus.AWAITING_APPROVAL)
    sent = sum(1 for r in all_rfqs if r.status == RFQStatus.SENT)
    won = sum(1 for r in all_rfqs if r.status == RFQStatus.WON)
    lost = sum(1 for r in all_rfqs if r.status == RFQStatus.LOST)
    overdue = sum(
        1
        for r in all_rfqs
        if r.due_date < today and r.status not in (RFQStatus.SENT, RFQStatus.WON, RFQStatus.LOST)
    )

    return {
        "total_rfqs": total,
        "awaiting_estimation": awaiting_est,
        "awaiting_approval": awaiting_app,
        "quotations_sent": sent,
        "won_count": won,
        "lost_count": lost,
        "overdue_count": overdue,
        "upcoming_rfqs": all_rfqs[:5],
    }