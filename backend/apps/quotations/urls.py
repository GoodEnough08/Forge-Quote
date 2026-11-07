from django.urls import path
from .views import (
    QuotationListCreateView,
    QuotationDetailView,
    QuotationGeneratePDFView,
    QuotationDownloadPDFView,
    QuotationSendView,
)

urlpatterns = [
    path("", QuotationListCreateView.as_view(), name="quotation_list_create"),
    path("<int:pk>", QuotationDetailView.as_view(), name="quotation_detail"),
    path("<int:pk>/generate-pdf", QuotationGeneratePDFView.as_view(), name="quotation_generate_pdf"),
    path("<int:pk>/pdf", QuotationDownloadPDFView.as_view(), name="quotation_download_pdf"),
    path("<int:pk>/send", QuotationSendView.as_view(), name="quotation_send"),
]

