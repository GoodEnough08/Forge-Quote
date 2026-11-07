from django.urls import path
from .views import (
    IntakeSessionListCreateView,
    IntakeSessionDetailView,
    IntakeDocumentUploadView,
    IntakeDocumentDownloadView,
    IntakeExtractView,
    ExtractedFieldUpdateView,
    SuggestedRoutingUpdateView,
    IntakeCommitView,
)

urlpatterns = [
    path("sessions", IntakeSessionListCreateView.as_view(), name="intake_session_list_create"),
    path("sessions/<int:pk>", IntakeSessionDetailView.as_view(), name="intake_session_detail"),
    path("sessions/<int:pk>/upload", IntakeDocumentUploadView.as_view(), name="intake_document_upload"),
    path("sessions/<int:pk>/extract", IntakeExtractView.as_view(), name="intake_extract"),
    path("sessions/<int:pk>/fields/<int:field_id>", ExtractedFieldUpdateView.as_view(), name="intake_field_update"),
    path("sessions/<int:pk>/routing/<int:routing_id>", SuggestedRoutingUpdateView.as_view(), name="intake_routing_update"),
    path("sessions/<int:pk>/commit", IntakeCommitView.as_view(), name="intake_commit"),
    path("documents/<int:doc_id>/download", IntakeDocumentDownloadView.as_view(), name="intake_document_download"),
]

