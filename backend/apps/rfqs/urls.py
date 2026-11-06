from django.urls import path
from apps.rfqs.views import DashboardSummaryView, RFQListCreateView, RFQDetailView

urlpatterns = [
    path("", RFQListCreateView.as_view(), name="rfq-list-create"),
    path("/dashboard", DashboardSummaryView.as_view(), name="rfq-dashboard"),
    path("/<int:rfq_id>", RFQDetailView.as_view(), name="rfq-detail"),
]