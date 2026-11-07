import io
import re
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Any, Optional
import pandas as pd

try:
    import fitz  # PyMuPDF
except ImportError:
    import pymupdf as fitz


class DocumentParserError(Exception):
    pass


class PDFParser:
    """
    Extracts text and page-indexed snippets from RFQ and drawing PDFs using PyMuPDF.
    Guarantees no CAD hallucination — only extracts readable text layers and metadata.
    """

    @classmethod
    def extract_text_pages(cls, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as ex:
            raise DocumentParserError(f"Corrupt or invalid PDF file: {str(ex)}")

        pages_data = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text() or ""
            pages_data.append(
                {
                    "page_number": page_num + 1,
                    "document_name": filename,
                    "text": text.strip(),
                    "char_count": len(text),
                }
            )
        doc.close()
        return pages_data

    @classmethod
    def extract_candidate_fields(cls, pages_data: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Scans PDF pages using robust pattern heuristics for RFQ header fields.
        Preserves page provenance and the matching snippet.
        """
        candidates: Dict[str, Dict[str, Any]] = {}

        patterns = [
            (
                "customer_name",
                "Customer Name",
                r"(?:Customer|Client|Buyer|Company|To)\s*[:\-]\s*([A-Za-z0-9\s.,&'-]{3,60})",
                0.90,
            ),
            (
                "rfq_number",
                "RFQ Number",
                r"(?:RFQ\s*(?:No\.?|Number|#)?|Enquiry\s*(?:No\.?|#)?|Tender\s*(?:No\.?|#)?)\s*[:\-]?\s*([A-Z0-9\-_/]{4,30})",
                0.95,
            ),
            (
                "part_name",
                "Part Name",
                r"(?:Part\s*(?:Name|Description)?|Component|Description|Item)\s*[:\-]\s*([A-Za-z0-9\s()/\-.,']{3,60})",
                0.88,
            ),
            (
                "drawing_number",
                "Drawing Number",
                r"(?:Drawing\s*(?:No\.?|Number|#)?|DWG\s*(?:No\.?|#)?|Drg\s*(?:No\.?|#)?)\s*[:\-]\s*([A-Z0-9\-_./]{3,40})",
                0.92,
            ),
            (
                "material_spec",
                "Material Grade",
                r"(?:Material\s*(?:Spec|Grade)?|Grade|Steel\s*Spec)\s*[:\-]\s*([A-Za-z0-9\-_+]{2,30})",
                0.90,
            ),
            (
                "gross_weight_kg",
                "Gross Weight (kg)",
                r"(?:Gross\s*Weight|Billet\s*Weight|Forging\s*Weight|Weight)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kgs|kilograms)?",
                0.87,
            ),
            (
                "annual_volume",
                "Annual Volume (pcs)",
                r"(?:Annual\s*Volume|Volume|Annual\s*Quantity|Quantity|Estimated\s*Annual\s*Qty|EAU)\s*[:\-]?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\s*(?:pcs|pieces|units|nos)?",
                0.89,
            ),
            (
                "due_date",
                "Target Due Date",
                r"(?:Due\s*Date|Quote\s*Due|Closing\s*Date|Deadline|Submission\s*Date)\s*[:\-]\s*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})",
                0.91,
            ),
            (
                "delivery_requirements",
                "Delivery Terms",
                r"(?:Delivery\s*(?:Terms|Requirements)?|Incoterms?|Shipping)\s*[:\-]\s*([A-Za-z0-9\s\-.,]{3,50})",
                0.82,
            ),
        ]

        # Scan text line by line across all pages
        for page in pages_data:
            text = page["text"]
            lines = text.split("\n")
            doc_name = page["document_name"]
            page_num = page["page_number"]

            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue

                for key, label, regex, default_conf in patterns:
                    if key in candidates:
                        continue  # Keep the first strong match

                    match = re.search(regex, line_str, re.IGNORECASE)
                    if match:
                        val = match.group(1).strip()
                        # Sanitize extracted values
                        if key == "gross_weight_kg":
                            try:
                                Decimal(val)
                            except InvalidOperation:
                                continue
                        elif key == "annual_volume":
                            val = val.replace(",", "")
                            if not val.isdigit():
                                continue

                        candidates[key] = {
                            "field_key": key,
                            "field_label": label,
                            "suggested_value": val,
                            "confidence_score": Decimal(str(default_conf)),
                            "source_document_name": doc_name,
                            "source_page_or_row": f"Page {page_num}",
                            "source_snippet": line_str[:250],
                        }

        # Material fallback scanning if not explicitly labeled with "Material:"
        if "material_spec" not in candidates:
            known_materials = [
                "EN8", "EN9", "EN19", "EN24", "EN31",
                "20MnCr5", "16MnCr5", "40Cr4", "42CrMo4",
                "SAE 1045", "AISI 1045", "SAE 8620", "8620H",
                "C45", "15B25", "20MnCrS5"
            ]
            for page in pages_data:
                for line in page["text"].split("\n"):
                    for mat in known_materials:
                        if re.search(r"\b" + re.escape(mat) + r"\b", line, re.IGNORECASE):
                            candidates["material_spec"] = {
                                "field_key": "material_spec",
                                "field_label": "Material Grade",
                                "suggested_value": mat,
                                "confidence_score": Decimal("0.84"),
                                "source_document_name": page["document_name"],
                                "source_page_or_row": f"Page {page['page_number']}",
                                "source_snippet": line.strip()[:250],
                            }
                            break
                    if "material_spec" in candidates:
                        break
                if "material_spec" in candidates:
                    break

        return candidates


class ExcelParser:
    """
    Parses Excel part lists (.xlsx/.xls) using pandas and openpyxl.
    Handles column mapping, previews, data validation, and reports invalid rows.
    """

    COLUMN_SYNONYMS = {
        "part_name": ["part name", "part description", "description", "component", "part"],
        "drawing_number": ["drawing no", "drawing number", "dwg no", "drg no", "drawing"],
        "material_spec": ["material", "material grade", "grade", "spec", "material spec"],
        "gross_weight_kg": ["gross weight (kg)", "gross weight", "weight (kg)", "weight", "billet wt"],
        "annual_volume": ["annual volume", "volume", "quantity", "annual qty", "eau", "qty"],
        "customer_name": ["customer", "client", "buyer"],
        "cycle_time_minutes": ["cycle time", "cycle time (min)", "machining time"],
        "machine_hourly_rate_inr": ["machine rate", "hourly rate", "rate/hr"],
    }

    @classmethod
    def parse_excel_parts(cls, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as ex:
            raise DocumentParserError(f"Could not read Excel file: {str(ex)}")

        original_columns = [str(c).strip() for c in df.columns]
        normalized_map = {}

        for col in original_columns:
            low = col.lower().strip()
            for field_key, synonyms in cls.COLUMN_SYNONYMS.items():
                if field_key not in normalized_map:
                    if low in synonyms or any(syn in low for syn in synonyms):
                        normalized_map[field_key] = col
                        break

        valid_rows: List[Dict[str, Any]] = []
        invalid_rows: List[Dict[str, Any]] = []

        for idx, row in df.iterrows():
            row_num = idx + 2  # Excel row index
            errors = []

            # Extract part name
            part_name_col = normalized_map.get("part_name")
            part_name = str(row.get(part_name_col, "")).strip() if part_name_col else ""
            if not part_name or part_name.lower() in ["nan", "none"]:
                errors.append("Missing Part Name")

            # Extract material
            mat_col = normalized_map.get("material_spec")
            material = str(row.get(mat_col, "EN8")).strip() if mat_col else "EN8"
            if material.lower() in ["nan", "none"]:
                material = "EN8"

            # Extract gross weight
            weight_col = normalized_map.get("gross_weight_kg")
            gross_weight = None
            if weight_col:
                raw_w = row.get(weight_col)
                try:
                    if pd.notna(raw_w):
                        gross_weight = Decimal(str(raw_w))
                        if gross_weight <= Decimal("0.000"):
                            errors.append("Gross weight must be positive")
                except (InvalidOperation, ValueError):
                    errors.append(f"Invalid gross weight value '{raw_w}'")
            else:
                errors.append("Missing Gross Weight column")

            # Extract annual volume
            vol_col = normalized_map.get("annual_volume")
            volume = None
            if vol_col:
                raw_v = row.get(vol_col)
                try:
                    if pd.notna(raw_v):
                        volume = int(float(str(raw_v)))
                        if volume <= 0:
                            errors.append("Annual volume must be positive integer")
                except (ValueError, TypeError):
                    errors.append(f"Invalid volume value '{raw_v}'")
            else:
                errors.append("Missing Annual Volume column")

            drawing_col = normalized_map.get("drawing_number")
            drawing_no = str(row.get(drawing_col, f"DRW-ROW-{row_num}")).strip() if drawing_col else f"DRW-ROW-{row_num}"
            if drawing_no.lower() in ["nan", "none"]:
                drawing_no = f"DRW-ROW-{row_num}"

            customer_col = normalized_map.get("customer_name")
            customer = str(row.get(customer_col, "")).strip() if customer_col else ""
            if customer.lower() in ["nan", "none"]:
                customer = ""

            row_data = {
                "row_number": row_num,
                "part_name": part_name,
                "drawing_number": drawing_no,
                "material_spec": material,
                "gross_weight_kg": float(gross_weight) if gross_weight else None,
                "annual_volume": volume,
                "customer_name": customer,
                "document_name": filename,
            }

            if errors:
                row_data["errors"] = errors
                invalid_rows.append(row_data)
            else:
                valid_rows.append(row_data)

        return {
            "document_name": filename,
            "total_rows": len(df),
            "columns_found": original_columns,
            "mapped_columns": normalized_map,
            "valid_rows": valid_rows,
            "invalid_rows": invalid_rows,
        }


class EmailTextParser:
    """
    Parses RFQ tenders received via email text or plain text tender notes.
    """

    @classmethod
    def parse_text(cls, raw_text: str, filename: str = "Email_Intake.txt") -> Dict[str, Dict[str, Any]]:
        pseudo_page = [{
            "page_number": 1,
            "document_name": filename,
            "text": raw_text,
            "char_count": len(raw_text),
        }]
        return PDFParser.extract_candidate_fields(pseudo_page)

