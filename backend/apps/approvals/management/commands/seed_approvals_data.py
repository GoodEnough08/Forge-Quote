from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models import User, UserRole
from apps.approvals.models import QuotationApproval, ApprovalStatus
from apps.costing.models import CostingSheet
from apps.quotations.models import Quotation, QuotationTier, QuotationStatus
from apps.quotations.services.pdf_generator import QuotationPDFGenerator
from apps.rfqs.models import RFQ, RFQStatus


class Command(BaseCommand):
    help = "Seed realistic commercial quotations and approval workflow states for Phase 4"

    def handle(self, *args, **options):
        self.stdout.write("Seeding commercial quotations and approvals...")

        estimator = User.objects.filter(role=UserRole.ESTIMATOR).first()
        sales_head = User.objects.filter(role=UserRole.SALES_HEAD).first()

        if not estimator or not sales_head:
            self.stdout.write(self.style.ERROR("Estimator or Sales Head user missing. Run seed_demo_data first."))
            return

        rfq_19 = RFQ.objects.filter(rfq_number="RFQ-2611-019").first()
        rfq_23 = RFQ.objects.filter(rfq_number="RFQ-2611-023").first()
        rfq_14 = RFQ.objects.filter(rfq_number="RFQ-2611-014").first()

        # 1. RFQ-19 -> Pending Approval (Annual value: ₹2,48,40,000 > 25 Lakh)
        if rfq_19:
            part_19 = rfq_19.parts.first()
            sheet_19 = getattr(part_19, "costing_sheet", None)
            quote_19, created = Quotation.objects.get_or_create(
                quotation_number="QT-2611-019-01",
                defaults={
                    "rfq": rfq_19,
                    "costing_sheet": sheet_19,
                    "version": 1,
                    "status": QuotationStatus.AWAITING_APPROVAL,
                    "customer_name": rfq_19.customer_name,
                    "customer_contact": "Mr. Rajesh Deshmukh (Chief Sourcing Officer)",
                    "customer_address": "Mahindra Farm Equipment Div., Gate 4, Chakan, Pune",
                    "part_name": part_19.part_name,
                    "drawing_number": part_19.drawing_number,
                    "material_spec": part_19.material_spec,
                    "gross_weight_kg": part_19.gross_weight_kg,
                    "annual_volume": part_19.annual_volume,
                    "unit_price": Decimal("1035.00"),
                    "total_annual_value": Decimal("24840000.00"),
                    "requires_approval": True,
                    "delivery_terms": "Ex-Works Chakan Plant",
                    "payment_terms": "30 Days Net from date of invoice",
                    "created_by": estimator,
                },
            )
            if created:
                rfq_19.status = RFQStatus.AWAITING_APPROVAL
                rfq_19.save(update_fields=["status"])
                # Tier
                QuotationTier.objects.create(
                    quotation=quote_19,
                    quantity=part_19.annual_volume,
                    unit_price=Decimal("1035.00"),
                    gst_amount=Decimal("186.30"),
                    unit_price_with_gst=Decimal("1221.30"),
                    total_value=Decimal("24840000.00"),
                    total_with_gst=Decimal("29311200.00"),
                )
                # Pending Approval
                QuotationApproval.objects.create(
                    quotation=quote_19,
                    submitted_by=estimator,
                    status=ApprovalStatus.PENDING,
                    revision_number=1,
                    decision_reason="",
                )

        # 2. RFQ-23 -> Revision Requested by Sales Head
        if rfq_23:
            part_23 = rfq_23.parts.first()
            sheet_23 = getattr(part_23, "costing_sheet", None)
            quote_23, created = Quotation.objects.get_or_create(
                quotation_number="QT-2611-023-01",
                defaults={
                    "rfq": rfq_23,
                    "costing_sheet": sheet_23,
                    "version": 1,
                    "status": QuotationStatus.REVISION_REQUESTED,
                    "customer_name": rfq_23.customer_name,
                    "customer_contact": "Mr. S. K. Nair (Procurement Head)",
                    "customer_address": "CIF Chennai Assembly Plant, Tamil Nadu",
                    "part_name": part_23.part_name,
                    "drawing_number": part_23.drawing_number,
                    "material_spec": part_23.material_spec,
                    "gross_weight_kg": part_23.gross_weight_kg,
                    "annual_volume": part_23.annual_volume,
                    "unit_price": Decimal("324.50"),
                    "total_annual_value": Decimal("19470000.00"),
                    "requires_approval": True,
                    "delivery_terms": "CIF Chennai Port",
                    "payment_terms": "45 Days Net against Letter of Credit",
                    "created_by": estimator,
                },
            )
            if created:
                QuotationTier.objects.create(
                    quotation=quote_23,
                    quantity=part_23.annual_volume,
                    unit_price=Decimal("324.50"),
                    gst_amount=Decimal("58.41"),
                    unit_price_with_gst=Decimal("382.91"),
                    total_value=Decimal("19470000.00"),
                    total_with_gst=Decimal("22974600.00"),
                )
                QuotationApproval.objects.create(
                    quotation=quote_23,
                    submitted_by=estimator,
                    reviewed_by=sales_head,
                    status=ApprovalStatus.REVISION_REQUESTED,
                    revision_number=1,
                    decision_reason="Recheck cycle time on 20MnCr5 gear blank OD turning; target machine rate should be ₹850/hr.",
                    reviewed_at=timezone.now(),
                )

        # 3. RFQ-14 -> Approved by Sales Head (PDF Generated)
        if rfq_14:
            part_14 = rfq_14.parts.first()
            sheet_14 = getattr(part_14, "costing_sheet", None)
            quote_14, created = Quotation.objects.get_or_create(
                quotation_number="QT-2611-014-01",
                defaults={
                    "rfq": rfq_14,
                    "costing_sheet": sheet_14,
                    "version": 1,
                    "status": QuotationStatus.APPROVED,
                    "customer_name": rfq_14.customer_name,
                    "customer_contact": "Mr. Vivek Sharma (VP Sourcing)",
                    "customer_address": "Company B Automotive Works, Bhosari MIDC, Pune",
                    "part_name": part_14.part_name,
                    "drawing_number": part_14.drawing_number,
                    "material_spec": part_14.material_spec,
                    "gross_weight_kg": part_14.gross_weight_kg,
                    "annual_volume": part_14.annual_volume,
                    "unit_price": Decimal("138.80"),
                    "total_annual_value": Decimal("24984000.00"),
                    "requires_approval": True,
                    "delivery_terms": "FOB Pune Plant, weekly Kanban batches",
                    "payment_terms": "30 Days Net from date of invoice",
                    "created_by": estimator,
                },
            )
            if created:
                rfq_14.status = RFQStatus.APPROVED
                rfq_14.save(update_fields=["status"])
                QuotationTier.objects.create(
                    quotation=quote_14,
                    quantity=part_14.annual_volume,
                    unit_price=Decimal("138.80"),
                    gst_amount=Decimal("24.98"),
                    unit_price_with_gst=Decimal("163.78"),
                    total_value=Decimal("24984000.00"),
                    total_with_gst=Decimal("29480400.00"),
                )
                QuotationApproval.objects.create(
                    quotation=quote_14,
                    submitted_by=estimator,
                    reviewed_by=sales_head,
                    status=ApprovalStatus.APPROVED,
                    revision_number=1,
                    decision_reason="Commercial margins and FOB delivery terms approved. Authorized for customer submission.",
                    reviewed_at=timezone.now(),
                )
                QuotationPDFGenerator.generate_pdf(quote_14)

        self.stdout.write(self.style.SUCCESS("Successfully seeded Phase 4 quotations and approval workflows."))

