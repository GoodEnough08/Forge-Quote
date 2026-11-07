export type UserRole = "ESTIMATOR" | "SALES_HEAD";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export type RFQStatus =
  | "New"
  | "Estimating"
  | "Awaiting Approval"
  | "Approved"
  | "Sent"
  | "Won"
  | "Lost";

export interface Part {
  id: number;
  rfq_id: number;
  part_name: string;
  drawing_number: string;
  material_spec: string;
  gross_weight_kg: string | number;
  annual_volume: number;
  cycle_time_minutes: string | number;
  machine_hourly_rate_inr: string | number;
  process_type: string;
}

export interface RFQ {
  id: number;
  rfq_number: string;
  customer_name: string;
  industry: string;
  delivery_requirements?: string;
  status: RFQStatus;
  due_date: string;
  assigned_estimator_id?: number;
  assigned_estimator_name?: string;
  notes?: string;
  is_demo_seed: boolean;
  created_at: string;
  updated_at: string;
  parts: Part[];
}

export interface RFQListResponse {
  items: RFQ[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardSummary {
  total_rfqs: number;
  awaiting_estimation: number;
  awaiting_approval: number;
  quotations_sent: number;
  won_count: number;
  lost_count: number;
  overdue_count: number;
  upcoming_rfqs: RFQ[];
}

// --- PHASE 2 TYPES ---

export interface MaterialRate {
  id: number;
  material_name: string;
  material_grade: string;
  rate_per_kg: string | number;
  density_g_cm3: string | number;
  effective_from: string;
  effective_until?: string | null;
  is_active: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface MachineRate {
  id: number;
  machine_name: string;
  work_center: string;
  hourly_rate: string | number;
  effective_from: string;
  effective_until?: string | null;
  is_active: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CostingOperationInput {
  operation_name: string;
  work_center: string;
  cycle_time_minutes: string | number;
  machine_hourly_rate: string | number;
  machine_rate_id?: number | null;
}

export interface CostingOperationResult {
  operation_name: string;
  work_center: string;
  cycle_time_minutes: string;
  machine_hourly_rate: string;
  processing_cost: string;
}

export interface CostingVolumeTier {
  quantity: number;
  manufacturing_cost_per_unit: string;
  margin_percentage: string;
  margin_per_unit: string;
  quotation_price_per_unit: string;
  gst_per_unit: string;
  price_with_gst_per_unit: string;
  total_quotation_value: string;
  total_gst: string;
  grand_total_with_gst: string;
}

export interface CostingCalculationResponse {
  gross_weight_kg: string;
  material_rate_per_kg: string;
  scrap_percentage: string;
  material_cost: string;
  operations: CostingOperationResult[];
  total_processing_cost: string;
  labour_cost: string;
  overhead_cost: string;
  freight_cost: string;
  other_cost: string;
  manufacturing_subtotal: string;
  margin_percentage: string;
  margin_amount: string;
  final_price_per_unit: string;
  gst_percentage: string;
  gst_amount: string;
  total_price_with_gst_per_unit: string;
  volume_tiers: CostingVolumeTier[];
}

export interface CostingSheetData {
  id: number;
  part_id: number;
  part_name: string;
  drawing_number: string;
  rfq_number: string;
  customer_name: string;
  costing_date: string;
  status: string;
  material_grade_snapshot: string;
  material_rate_per_kg_snapshot: string;
  gross_weight_kg: string;
  scrap_percentage: string;
  material_cost: string;
  labour_cost: string;
  overhead_cost: string;
  freight_cost: string;
  other_cost: string;
  total_processing_cost: string;
  manufacturing_subtotal: string;
  margin_percentage: string;
  margin_amount: string;
  final_price_per_unit: string;
  gst_percentage: string;
  gst_amount: string;
  total_price_with_gst: string;
  operations: {
    id: number;
    operation_name: string;
    work_center: string;
    cycle_time_minutes: string;
    machine_hourly_rate_snapshot: string;
    processing_cost: string;
    sequence: number;
  }[];
  volume_tiers: CostingVolumeTier[];
  created_at: string;
  updated_at: string;
}

// --- PHASE 3 TYPES ---

export type IntakeStatus =
  | "UPLOADED"
  | "EXTRACTING"
  | "REVIEW_READY"
  | "COMMITTED"
  | "FAILED";

export type IntakeDocType =
  | "PDF_RFQ"
  | "PDF_DRAWING"
  | "EXCEL_PART_LIST"
  | "EMAIL_TEXT";

export type FieldStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EDITED"
  | "REJECTED";

export interface IntakeDocument {
  id: number;
  file_name: string;
  file_type: IntakeDocType;
  file_size_bytes: number;
  page_count: number;
  uploaded_at: string;
}

export interface ExtractedField {
  id: number;
  field_key: string;
  field_label: string;
  suggested_value: string;
  confirmed_value: string | null;
  confidence_score: number | string;
  source_document_name: string;
  source_page_or_row: string;
  source_snippet: string;
  status: FieldStatus;
  is_confirmed: boolean;
}

export interface SuggestedRouting {
  id: number;
  sequence: number;
  operation_name: string;
  work_center: string;
  cycle_time_minutes: number;
  machine_hourly_rate: number;
  matched_historical_part_name?: string;
  recommendation_reason?: string;
  is_accepted: boolean;
}

export interface IntakeSession {
  id: number;
  title: string;
  status: IntakeStatus;
  rfq?: number | null;
  rfq_number?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
  documents?: IntakeDocument[];
  extracted_fields?: ExtractedField[];
  suggested_routings?: SuggestedRouting[];
  documents_count?: number;
}

export interface HistoricalQuotationOperation {
  id?: number;
  sequence: number;
  operation_name: string;
  work_center: string;
  cycle_time_minutes: number;
  machine_hourly_rate: number;
  processing_cost: number;
}

export interface HistoricalQuotation {
  id: number;
  quote_number: string;
  rfq_reference: string;
  customer_name: string;
  part_name: string;
  drawing_number: string;
  material_grade: string;
  gross_weight_kg: number;
  annual_volume: number;
  quoted_date: string;
  status: "Won" | "Lost" | "Expired" | "Quoted";
  material_rate_per_kg: number;
  material_cost: number;
  processing_cost: number;
  labour_cost: number;
  overhead_cost: number;
  freight_cost: number;
  margin_percentage: number;
  final_price_per_unit: number;
  total_quotation_value: number;
  notes: string;
  operations: HistoricalQuotationOperation[];
  similarity_score?: number;
  similarity_reasons?: string[];
  created_at?: string;
  is_locked?: boolean;
}

export interface HistoricalQuoteComparison {
  quote_a: HistoricalQuotation;
  quote_b: HistoricalQuotation;
  variances: {
    unit_price_delta: number;
    unit_price_pct_change: number;
    weight_delta_kg: number;
    material_rate_delta_per_kg: number;
    customer_match: boolean;
    material_match: boolean;
  };
}
