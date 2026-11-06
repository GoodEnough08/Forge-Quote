from datetime import date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsEstimator, IsEstimatorOrSalesHead
from apps.rfqs import services
from apps.rfqs.serializers import (
    RFQCreateSerializer,
    RFQUpdateSerializer,
    RFQReadSerializer,
)


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        summary = services.get_dashboard_summary()
        summary["upcoming_rfqs"] = RFQReadSerializer(summary["upcoming_rfqs"], many=True).data
        return Response(summary)


class RFQListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsEstimator()]
        return [IsAuthenticated()]

    def get(self, request):
        search = request.query_params.get("search")
        status_filter = request.query_params.get("status")
        customer = request.query_params.get("customer")
        estimator_id = request.query_params.get("estimator_id")
        due_before_str = request.query_params.get("due_before")
        sort_by = request.query_params.get("sort_by", "due_date")
        sort_order = request.query_params.get("sort_order", "asc")
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(100, max(1, int(request.query_params.get("page_size", 10))))

        due_before = date.fromisoformat(due_before_str) if due_before_str else None
        est_id = int(estimator_id) if estimator_id else None

        items, total = services.list_rfqs(
            search=search,
            status_filter=status_filter,
            customer=customer,
            estimator_id=est_id,
            due_before=due_before,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )

        return Response(
            {
                "items": RFQReadSerializer(items, many=True).data,
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )

    def post(self, request):
        serializer = RFQCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rfq = services.create_rfq(serializer.validated_data, request.user)
        return Response(RFQReadSerializer(rfq).data, status=status.HTTP_201_CREATED)


class RFQDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsEstimatorOrSalesHead()]
        return [IsAuthenticated()]

    def get(self, request, rfq_id: int):
        rfq = services.get_rfq_by_id(rfq_id)
        return Response(RFQReadSerializer(rfq).data)

    def patch(self, request, rfq_id: int):
        serializer = RFQUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        rfq = services.update_rfq(rfq_id, serializer.validated_data)
        return Response(RFQReadSerializer(rfq).data)