from django.urls import path
from .views import (
    QuotationApprovalListView,
    QuotationApprovalDetailView,
    SubmitForApprovalView,
    ApproveQuotationView,
    RejectQuotationView,
    RequestRevisionView,
    ResubmitQuotationView,
    ApprovalHistoryView,
)

urlpatterns = [
    path("", QuotationApprovalListView.as_view(), name="approval_list"),
    path("<int:pk>", QuotationApprovalDetailView.as_view(), name="approval_detail"),
    path("submit", SubmitForApprovalView.as_view(), name="approval_submit"),
    path("<int:pk>/approve", ApproveQuotationView.as_view(), name="approval_approve"),
    path("<int:pk>/reject", RejectQuotationView.as_view(), name="approval_reject"),
    path("<int:pk>/revision", RequestRevisionView.as_view(), name="approval_revision"),
    path("resubmit", ResubmitQuotationView.as_view(), name="approval_resubmit"),
    path("history/<int:quotation_id>", ApprovalHistoryView.as_view(), name="approval_history"),
]

