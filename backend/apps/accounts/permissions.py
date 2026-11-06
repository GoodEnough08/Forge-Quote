from rest_framework.permissions import BasePermission
from apps.accounts.models import UserRole


class IsEstimator(BasePermission):
    message = "Operation requires ESTIMATOR role."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.ESTIMATOR
        )


class IsSalesHead(BasePermission):
    message = "Operation requires SALES_HEAD role."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.SALES_HEAD
        )


class IsEstimatorOrSalesHead(BasePermission):
    message = "Operation requires ESTIMATOR or SALES_HEAD role."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (UserRole.ESTIMATOR, UserRole.SALES_HEAD)
        )