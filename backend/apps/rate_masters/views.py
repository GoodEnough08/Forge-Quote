from datetime import date
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEstimatorOrSalesHead
from .models import MaterialRate, MachineRate
from .serializers import MaterialRateSerializer, MachineRateSerializer
from .services import RateService


class MaterialRateListCreateView(generics.ListCreateAPIView):
    serializer_class = MaterialRateSerializer
    permission_classes = [IsEstimatorOrSalesHead]

    def get_queryset(self):
        qs = MaterialRate.objects.all().order_by("material_grade", "-effective_from")
        grade = self.request.query_params.get("grade")
        active_only = self.request.query_params.get("active_only")
        if grade:
            qs = qs.filter(material_grade__icontains=grade)
        if active_only and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MaterialRateDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MaterialRate.objects.all()
    serializer_class = MaterialRateSerializer
    permission_classes = [IsEstimatorOrSalesHead]


class MachineRateListCreateView(generics.ListCreateAPIView):
    serializer_class = MachineRateSerializer
    permission_classes = [IsEstimatorOrSalesHead]

    def get_queryset(self):
        qs = MachineRate.objects.all().order_by("work_center", "machine_name", "-effective_from")
        work_center = self.request.query_params.get("work_center")
        active_only = self.request.query_params.get("active_only")
        if work_center:
            qs = qs.filter(work_center__icontains=work_center)
        if active_only and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class MachineRateDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MachineRate.objects.all()
    serializer_class = MachineRateSerializer
    permission_classes = [IsEstimatorOrSalesHead]


class ActiveRatesLookupView(APIView):
    """
    Lookup endpoint that returns active applicable material & machine rates for a given date.
    Query params: grade, work_center, date (YYYY-MM-DD)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        as_of_str = request.query_params.get("date")
        grade = request.query_params.get("grade")
        work_center = request.query_params.get("work_center")

        as_of = date.fromisoformat(as_of_str) if as_of_str else date.today()

        data = {"as_of_date": as_of.isoformat()}
        if grade:
            mat = RateService.get_applicable_material_rate(grade, as_of_date=as_of)
            data["material_rate"] = MaterialRateSerializer(mat).data if mat else None
        if work_center:
            mach = RateService.get_applicable_machine_rate(work_center, as_of_date=as_of)
            data["machine_rate"] = MachineRateSerializer(mach).data if mach else None

        return Response(data)

