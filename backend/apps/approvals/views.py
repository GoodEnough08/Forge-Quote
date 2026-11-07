from django.shortcuts import get_object_or_404
from rest_framework import status, views
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import QuotationApproval, ApprovalStatus
from .serializers import QuotationApprovalSerializer
from .services import QuotationApprovalService


class QuotationApprovalListView(views.APIView):
    """
    List approval queue records.
    Filters: status (Pending, Approved, Rejected, Revision Requested).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = QuotationApproval.objects.select_related(
            "quotation__rfq", "quotation__costing_sheet", "submitted_by", "reviewed_by"
        ).all()

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status__iexact=status_param.strip())

        serializer = QuotationApprovalSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuotationApprovalDetailView(views.APIView):
    """
    Retrieve single approval detail with full commercial and technical context.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        approval = get_object_or_404(
            QuotationApproval.objects.select_related(
                "quotation__rfq", "quotation__costing_sheet", "submitted_by", "reviewed_by"
            ),
            pk=pk,
        )
        serializer = QuotationApprovalSerializer(approval)

        # Include costing sheet and operations if available
        costing_data = None
        quotation = approval.quotation
        if quotation.costing_sheet:
            from apps.costing.serializers import CostingSheetSerializer
            costing_data = CostingSheetSerializer(quotation.costing_sheet).data

        return Response(
            {
                "approval": serializer.data,
                "costing_breakdown": costing_data,
                "customer_details": {
                    "contact": quotation.customer_contact,
                    "address": quotation.customer_address,
                    "delivery_terms": quotation.delivery_terms,
                    "payment_terms": quotation.payment_terms,
                    "validity_days": quotation.validity_days,
                },
            },
            status=status.HTTP_200_OK,
        )


class SubmitForApprovalView(views.APIView):
    """
    Estimator submits quotation for commercial Sales Head approval.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        quotation_id = request.data.get("quotation_id")
        if not quotation_id:
            return Response({"detail": "quotation_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            approval = QuotationApprovalService.submit_for_approval(int(quotation_id), request.user)
            serializer = QuotationApprovalSerializer(approval)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class ApproveQuotationView(views.APIView):
    """
    Sales Head approves quotation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        reason = request.data.get("reason", "")
        try:
            approval = QuotationApprovalService.approve_quotation(pk, request.user, reason)
            serializer = QuotationApprovalSerializer(approval)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except PermissionDenied as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class RejectQuotationView(views.APIView):
    """
    Sales Head rejects quotation. Detailed reason is strictly required.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "A detailed rejection reason is mandatory."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            approval = QuotationApprovalService.reject_quotation(pk, request.user, reason)
            serializer = QuotationApprovalSerializer(approval)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except PermissionDenied as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class RequestRevisionView(views.APIView):
    """
    Sales Head requests quotation revisions. Detailed reason is strictly required.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "A detailed revision reason is mandatory."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            approval = QuotationApprovalService.request_revision(pk, request.user, reason)
            serializer = QuotationApprovalSerializer(approval)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except PermissionDenied as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_403_FORBIDDEN)
        except ValidationError as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class ResubmitQuotationView(views.APIView):
    """
    Estimator revises and resubmits quotation, creating a new audit cycle.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        quotation_id = request.data.get("quotation_id")
        if not quotation_id:
            return Response({"detail": "quotation_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            approval = QuotationApprovalService.resubmit_quotation(int(quotation_id), request.user)
            serializer = QuotationApprovalSerializer(approval)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class ApprovalHistoryView(views.APIView):
    """
    Retrieve historical audit log of all approval cycles for a quotation.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, quotation_id):
        approvals = QuotationApproval.objects.filter(quotation_id=quotation_id).order_by("-submitted_at")
        serializer = QuotationApprovalSerializer(approvals, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

