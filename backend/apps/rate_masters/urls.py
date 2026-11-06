from django.urls import path
from .views import (
    MaterialRateListCreateView,
    MaterialRateDetailView,
    MachineRateListCreateView,
    MachineRateDetailView,
    ActiveRatesLookupView,
)

urlpatterns = [
    path("materials", MaterialRateListCreateView.as_view(), name="material-rates-list-create"),
    path("materials/<int:pk>", MaterialRateDetailView.as_view(), name="material-rates-detail"),
    path("machines", MachineRateListCreateView.as_view(), name="machine-rates-list-create"),
    path("machines/<int:pk>", MachineRateDetailView.as_view(), name="machine-rates-detail"),
    path("lookup", ActiveRatesLookupView.as_view(), name="active-rates-lookup"),
]

