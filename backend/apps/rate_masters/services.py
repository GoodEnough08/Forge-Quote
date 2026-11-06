from datetime import date
from typing import Optional
from django.db.models import Q
from .models import MaterialRate, MachineRate


class RateService:
    """
    Service responsible for querying applicable material and machine rates
    as of a specific costing date, ensuring full historical rate preservation.
    """

    @classmethod
    def get_applicable_material_rate(
        cls,
        material_grade: str,
        as_of_date: Optional[date] = None,
        material_name: Optional[str] = None,
    ) -> Optional[MaterialRate]:
        """
        Finds the active MaterialRate record valid for the given grade on as_of_date.
        Query condition: effective_from <= as_of_date and (effective_until is null or effective_until >= as_of_date)
        """
        if as_of_date is None:
            as_of_date = date.today()

        qs = MaterialRate.objects.filter(
            material_grade__iexact=material_grade.strip(),
            is_active=True,
            effective_from__lte=as_of_date,
        ).filter(
            Q(effective_until__isnull=True) | Q(effective_until__gte=as_of_date)
        )

        if material_name:
            qs = qs.filter(material_name__iexact=material_name.strip())

        return qs.order_by("-effective_from").first()

    @classmethod
    def get_applicable_machine_rate(
        cls,
        work_center_or_machine: str,
        as_of_date: Optional[date] = None,
    ) -> Optional[MachineRate]:
        """
        Finds active MachineRate valid for machine_name or work_center on as_of_date.
        """
        if as_of_date is None:
            as_of_date = date.today()

        term = work_center_or_machine.strip()
        qs = MachineRate.objects.filter(
            is_active=True,
            effective_from__lte=as_of_date,
        ).filter(
            Q(machine_name__iexact=term) | Q(work_center__iexact=term)
        ).filter(
            Q(effective_until__isnull=True) | Q(effective_until__gte=as_of_date)
        )

        return qs.order_by("-effective_from").first()

