from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import path, include


def health_check(_request):
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        db_ok = False

    return JsonResponse(
        {
            "status": "healthy" if db_ok else "degraded",
            "service": "ForgeQuote Industrial Costing & Quotation API",
            "version": "1.0.0",
            "phase": "Phase 5 Final Release",
            "database": "connected" if db_ok else "unreachable",
            "statutory_threshold_inr": "2500000.00",
            "gst_rate": "18.0%",
        },
        status=200 if db_ok else 503,
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health_check, name="health_check"),
    path("api/v1/health", health_check, name="api_health_check"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/rfqs", include("apps.rfqs.urls")),
    path("api/v1/rates/", include("apps.rate_masters.urls")),
    path("api/v1/costing/", include("apps.costing.urls")),
    path("api/v1/intake/", include("apps.ai_intake.urls")),
    path("api/v1/history/", include("apps.history.urls")),
    path("api/v1/quotations/", include("apps.quotations.urls")),
    path("api/v1/approvals/", include("apps.approvals.urls")),
]
