from django.urls import path
from .views import (
    CalculateCostingView,
    SaveCostingDraftView,
    CostingDetailByRFQView,
)

urlpatterns = [
    path("calculate", CalculateCostingView.as_view(), name="costing-calculate"),
    path("draft", SaveCostingDraftView.as_view(), name="costing-draft-save"),
    path("rfq/<int:rfq_id>", CostingDetailByRFQView.as_view(), name="costing-by-rfq"),
]

