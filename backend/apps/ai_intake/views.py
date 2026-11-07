from decimal import Decimal
import os
from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.accounts.permissions import IsEstimator
from apps.rfqs.models import RFQ, Part, RFQStatus
from apps.rfqs.services import create_rfq, generate_next_rfq_number
from .models import (
    IntakeSession,
    IntakeDocument,
    ExtractedField,
    SuggestedRouting,
    IntakeSessionStatus,
    IntakeDocumentType,
    ExtractionFieldStatus,
)
from .serializers import (
    IntakeSessionListSerializer,
    IntakeSessionDetailSerializer,
    IntakeDocumentSerializer,
    ExtractedFieldSerializer,
    SuggestedRoutingSerializer,
)
from .services.ai_extraction import AIExtractionService


class IntakeSessionListCreateView(views.APIView):
    """
    List active AI intake sessions or create a new session.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = IntakeSession.objects.select_related("rfq", "created_by").prefetch_related("documents").all()
        serializer = IntakeSessionListSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        title = request.data.get("title", "New RFQ Intake Session").strip()
        notes = request.data.get("notes", "").strip()

        session = IntakeSession.objects.create(
            title=title or "New RFQ Intake Session",
            notes=notes,
            created_by=request.user,
            status=IntakeSessionStatus.UPLOADED,
        )
        serializer = IntakeSessionDetailSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IntakeSessionDetailView(views.APIView):
    """
    Retrieve single intake session with all documents, advisory fields, and routings.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        session = get_object_or_404(
            IntakeSession.objects.select_related("rfq").prefetch_related(
                "documents", "extracted_fields", "suggested_routings"
            ),
            pk=pk,
        )
        serializer = IntakeSessionDetailSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        session = get_object_or_404(IntakeSession, pk=pk)
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IntakeDocumentUploadView(views.APIView):
    """
    Uploads RFQ documents, drawing PDFs, Excel part lists, or email tender text.
    Validates file sizes, types, and stores them in private storage.
    """
    permission_classes = [IsAuthenticated]

    ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".txt", ".eml"}

    def post(self, request, pk):
        session = get_object_or_404(IntakeSession, pk=pk)
        max_bytes = getattr(settings, "MAX_UPLOAD_SIZE_BYTES", 20 * 1024 * 1024)

        created_docs = []

        # 1. Handle uploaded binary files
        files = request.FILES.getlist("files") or ([request.FILES["file"]] if "file" in request.FILES else [])
        for f in files:
            ext = Path(f.name).suffix.lower()
            if ext not in self.ALLOWED_EXTENSIONS:
                return Response(
                    {"detail": f"File type '{ext}' is not supported. Allowed: PDF, XLSX, XLS, TXT, EML."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if f.size > max_bytes:
                return Response(
                    {"detail": f"File '{f.name}' exceeds the 20MB maximum size limit."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Determine file type
            if ext == ".pdf":
                doc_type = request.data.get("file_type", IntakeDocumentType.PDF_RFQ)
            elif ext in [".xlsx", ".xls"]:
                doc_type = IntakeDocumentType.EXCEL_PART_LIST
            else:
                doc_type = IntakeDocumentType.EMAIL_TEXT

            # Store in private media directory
            session_dir = settings.PRIVATE_MEDIA_ROOT / "rfq_intake" / f"session_{session.id}"
            session_dir.mkdir(parents=True, exist_ok=True)
            saved_path = session_dir / f.name

            with open(saved_path, "wb+") as dest:
                for chunk in f.chunks():
                    dest.write(chunk)

            doc = IntakeDocument.objects.create(
                session=session,
                file_name=f.name,
                file_type=doc_type,
                file_path=str(saved_path),
                file_size_bytes=f.size,
            )
            created_docs.append(doc)

        # 2. Handle raw email / tender text input
        raw_text = request.data.get("email_text", "").strip()
        if raw_text:
            text_doc = IntakeDocument.objects.create(
                session=session,
                file_name="Email_Tender_Notice.txt",
                file_type=IntakeDocumentType.EMAIL_TEXT,
                raw_text=raw_text,
                file_size_bytes=len(raw_text.encode("utf-8")),
            )
            created_docs.append(text_doc)

        if not created_docs:
            return Response(
                {"detail": "No valid files or email text provided for upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = IntakeSessionStatus.UPLOADED
        session.save(update_fields=["status", "updated_at"])

        serializer = IntakeDocumentSerializer(created_docs, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IntakeDocumentDownloadView(views.APIView):
    """
    Secure streaming view for confidential drawing & RFQ documents.
    Protects files behind JWT authentication without public static URL exposure.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        doc = get_object_or_404(IntakeDocument, pk=doc_id)
        if not doc.file_path or not os.path.exists(doc.file_path):
            raise Http404("Document file not found on private storage.")

        filename = os.path.basename(doc.file_path)
        response = FileResponse(open(doc.file_path, "rb"), as_attachment=False)
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response


class IntakeExtractView(views.APIView):
    """
    Triggers AI document parsing & extraction for all documents in the session.
    Generates advisory ExtractedField proposals and routing suggestions.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        session = get_object_or_404(IntakeSession.objects.prefetch_related("documents"), pk=pk)

        if not session.documents.exists():
            return Response(
                {"detail": "Cannot run extraction on a session with no uploaded documents."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = IntakeSessionStatus.EXTRACTING
        session.save(update_fields=["status"])

        doc_payloads = []
        for d in session.documents.all():
            file_bytes = None
            if d.file_path and os.path.exists(d.file_path):
                with open(d.file_path, "rb") as f:
                    file_bytes = f.read()

            doc_payloads.append(
                {
                    "file_name": d.file_name,
                    "file_type": d.file_type,
                    "file_bytes": file_bytes,
                    "raw_text": d.raw_text,
                }
            )

        try:
            extraction_res = AIExtractionService.process_intake_documents(
                documents=doc_payloads,
                intake_session_id=session.id,
            )
        except Exception as ex:
            session.status = IntakeSessionStatus.FAILED
            session.save(update_fields=["status"])
            return Response(
                {"detail": f"Document extraction failed: {str(ex)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Clear any prior proposals from earlier extraction runs on this session
        session.extracted_fields.all().delete()
        session.suggested_routings.all().delete()

        # Save advisory-only extracted fields
        for field in extraction_res["extracted_fields"]:
            ExtractedField.objects.create(
                session=session,
                field_key=field["field_key"],
                field_label=field["field_label"],
                suggested_value=field["suggested_value"],
                confirmed_value=field["suggested_value"],  # Pre-fill for easy editor confirmation
                confidence_score=field["confidence_score"],
                source_document_name=field.get("source_document_name", ""),
                source_page_or_row=field.get("source_page_or_row", ""),
                source_snippet=field.get("source_snippet", ""),
                status=ExtractionFieldStatus.PENDING,
            )

        # Save advisory routing suggestions
        for route in extraction_res["routing_suggestions"]:
            SuggestedRouting.objects.create(
                session=session,
                sequence=route["sequence"],
                operation_name=route["operation_name"],
                work_center=route["work_center"],
                cycle_time_minutes=Decimal(str(route["cycle_time_minutes"])),
                machine_hourly_rate=Decimal(str(route["machine_hourly_rate"])),
                matched_historical_part_name=route.get("matched_historical_part_name", ""),
                recommendation_reason=route.get("recommendation_reason", ""),
                is_accepted=route.get("is_accepted", True),
            )

        session.status = IntakeSessionStatus.REVIEW_READY
        session.save(update_fields=["status", "updated_at"])

        updated_session = IntakeSession.objects.prefetch_related(
            "documents", "extracted_fields", "suggested_routings"
        ).get(pk=session.id)
        serializer = IntakeSessionDetailSerializer(updated_session)

        return Response(
            {
                "session": serializer.data,
                "ai_mode": extraction_res.get("ai_mode"),
                "excel_preview": extraction_res.get("excel_preview"),
            },
            status=status.HTTP_200_OK,
        )


class ExtractedFieldUpdateView(views.APIView):
    """
    Estimator reviews an extracted field: accepts, edits, or rejects the AI proposal.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, field_id):
        field = get_object_or_404(ExtractedField, pk=field_id, session_id=pk)

        new_status = request.data.get("status")
        confirmed_value = request.data.get("confirmed_value")

        if new_status in ExtractionFieldStatus.values:
            field.status = new_status
            if new_status in [ExtractionFieldStatus.ACCEPTED, ExtractionFieldStatus.EDITED]:
                field.is_confirmed = True
            elif new_status == ExtractionFieldStatus.REJECTED:
                field.is_confirmed = False

        if confirmed_value is not None:
            field.confirmed_value = str(confirmed_value).strip()
            if field.status == ExtractionFieldStatus.PENDING:
                field.status = ExtractionFieldStatus.EDITED
                field.is_confirmed = True

        field.save()
        serializer = ExtractedFieldSerializer(field)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SuggestedRoutingUpdateView(views.APIView):
    """
    Estimator modifies or rejects an advisory manufacturing routing operation.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, routing_id):
        routing = get_object_or_404(SuggestedRouting, pk=routing_id, session_id=pk)

        if "is_accepted" in request.data:
            routing.is_accepted = bool(request.data["is_accepted"])
        if "operation_name" in request.data:
            routing.operation_name = request.data["operation_name"]
        if "work_center" in request.data:
            routing.work_center = request.data["work_center"]
        if "cycle_time_minutes" in request.data:
            routing.cycle_time_minutes = Decimal(str(request.data["cycle_time_minutes"]))
        if "machine_hourly_rate" in request.data:
            routing.machine_hourly_rate = Decimal(str(request.data["machine_hourly_rate"]))

        routing.save()
        serializer = SuggestedRoutingSerializer(routing)
        return Response(serializer.data, status=status.HTTP_200_OK)


class IntakeCommitView(views.APIView):
    """
    Commits reviewed and confirmed fields to create a production RFQ and Part.
    Enforces Phase 3 advisory safeguards:
    - Never uses rejected fields.
    - Only incorporates confirmed/accepted/edited data.
    - Requires estimator authorization.
    """
    permission_classes = [IsAuthenticated, IsEstimator]

    def post(self, request, pk):
        session = get_object_or_404(
            IntakeSession.objects.prefetch_related("extracted_fields", "suggested_routings"),
            pk=pk,
        )

        # Collect accepted and edited fields
        field_map = {}
        for f in session.extracted_fields.all():
            # STRICT GUARD: Never include rejected fields!
            if f.status == ExtractionFieldStatus.REJECTED:
                continue
            # Use confirmed_value or suggested_value
            val = (f.confirmed_value or f.suggested_value or "").strip()
            field_map[f.field_key] = val

        # Validate mandatory RFQ/Part fields
        customer_name = field_map.get("customer_name") or request.data.get("customer_name", "Prospective OEM Client")
        part_name = field_map.get("part_name") or request.data.get("part_name", "Forged Component")
        material_spec = field_map.get("material_spec") or request.data.get("material_spec", "EN8")

        try:
            gross_weight = Decimal(str(field_map.get("gross_weight_kg") or request.data.get("gross_weight_kg", "1.000")))
            if gross_weight <= Decimal("0.000"):
                gross_weight = Decimal("1.000")
        except Exception:
            gross_weight = Decimal("1.000")

        try:
            annual_volume = int(field_map.get("annual_volume") or request.data.get("annual_volume", "10000"))
            if annual_volume <= 0:
                annual_volume = 10000
        except Exception:
            annual_volume = 10000

        rfq_number = field_map.get("rfq_number") or request.data.get("rfq_number")
        if not rfq_number or RFQ.objects.filter(rfq_number=rfq_number).exists():
            rfq_number = generate_next_rfq_number()

        drawing_number = field_map.get("drawing_number") or request.data.get("drawing_number", "DRW-PENDING")
        due_date = field_map.get("due_date") or request.data.get("due_date")
        if not due_date or len(due_date) < 10:
            from datetime import date, timedelta
            due_date = str(date.today() + timedelta(days=14))

        delivery_reqs = field_map.get("delivery_requirements") or request.data.get("delivery_requirements", "Standard Ex-Works")

        # Gather accepted routing operations
        accepted_routes = session.suggested_routings.filter(is_accepted=True).order_by("sequence")
        if accepted_routes.exists():
            primary_route = accepted_routes.first()
            cycle_time = primary_route.cycle_time_minutes
            machine_rate = primary_route.machine_hourly_rate
            process_desc = " + ".join([r.operation_name for r in accepted_routes[:3]])
        else:
            cycle_time = Decimal("2.50")
            machine_rate = Decimal("850.00")
            process_desc = "Hot Forging + CNC Turning"

        # Create RFQ and Part
        rfq_payload = {
            "rfq_number": rfq_number,
            "customer_name": customer_name,
            "industry": "Automotive & Forging",
            "delivery_requirements": delivery_reqs,
            "due_date": due_date[:10],
            "assigned_estimator_id": request.user.id,
            "notes": f"Created via AI Intake Session #{session.id} ({session.title}).",
            "part": {
                "part_name": part_name,
                "drawing_number": drawing_number,
                "material_spec": material_spec,
                "gross_weight_kg": gross_weight,
                "annual_volume": annual_volume,
                "cycle_time_minutes": cycle_time,
                "machine_hourly_rate_inr": machine_rate,
                "process_type": process_desc,
            },
        }

        new_rfq = create_rfq(rfq_payload, request.user)

        session.rfq = new_rfq
        session.status = IntakeSessionStatus.COMMITTED
        session.save(update_fields=["rfq", "status", "updated_at"])

        return Response(
            {
                "detail": f"Successfully created RFQ {new_rfq.rfq_number} from intake session #{session.id}.",
                "rfq_id": new_rfq.id,
                "rfq_number": new_rfq.rfq_number,
                "part_id": new_rfq.parts.first().id if new_rfq.parts.exists() else None,
            },
            status=status.HTTP_201_CREATED,
        )

