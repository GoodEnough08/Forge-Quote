import os
from decimal import Decimal
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from apps.quotations.models import Quotation


class QuotationPDFGenerator:
    """
    Industrial ReportLab PDF generation service for customer-facing commercial quotations.
    STRICT SECURITY SAFEGUARD:
    Never renders internal material purchase rates, machine hourly rates, cycle times,
    internal margins, scrap costs, or confidential estimator notes.
    """

    COMPANY_INFO = {
        "name": "ForgeQuote Precision Forgings Pvt. Ltd.",
        "address": "Plot No. 42-45, Chakan Industrial Area Phase II, MIDC, Pune - 410501, Maharashtra, India",
        "gstin": "27AABCF1234F1Z8",
        "phone": "+91 2135 667800",
        "email": "commercial@forgequote.in",
        "web": "www.forgequote.in",
    }

    PRIMARY_COLOR = colors.HexColor("#0E141E")  # ForgeQuote Dark Slate
    ACCENT_COLOR = colors.HexColor("#00BD51")   # ForgeQuote Green Accent
    TEXT_COLOR = colors.HexColor("#1E293B")
    MUTED_COLOR = colors.HexColor("#64748B")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    @classmethod
    def generate_pdf(cls, quotation: Quotation) -> str:
        """
        Generates and saves the customer-facing commercial quotation PDF.
        Returns the absolute filepath in private media.
        """
        pdf_dir = settings.PRIVATE_MEDIA_ROOT / "quotation_pdfs"
        pdf_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{quotation.quotation_number}_v{quotation.version}.pdf"
        output_path = pdf_dir / filename

        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=cls.PRIMARY_COLOR,
        )
        company_header = ParagraphStyle(
            "CompanyHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=cls.PRIMARY_COLOR,
        )
        company_sub = ParagraphStyle(
            "CompanySub",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=cls.MUTED_COLOR,
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=cls.PRIMARY_COLOR,
            spaceAfter=4,
        )
        body_bold = ParagraphStyle(
            "BodyBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=cls.TEXT_COLOR,
        )
        body_text = ParagraphStyle(
            "BodyText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=cls.TEXT_COLOR,
        )
        table_cell = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=cls.TEXT_COLOR,
        )
        table_cell_bold = ParagraphStyle(
            "TableCellBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=cls.PRIMARY_COLOR,
        )

        story = []

        # 1. Company Letterhead Header
        header_data = [
            [
                Paragraph(
                    f"<b>{cls.COMPANY_INFO['name']}</b><br/>"
                    f"{cls.COMPANY_INFO['address']}<br/>"
                    f"GSTIN: {cls.COMPANY_INFO['gstin']} • Email: {cls.COMPANY_INFO['email']} • Web: {cls.COMPANY_INFO['web']}",
                    company_sub,
                ),
                Paragraph(
                    f"<b>COMMERCIAL QUOTATION</b><br/>"
                    f"<font color='{cls.ACCENT_COLOR.hexval()}'><b>{quotation.quotation_number}</b></font><br/>"
                    f"<font size='8'>Revision: v{quotation.version} | Date: {quotation.quotation_date}</font>",
                    title_style,
                ),
            ]
        ]
        header_table = Table(header_data, colWidths=[90 * mm, 90 * mm])
        header_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ])
        )
        story.append(header_table)
        story.append(Spacer(1, 4 * mm))
        story.append(HRFlowable(width="100%", thickness=1.5, color=cls.ACCENT_COLOR, spaceAfter=4 * mm))

        # 2. Customer & Quotation Reference Block
        latest_approval = quotation.approvals.filter(status="Approved").order_by("-reviewed_at").first()
        approved_by_name = latest_approval.reviewed_by.full_name if latest_approval and latest_approval.reviewed_by else "Authorized Commercial Representative"

        cust_info = [
            [
                Paragraph("<b>PREPARED FOR (BUYER):</b>", section_heading),
                Paragraph("<b>QUOTATION DETAILS:</b>", section_heading),
            ],
            [
                Paragraph(
                    f"<b>{quotation.customer_name}</b><br/>"
                    f"{quotation.customer_contact or 'Purchasing & Sourcing Department'}<br/>"
                    f"{quotation.customer_address or 'Customer Manufacturing Plant / Delivery Works'}",
                    body_text,
                ),
                Paragraph(
                    f"<b>Quotation Reference:</b> {quotation.quotation_number}<br/>"
                    f"<b>RFQ Enquiry No:</b> {quotation.rfq.rfq_number}<br/>"
                    f"<b>Quotation Date:</b> {quotation.quotation_date}<br/>"
                    f"<b>Offer Validity:</b> {quotation.validity_days} Days<br/>"
                    f"<b>Commercial Status:</b> <font color='{cls.ACCENT_COLOR.hexval()}'><b>{quotation.status}</b></font>",
                    body_text,
                ),
            ],
        ]
        cust_table = Table(cust_info, colWidths=[90 * mm, 90 * mm])
        cust_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 1), (-1, -1), cls.BG_LIGHT),
                ("BOX", (0, 1), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 1), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("TOPPADDING", (0, 1), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3 * mm),
                ("LEFTPADDING", (0, 1), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 1), (-1, -1), 3 * mm),
            ])
        )
        story.append(cust_table)
        story.append(Spacer(1, 4 * mm))

        # 3. Component Engineering Specification
        story.append(Paragraph("<b>COMPONENT SPECIFICATION:</b>", section_heading))
        spec_data = [
            [
                Paragraph("<b>Part Description</b>", body_bold),
                Paragraph("<b>Drawing No.</b>", body_bold),
                Paragraph("<b>Material Grade</b>", body_bold),
                Paragraph("<b>Gross Weight (kg)</b>", body_bold),
                Paragraph("<b>Annual Program Volume</b>", body_bold),
            ],
            [
                Paragraph(quotation.part_name, table_cell_bold),
                Paragraph(quotation.drawing_number, table_cell),
                Paragraph(quotation.material_spec, table_cell_bold),
                Paragraph(f"{float(quotation.gross_weight_kg):.3f} kg", table_cell),
                Paragraph(f"{quotation.annual_volume:,} pcs / year", table_cell),
            ],
        ]
        spec_table = Table(spec_data, colWidths=[45 * mm, 35 * mm, 35 * mm, 30 * mm, 35 * mm])
        spec_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ])
        )
        # Fix header text colors
        for i in range(len(spec_data[0])):
            spec_data[0][i].style.textColor = colors.white
        story.append(spec_table)
        story.append(Spacer(1, 4 * mm))

        # 4. Commercial Pricing & Quantity Volume Tiers Table
        story.append(Paragraph("<b>COMMERCIAL PRICING BREAKDOWN (INR / EX-WORKS):</b>", section_heading))
        price_header = [
            Paragraph("<b>Volume Tier (Quantity)</b>", body_bold),
            Paragraph("<b>Base Unit Price</b>", body_bold),
            Paragraph("<b>GST (18%)</b>", body_bold),
            Paragraph("<b>Quotation Price / Unit</b>", body_bold),
            Paragraph("<b>Total Order Value</b>", body_bold),
        ]
        price_rows = [price_header]

        tiers = quotation.tiers.all().order_by("quantity")
        if tiers.exists():
            for t in tiers:
                price_rows.append([
                    Paragraph(f"<b>{t.quantity:,} pcs</b>", table_cell),
                    Paragraph(f"INR {float(t.unit_price):,.2f}", table_cell),
                    Paragraph(f"INR {float(t.gst_amount):,.2f}", table_cell),
                    Paragraph(f"<b>INR {float(t.unit_price_with_gst):,.2f}</b>", table_cell_bold),
                    Paragraph(f"<b>INR {float(t.total_with_gst):,.2f}</b>", table_cell_bold),
                ])
        else:
            # Fallback to annual volume baseline
            unit_p = float(quotation.unit_price)
            gst_val = round(unit_p * 0.18, 2)
            total_unit = round(unit_p + gst_val, 2)
            total_order = round(total_unit * quotation.annual_volume, 2)
            price_rows.append([
                Paragraph(f"<b>{quotation.annual_volume:,} pcs (Base)</b>", table_cell),
                Paragraph(f"INR {unit_p:,.2f}", table_cell),
                Paragraph(f"INR {gst_val:,.2f}", table_cell),
                Paragraph(f"<b>INR {total_unit:,.2f}</b>", table_cell_bold),
                Paragraph(f"<b>INR {total_order:,.2f}</b>", table_cell_bold),
            ])

        for p_elem in price_header:
            p_elem.style.textColor = colors.white

        pricing_table = Table(price_rows, colWidths=[42 * mm, 32 * mm, 30 * mm, 36 * mm, 40 * mm])
        pricing_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), cls.PRIMARY_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ])
        )
        story.append(pricing_table)
        story.append(Spacer(1, 4 * mm))

        # 5. Commercial Terms & Conditions
        story.append(Paragraph("<b>COMMERCIAL TERMS & CONDITIONS:</b>", section_heading))
        terms_data = [
            [
                Paragraph("<b>Delivery Terms:</b>", body_bold),
                Paragraph(quotation.delivery_terms, table_cell),
            ],
            [
                Paragraph("<b>Payment Terms:</b>", body_bold),
                Paragraph(quotation.payment_terms, table_cell),
            ],
            [
                Paragraph("<b>Applicable Taxes:</b>", body_bold),
                Paragraph("GST @ 18% extra as applicable at time of dispatch (HSN Code 7326 / 8708).", table_cell),
            ],
            [
                Paragraph("<b>Packaging:</b>", body_bold),
                Paragraph("VCI rust-preventive bags with heavy-duty export corrugated cartons and wooden pallets.", table_cell),
            ],
            [
                Paragraph("<b>Quality & Testing:</b>", body_bold),
                Paragraph("100% Dimensional CMM & Ultrasonic test certification provided with each shipment batch.", table_cell),
            ],
            [
                Paragraph("<b>Validity:</b>", body_bold),
                Paragraph(f"Valid for {quotation.validity_days} days from date of quotation issuance.", table_cell),
            ],
        ]
        terms_table = Table(terms_data, colWidths=[40 * mm, 140 * mm])
        terms_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), cls.BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, cls.BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ])
        )
        story.append(terms_table)
        story.append(Spacer(1, 5 * mm))

        # 6. Authorized Signatures Block
        sign_data = [
            [
                Paragraph(
                    "<b>PREPARED BY:</b><br/>"
                    f"Cost Estimating Division<br/>"
                    f"ForgeQuote Operations<br/>"
                    f"Date: {quotation.quotation_date}",
                    body_text,
                ),
                Paragraph(
                    "<b>AUTHORIZED COMMERCIAL APPROVAL:</b><br/>"
                    f"<font color='{cls.ACCENT_COLOR.hexval()}'><b>[DIGITALLY VERIFIED]</b></font><br/>"
                    f"<b>{approved_by_name}</b><br/>"
                    f"Sales & Commercial Head<br/>"
                    f"ForgeQuote Precision Forgings Pvt. Ltd.",
                    body_text,
                ),
            ]
        ]
        sign_table = Table(sign_data, colWidths=[90 * mm, 90 * mm])
        sign_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEABOVE", (0, 0), (-1, 0), 1, cls.PRIMARY_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
            ])
        )
        story.append(KeepTogether(sign_table))

        # Build Document
        doc.build(story)

        # Update Quotation model with stored filepath
        quotation.pdf_file_path = str(output_path)
        quotation.pdf_generated_at = timezone.now()
        quotation.save(update_fields=["pdf_file_path", "pdf_generated_at"])

        return str(output_path)
