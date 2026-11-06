from django.urls import path
from apps.accounts.views import LoginView, CurrentUserView, EstimatorListView

urlpatterns = [
    path("login", LoginView.as_view(), name="auth-login"),
    path("me", CurrentUserView.as_view(), name="auth-me"),
    path("estimators", EstimatorListView.as_view(), name="auth-estimators"),
]