import os
from decimal import Decimal
from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, views
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsEstimator
from apps.costing.models import CostingSheet
from apps.rfqs.models import RFQ
from .models import Quotation, QuotationTier, QuotationStatus, APPROVAL_THRESHOLD_INR
from .serializers import (
    QuotationListSerializer,
    QuotationDetailSerializer,
)
from .services.pdf_generator import QuotationPDFGenerator
from apps.approvals.services import QuotationApprovalService


class QuotationListCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Quotation.objects.select_related("rfq", "created_by").prefetch_related("approvals").all()
        status_param = request.query_params.get("status")
        customer = request.query_params.get("customer")

        if status_param:
            qs = qs.filter(status__iexact=status_param.strip())
        if customer:
            qs = qs.filter(customer_name__icontains=customer.strip())

        serializer = QuotationListSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        costing_sheet_id = request.data.get("costing_sheet_id")
        rfq_id = request.data.get("rfq_id")

        if not costing_sheet_id and not rfq_id:
            return Response(
                {"detail": "Either costing_sheet_id or rfq_id is required to create a quotation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if costing_sheet_id:
            sheet = get_object_or_404(
                CostingSheet.objects.select_related("part__rfq").prefetch_related("volume_tiers"),
                pk=costing_sheet_id,
            )
            part = sheet.part
            rfq = part.rfq
            unit_price = sheet.final_price_per_unit
            gross_weight = sheet.gross_weight_kg
            volume = part.annual_volume
            total_annual = unit_price * Decimal(volume)
        else:
            rfq = get_object_or_404(RFQ.objects.prefetch_related("parts"), pk=rfq_id)
            part = rfq.parts.first()
            if not part:
                return Response({"detail": "RFQ has no associated part."}, status=status.HTTP_400_BAD_REQUEST)
            sheet = getattr(part, "costing_sheet", None)
            unit_price = sheet.final_price_per_unit if sheet else Decimal("500.00")
            gross_weight = part.gross_weight_kg
            volume = part.annual_volume
            total_annual = unit_price * Decimal(volume)

        # Unique quote number
        count = Quotation.objects.count() + 1
        quote_num = f"QT-{rfq.rfq_number.replace('RFQ-', '')}-01" if "RFQ-" in rfq.rfq_number else f"QT-2026-{count:03d}"
        if Quotation.objects.filter(quotation_number=quote_num).exists():
            quote_num = f"QT-2026-{count + 10:03d}"

        requires_app = total_annual > APPROVAL_THRESHOLD_INR

        quotation = Quotation.objects.create(
            quotation_number=quote_num,
            rfq=rfq,
            costing_sheet=sheet,
            version=1,
            status=QuotationStatus.DRAFT,
            customer_name=rfq.customer_name,
            customer_contact=request.data.get("customer_contact", ""),
            customer_address=request.data.get("customer_address", ""),
            part_name=part.part_name,
            drawing_number=part.drawing_number,
            material_spec=part.material_spec,
            gross_weight_kg=gross_weight,
            annual_volume=volume,
            unit_price=unit_price,
            total_annual_value=total_annual,
            gst_percentage=Decimal("18.00"),
            requires_approval=requires_app,
            delivery_terms=rfq.delivery_requirements or "Ex-Works Pune Plant",
            payment_terms=request.data.get("payment_terms", "30 Days Net from Invoice Date"),
            validity_days=int(request.data.get("validity_days", 30)),
            created_by=request.user,
        )

        # Populate quantity tiers if costing sheet has them
        if sheet and sheet.volume_tiers.exists():
            for vt in sheet.volume_tiers.all():
                QuotationTier.objects.create(
                    quotation=quotation,
                    quantity=vt.quantity,
                    unit_price=vt.quotation_price_per_unit,
                    gst_amount=vt.gst_per_unit,
                    unit_price_with_gst=vt.price_with_gst_per_unit,
                    total_value=vt.total_quotation_value,
                    total_with_gst=vt.grand_total_with_gst,
                )
        else:
            # Baseline tier
            gst_val = round(unit_price * Decimal("0.18"), 2)
            unit_with_gst = unit_price + gst_val
            QuotationTier.objects.create(
                quotation=quotation,
                quantity=volume,
                unit_price=unit_price,
                gst_amount=gst_val,
                unit_price_with_gst=unit_with_gst,
                total_value=unit_price * Decimal(volume),
                total_with_gst=unit_with_gst * Decimal(volume),
            )

        serializer = QuotationDetailSerializer(quotation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuotationDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        quote = get_object_or_404(
            Quotation.objects.select_related("rfq", "created_by", "costing_sheet")
            .prefetch_related("tiers", "approvals__submitted_by", "approvals__reviewed_by"),
            pk=pk,
        )
        serializer = QuotationDetailSerializer(quote)
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuotationGeneratePDFView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        quote = get_object_or_404(Quotation.objects.prefetch_related("tiers", "approvals"), pk=pk)

        # Generate ReportLab PDF
        filepath = QuotationPDFGenerator.generate_pdf(quote)

        return Response(
            {
                "detail": "Quotation PDF successfully generated.",
                "quotation_number": quote.quotation_number,
                "version": quote.version,
                "pdf_generated_at": quote.pdf_generated_at,
            },
            status=status.HTTP_200_OK,
        )


class QuotationDownloadPDFView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        quote = get_object_or_404(Quotation, pk=pk)

        # Generate on demand if not yet generated
        if not quote.pdf_file_path or not os.path.exists(quote.pdf_file_path):
            QuotationPDFGenerator.generate_pdf(quote)

        filename = os.path.basename(quote.pdf_file_path)
        response = FileResponse(open(quote.pdf_file_path, "rb"), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class QuotationSendView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            quote = QuotationApprovalService.send_quotation(pk, request.user)
            serializer = QuotationDetailSerializer(quote)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ValidationError as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)

