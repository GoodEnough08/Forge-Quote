from decimal import Decimal, InvalidOperation
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.rfqs.models import RFQ, Part
from .models import HistoricalQuotation
from .serializers import HistoricalQuotationSerializer
from .services import HistoricalQuoteSearchService


class HistoricalQuoteListView(views.APIView):
    """
    Search and filter historical quotations with structured similarity ranking.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        part_name = request.query_params.get("part_name")
        customer_name = request.query_params.get("customer_name")
        material_grade = request.query_params.get("material_grade")
        drawing_number = request.query_params.get("drawing_number")
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")
        quote_status = request.query_params.get("status")

        min_weight = None
        max_weight = None
        ref_weight = None

        try:
            if request.query_params.get("min_weight"):
                min_weight = Decimal(request.query_params.get("min_weight"))
            if request.query_params.get("max_weight"):
                max_weight = Decimal(request.query_params.get("max_weight"))
            if request.query_params.get("reference_weight"):
                ref_weight = Decimal(request.query_params.get("reference_weight"))
        except (InvalidOperation, ValueError):
            return Response(
                {"detail": "Weight filters must be valid decimal numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ref_grade = request.query_params.get("reference_grade")

        results = HistoricalQuoteSearchService.search_quotes(
            part_name=part_name,
            customer_name=customer_name,
            material_grade=material_grade,
            drawing_number=drawing_number,
            min_weight=min_weight,
            max_weight=max_weight,
            from_date=from_date,
            to_date=to_date,
            status=quote_status,
            reference_weight=ref_weight,
            reference_grade=ref_grade,
        )
        return Response(results, status=status.HTTP_200_OK)


class HistoricalQuoteDetailView(views.APIView):
    """
    Retrieve single historical quotation with full immutable costing snapshot.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            quote = HistoricalQuotation.objects.prefetch_related("operations").get(pk=pk)
        except HistoricalQuotation.DoesNotExist:
            return Response({"detail": "Historical quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = HistoricalQuotationSerializer(quote)
        return Response(serializer.data, status=status.HTTP_200_OK)


class HistoricalQuoteCompareView(views.APIView):
    """
    Compare two historical quotations side-by-side with variance calculations.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        quote_id_a = request.data.get("quote_id_a")
        quote_id_b = request.data.get("quote_id_b")

        if not quote_id_a or not quote_id_b:
            return Response(
                {"detail": "Both quote_id_a and quote_id_b are required for comparison."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            comparison = HistoricalQuoteSearchService.compare_two_quotes(
                int(quote_id_a), int(quote_id_b)
            )
            return Response(comparison, status=status.HTTP_200_OK)
        except HistoricalQuotation.DoesNotExist:
            return Response(
                {"detail": "One or both specified quotation records were not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as ex:
            return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)


class HistoricalQuoteExcelImportView(views.APIView):
    """
    Batch import legacy Excel quotation registers using OpenPyXL / Pandas.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if "file" not in request.FILES:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = request.FILES["file"]
        if not (uploaded_file.name.endswith(".xlsx") or uploaded_file.name.endswith(".xls")):
            return Response(
                {"detail": "File must be an Excel spreadsheet (.xlsx or .xls)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = uploaded_file.read()
        try:
            res = HistoricalQuoteSearchService.batch_import_excel_quotations(content)
            return Response(res, status=status.HTTP_200_OK)
        except Exception as ex:
            return Response(
                {"detail": f"Failed to parse Excel file: {str(ex)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ApplyHistoricalReferenceToRfqView(views.APIView):
    """
    Applies a historical quotation as engineering reference to an RFQ.
    Copies material spec, cycle times, or notes without mutating the immutable quote.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        quote_id = request.data.get("quote_id")
        rfq_id = request.data.get("rfq_id")

        if not quote_id or not rfq_id:
            return Response(
                {"detail": "Both quote_id and rfq_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            quote = HistoricalQuotation.objects.prefetch_related("operations").get(pk=quote_id)
            rfq = RFQ.objects.get(pk=rfq_id)
        except (HistoricalQuotation.DoesNotExist, RFQ.DoesNotExist):
            return Response({"detail": "Quotation or RFQ not found."}, status=status.HTTP_404_NOT_FOUND)

        # Update RFQ notes with reference provenance
        rfq.notes = (
            (rfq.notes or "")
            + f"\n[Reference: {quote.quote_number} - {quote.part_name} quoted on {quote.quoted_date} @ ₹{quote.final_price_per_unit}/pc]"
        ).strip()
        rfq.save(update_fields=["notes"])

        part = rfq.parts.first()
        if part:
            first_op = quote.operations.first()
            if first_op:
                part.cycle_time_minutes = first_op.cycle_time_minutes
                part.machine_hourly_rate_inr = first_op.machine_hourly_rate
                part.save(update_fields=["cycle_time_minutes", "machine_hourly_rate_inr"])

        return Response(
            {
                "detail": f"Historical quote {quote.quote_number} linked as reference to {rfq.rfq_number}.",
                "rfq_id": rfq.id,
                "quote_number": quote.quote_number,
            },
            status=status.HTTP_200_OK,
        )

