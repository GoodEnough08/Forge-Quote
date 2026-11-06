from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include


def health_check(_request):
    return JsonResponse(
        {
            "status": "healthy",
            "service": "ForgeQuote Django REST API",
            "phase": 2,
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health_check, name="health_check"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/rfqs", include("apps.rfqs.urls")),
    path("api/v1/rates/", include("apps.rate_masters.urls")),
    path("api/v1/costing/", include("apps.costing.urls")),
]
