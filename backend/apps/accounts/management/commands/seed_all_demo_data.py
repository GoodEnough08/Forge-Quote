from datetime import date, timedelta
from decimal import Decimal
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.accounts.models import User, UserRole
from apps.rfqs.models import RFQ, Part, RFQStatus
from apps.quotations.models import Quotation, QuotationTier, QuotationStatus
from apps.approvals.models import QuotationApproval, ApprovalStatus
from apps.quotations.services.pdf_generator import QuotationPDFGenerator


class Command(BaseCommand):
    help = "Master idempotent seed command for all ForgeQuote demo data across Phases 1-5"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("==> Starting ForgeQuote Unified Master Seed..."))

        # Step 1: Run core demo data (users, rate masters, base RFQs)
        self.stdout.write("1. Seeding users, rate masters, and production RFQs...")
        call_command("seed_demo_data")

        # Step 2: Run historical quote archive
        self.stdout.write("2. Seeding historical quotation archive & operations...")
        call_command("seed_historical_quotes")

        # Step 3: Run Phase 4 approval workflow seeds
        self.stdout.write("3. Seeding quotations and approval workflows...")
        call_command("seed_approvals_data")

        # Step 4: Ensure all roles and quotation lifecycle states exist
        with transaction.atomic():
            estimator = User.objects.filter(role=UserRole.ESTIMATOR).first()
            sales_head = User.objects.filter(role=UserRole.SALES_HEAD).first()

            # Ensure Plant Head / Reviewer exists if needed
            plant_head, created = User.objects.get_or_create(
                email="planthead@forgequote.in",
                defaults={
                    "full_name": "Rajeshwar Patil (General Manager - Operations)",
                    "role": UserRole.SALES_HEAD,
                    "is_active": True,
                },
            )
            if created:
                plant_head.set_password("PlantHead@123")
                plant_head.save()

            # Add a Rejected Quotation Example for complete workflow demonstration
            rfq_rej, created = RFQ.objects.get_or_create(
                rfq_number="RFQ-2611-008",
                defaults={
                    "customer_name": "Kirloskar Oil Engines Ltd",
                    "industry": "Industrial Power & Gensets",
                    "status": RFQStatus.LOST,
                    "due_date": date.today() + timedelta(days=10),
                    "delivery_requirements": "Ex-Works Kagal Plant, Kolhapur",
                    "assigned_estimator": estimator,
                    "notes": "Costing failed margin requirement; rejected during commercial review.",
                },
            )
            part_rej, _ = Part.objects.get_or_create(
                rfq=rfq_rej,
                part_name="Crankshaft 4-Cylinder Forging Blank",
                defaults={
                    "drawing_number": "DRW-KOEL-CS-440",
                    "material_spec": "40Cr4 forging",
                    "gross_weight_kg": Decimal("18.50"),
                    "annual_volume": 6000,
                    "cycle_time_minutes": Decimal("8.50"),
                    "machine_hourly_rate_inr": Decimal("1650.00"),
                },
            )

            quote_rej, q_created = Quotation.objects.get_or_create(
                quotation_number="QT-2611-008-01",
                defaults={
                    "rfq": rfq_rej,
                    "version": 1,
                    "status": QuotationStatus.REJECTED,
                    "customer_name": rfq_rej.customer_name,
                    "customer_contact": "Mr. Anand Joshi (Vendor Development)",
                    "customer_address": "Kirloskar Oil Engines, Plot 5, MIDC, Kagal, Kolhapur",
                    "part_name": part_rej.part_name,
                    "drawing_number": part_rej.drawing_number,
                    "material_spec": part_rej.material_spec,
                    "gross_weight_kg": part_rej.gross_weight_kg,
                    "annual_volume": part_rej.annual_volume,
                    "unit_price": Decimal("2450.00"),
                    "total_annual_value": Decimal("14700000.00"),
                    "requires_approval": True,
                    "delivery_terms": "Ex-Works Kagal Plant",
                    "payment_terms": "45 Days Net",
                    "validity_days": 30,
                    "created_by": estimator,
                },
            )
            if q_created:
                QuotationTier.objects.create(
                    quotation=quote_rej,
                    quantity=part_rej.annual_volume,
                    unit_price=Decimal("2450.00"),
                    gst_amount=Decimal("441.00"),
                    unit_price_with_gst=Decimal("2891.00"),
                    total_value=Decimal("14700000.00"),
                    total_with_gst=Decimal("17346000.00"),
                )
                QuotationApproval.objects.create(
                    quotation=quote_rej,
                    submitted_by=estimator,
                    reviewed_by=sales_head,
                    status=ApprovalStatus.REJECTED,
                    revision_number=1,
                    decision_reason="Gross margin of 6.5% is significantly below target 12%. Heat treatment burden not factored correctly.",
                )

            # Add a Sent Quotation Example for dispatched workflow demonstration
            rfq_sent, _ = RFQ.objects.get_or_create(
                rfq_number="RFQ-2611-005",
                defaults={
                    "customer_name": "Bharat Forge OEM Exports",
                    "industry": "Commercial Vehicles",
                    "status": RFQStatus.SENT,
                    "due_date": date.today() - timedelta(days=2),
                    "delivery_requirements": "CIF Port of Hamburg, Germany",
                    "assigned_estimator": estimator,
                },
            )
            part_sent, _ = Part.objects.get_or_create(
                rfq=rfq_sent,
                part_name="Connecting Rod Cap (Split Forging)",
                defaults={
                    "drawing_number": "DRW-BFE-CR-110",
                    "material_spec": "42CrMo4",
                    "gross_weight_kg": Decimal("1.45"),
                    "annual_volume": 80000,
                    "cycle_time_minutes": Decimal("3.20"),
                    "machine_hourly_rate_inr": Decimal("950.00"),
                },
            )

            quote_sent, qs_created = Quotation.objects.get_or_create(
                quotation_number="QT-2611-005-01",
                defaults={
                    "rfq": rfq_sent,
                    "version": 1,
                    "status": QuotationStatus.APPROVED,
                    "customer_name": rfq_sent.customer_name,
                    "customer_contact": "Mr. Klaus Becker (Sourcing Europe)",
                    "customer_address": "Hafenstrasse 12, 20457 Hamburg, Germany",
                    "part_name": part_sent.part_name,
                    "drawing_number": part_sent.drawing_number,
                    "material_spec": part_sent.material_spec,
                    "gross_weight_kg": part_sent.gross_weight_kg,
                    "annual_volume": part_sent.annual_volume,
                    "unit_price": Decimal("340.00"),
                    "total_annual_value": Decimal("27200000.00"),
                    "requires_approval": True,
                    "delivery_terms": "CIF Hamburg Sea Port",
                    "payment_terms": "Letter of Credit (LC) 60 Days",
                    "validity_days": 45,
                    "created_by": estimator,
                },
            )
            if qs_created:
                QuotationTier.objects.create(
                    quotation=quote_sent,
                    quantity=part_sent.annual_volume,
                    unit_price=Decimal("340.00"),
                    gst_amount=Decimal("61.20"),
                    unit_price_with_gst=Decimal("401.20"),
                    total_value=Decimal("27200000.00"),
                    total_with_gst=Decimal("32096000.00"),
                )
                QuotationApproval.objects.create(
                    quotation=quote_sent,
                    submitted_by=estimator,
                    reviewed_by=sales_head,
                    status=ApprovalStatus.APPROVED,
                    revision_number=1,
                    decision_reason="Export price benchmark approved. Packaging & CIF logistics cost validated.",
                )
                quote_sent.status = QuotationStatus.SENT
                quote_sent.save(update_fields=["status"])
                try:
                    QuotationPDFGenerator.generate_pdf(quote_sent)
                except Exception:
                    pass

        self.stdout.write(self.style.SUCCESS("==> ForgeQuote Unified Master Seed Completed Successfully!"))
