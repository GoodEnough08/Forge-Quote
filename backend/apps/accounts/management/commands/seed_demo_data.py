from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User, UserRole
from apps.rfqs.models import RFQ, Part, RFQStatus
from apps.rate_masters.models import MaterialRate, MachineRate


def run_seed() -> None:
    with transaction.atomic():
        estimator, created = User.objects.get_or_create(
            email="estimator@forgequote.in",
            defaults={
                "full_name": "Arjun Mehta (Sr. Estimator)",
                "role": UserRole.ESTIMATOR,
                "is_active": True,
            },
        )
        if created:
            estimator.set_password("Estimator@123")
            estimator.save()

        sales_head, created = User.objects.get_or_create(
            email="saleshead@forgequote.in",
            defaults={
                "full_name": "Vikram Rathore (VP Sales & Commercial)",
                "role": UserRole.SALES_HEAD,
                "is_active": True,
            },
        )
        if created:
            sales_head.set_password("SalesHead@123")
            sales_head.save()

        today = date.today()

        # Seed Illustrative Material Rates (Clearly labeled illustrative industrial rates)
        material_seeds = [
            {
                "material_name": "Carbon Steel Forging Bar",
                "material_grade": "EN8",
                "rate_per_kg": Decimal("72.50"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "material_name": "Alloy Structural Steel",
                "material_grade": "40Cr4 forging",
                "rate_per_kg": Decimal("86.00"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "material_name": "Case Hardening Steel",
                "material_grade": "20MnCr5",
                "rate_per_kg": Decimal("94.50"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "material_name": "High Tensile Alloy Steel",
                "material_grade": "42CrMo4",
                "rate_per_kg": Decimal("112.00"),
                "effective_from": today - timedelta(days=90),
                "effective_until": None,
                "is_active": True,
            },
        ]

        for m in material_seeds:
            if not MaterialRate.objects.filter(material_grade__iexact=m["material_grade"]).exists():
                MaterialRate.objects.create(created_by=estimator, **m)

        # Seed Illustrative Machine / Work Center Rates
        machine_seeds = [
            {
                "machine_name": "CNC Turning Center 1 (Mazak)",
                "work_center": "CNC Turning",
                "hourly_rate": Decimal("850.00"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "machine_name": "VMC Heavy Milling (Doosan)",
                "work_center": "VMC Milling",
                "hourly_rate": Decimal("1450.00"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "machine_name": "Closed Die Hammer (2.5 Ton)",
                "work_center": "Hot Forging",
                "hourly_rate": Decimal("1650.00"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "machine_name": "Centerless Grinder Line",
                "work_center": "Grinding",
                "hourly_rate": Decimal("650.00"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
            {
                "machine_name": "Induction Hardening Cell",
                "work_center": "Heat Treatment",
                "hourly_rate": Decimal("950.00"),
                "effective_from": today - timedelta(days=60),
                "effective_until": None,
                "is_active": True,
            },
        ]

        for mach in machine_seeds:
            if not MachineRate.objects.filter(machine_name__iexact=mach["machine_name"]).exists():
                MachineRate.objects.create(created_by=estimator, **mach)

        if RFQ.objects.exists():
            return

        seed_rfqs = [
            {
                "rfq_number": "RFQ-2611-014",
                "customer_name": "Company B",
                "industry": "Two-wheelers",
                "delivery_requirements": "FOB Pune Plant, kanban lot deliveries weekly",
                "status": RFQStatus.ESTIMATING,
                "due_date": today + timedelta(days=3),
                "notes": "Demo seeded RFQ. High-volume spindle requiring induction hardening + centerless grinding.",
                "part": {
                    "part_name": "Rear wheel spindle",
                    "drawing_number": "DRW-2W-8841-REV-C",
                    "material_spec": "EN8",
                    "gross_weight_kg": Decimal("0.610"),
                    "annual_volume": 180000,
                    "cycle_time_minutes": Decimal("3.20"),
                    "machine_hourly_rate_inr": Decimal("850.00"),
                    "process_type": "Cold Forging + CNC Turning + Grinding",
                },
            },
            {
                "rfq_number": "RFQ-2611-019",
                "customer_name": "Company C",
                "industry": "Tractors",
                "delivery_requirements": "Ex-Works Chakan, 100% MPI crack detection required",
                "status": RFQStatus.AWAITING_APPROVAL,
                "due_date": today + timedelta(days=2),
                "notes": "Demo seeded RFQ. Heavy closed-die forging; annual value exceeds ₹25L threshold.",
                "part": {
                    "part_name": "Hydraulic lift arm",
                    "drawing_number": "DRW-TR-4092-REV-A",
                    "material_spec": "40Cr4 forging",
                    "gross_weight_kg": Decimal("4.600"),
                    "annual_volume": 24000,
                    "cycle_time_minutes": Decimal("11.50"),
                    "machine_hourly_rate_inr": Decimal("1450.00"),
                    "process_type": "Hot Forging + VMC Milling + Broaching",
                },
            },
            {
                "rfq_number": "RFQ-2611-023",
                "customer_name": "Company D",
                "industry": "Drivetrains",
                "delivery_requirements": "CIF Chennai, rust-preventive VCI packaging",
                "status": RFQStatus.NEW,
                "due_date": today + timedelta(days=5),
                "notes": "Demo seeded RFQ. Case-hardening steel gear blank with tight runout tolerance.",
                "part": {
                    "part_name": "Gear blank",
                    "drawing_number": "DRW-DT-7120-REV-B",
                    "material_spec": "20MnCr5",
                    "gross_weight_kg": Decimal("1.480"),
                    "annual_volume": 60000,
                    "cycle_time_minutes": Decimal("4.80"),
                    "machine_hourly_rate_inr": Decimal("950.00"),
                    "process_type": "Upset Forging + Iso-Annealing + CNC Turning",
                },
            },
        ]

        for item in seed_rfqs:
            rfq = RFQ.objects.create(
                rfq_number=item["rfq_number"],
                customer_name=item["customer_name"],
                industry=item["industry"],
                delivery_requirements=item["delivery_requirements"],
                status=item["status"],
                due_date=item["due_date"],
                assigned_estimator=estimator,
                notes=item["notes"],
                is_demo_seed=True,
            )
            Part.objects.create(rfq=rfq, **item["part"])


class Command(BaseCommand):
    help = "Seeds ForgeQuote demo accounts (Estimator & Sales Head), versioned rate masters, and sample RFQs."

    def handle(self, *args, **options):
        run_seed()
        self.stdout.write(self.style.SUCCESS("Successfully seeded ForgeQuote demo users, rate masters, and RFQs."))
