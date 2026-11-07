from django.urls import path
from .views import (
    HistoricalQuoteListView,
    HistoricalQuoteDetailView,
    HistoricalQuoteCompareView,
    HistoricalQuoteExcelImportView,
    ApplyHistoricalReferenceToRfqView,
)

urlpatterns = [
    path("quotes", HistoricalQuoteListView.as_view(), name="history_quote_list"),
    path("quotes/<int:pk>", HistoricalQuoteDetailView.as_view(), name="history_quote_detail"),
    path("compare", HistoricalQuoteCompareView.as_view(), name="history_quote_compare"),
    path("import-excel", HistoricalQuoteExcelImportView.as_view(), name="history_quote_import_excel"),
    path("apply-reference", ApplyHistoricalReferenceToRfqView.as_view(), name="history_apply_reference"),
]

