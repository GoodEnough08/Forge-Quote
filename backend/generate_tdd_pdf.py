import os
import re
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def format_md_text(text: str) -> str:
    # Convert bold **text** to <b>text</b>
    t = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    # Convert code `text` to font Courier
    t = re.sub(r"`(.*?)`", r"<font face='Courier'>\1</font>", t)
    # Convert common unicode and math symbols for ReportLab
    t = t.replace("→", "&rarr;").replace("₹", "INR ").replace("•", "&bull;")
    t = t.replace("<=", "&le;").replace(">=", "&ge;")
    t = t.replace("$$", "").replace("$", "")
    # Clean any unclosed or unbalanced tags
    t = t.replace("&", "&amp;").replace("&amp;rarr;", "&rarr;").replace("&amp;bull;", "&bull;").replace("&amp;le;", "&le;").replace("&amp;ge;", "&ge;")
    return t


def generate_tdd_pdf(md_path: Path, output_pdf_path: Path):
    doc = SimpleDocTemplate(
        str(output_pdf_path),
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "TDDTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#172B4D"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "TDDSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#64748B"),
        spaceAfter=10,
    )
    h1_style = ParagraphStyle(
        "TDDH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#172B4D"),
        spaceBefore=12,
        spaceAfter=5,
        keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        "TDDH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#007A3D"),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "TDDBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
        spaceAfter=4,
    )
    bullet_style = ParagraphStyle(
        "TDDBullet",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2.5,
    )
    table_cell_style = ParagraphStyle(
        "TDDCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
    )
    table_cell_bold = ParagraphStyle(
        "TDDCellBold",
        parent=table_cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#172B4D"),
    )

    story = []

    # Title block
    story.append(Paragraph("ForgeQuote — Technical Design Document (TDD)", title_style))
    story.append(
        Paragraph(
            "<b>Precision Costing &amp; RFQ Lifecycle System for Industrial Forging</b> &bull; Phase 5 Final Release &bull; Version 1.0.0",
            subtitle_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#00EA64"), spaceAfter=10))

    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    in_table = False
    table_data = []

    for line in lines:
        raw = line.strip()

        # Check for markdown table
        if raw.startswith("|") and raw.endswith("|"):
            cells = [c.strip() for c in raw.split("|")[1:-1]]
            # Skip separator line like | :--- | :--- |
            if any(c.startswith("---") or c.startswith(":---") for c in cells):
                continue
            is_header = not in_table
            in_table = True
            row_cells = []
            for cell in cells:
                c_text = format_md_text(cell)
                row_cells.append(Paragraph(c_text, table_cell_bold if is_header else table_cell_style))
            table_data.append(row_cells)
            continue
        elif in_table:
            # End of table
            in_table = False
            if table_data:
                col_count = len(table_data[0])
                total_w = 180 * mm
                c_width = total_w / col_count
                t = Table(table_data, colWidths=[c_width] * col_count)
                t.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                            ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ]
                    )
                )
                story.append(t)
                story.append(Spacer(1, 6))
                table_data = []

        if not raw:
            continue

        # Skip main document header lines handled above
        if raw.startswith("# ForgeQuote — Technical Design Document"):
            continue
        if raw.startswith("**Project Title**") or raw.startswith("**Document Version**"):
            continue

        # Headings
        if raw.startswith("## "):
            h_text = raw[3:].strip()
            h_text = format_md_text(h_text)
            story.append(Paragraph(h_text, h1_style))
            continue
        elif raw.startswith("### "):
            h_text = raw[4:].strip()
            h_text = format_md_text(h_text)
            story.append(Paragraph(h_text, h2_style))
            continue

        # Bullets
        if raw.startswith("* ") or raw.startswith("- "):
            b_text = raw[2:].strip()
            b_text = format_md_text(b_text)
            story.append(Paragraph(f"&bull; {b_text}", bullet_style))
            continue

        # Numbered list
        if re.match(r"^\d+\.\s", raw):
            match = re.match(r"^(\d+\.)\s+(.*)", raw)
            if match:
                num, n_text = match.groups()
                n_text = format_md_text(n_text)
                story.append(Paragraph(f"{num} {n_text}", bullet_style))
                continue

        # Code blocks or diagram skips
        if raw.startswith("```"):
            continue

        # Standard prose
        p_text = format_md_text(raw)
        story.append(Paragraph(p_text, body_style))

    # Flush any remaining table
    if in_table and table_data:
        col_count = len(table_data[0])
        total_w = 180 * mm
        c_width = total_w / col_count
        t = Table(table_data, colWidths=[c_width] * col_count)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(t)

    # Build document
    doc.build(story)
    print(f"Generated {output_pdf_path} ({os.path.getsize(output_pdf_path)} bytes)")


if __name__ == "__main__":
    base = Path(__file__).resolve().parent.parent
    md_file = base / "TDD.md"
    pdf_file = base / "TDD.pdf"
    generate_tdd_pdf(md_file, pdf_file)
