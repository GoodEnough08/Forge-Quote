import axios from "axios";
import {
  MaterialRate,
  MachineRate,
  CostingCalculationResponse,
  CostingSheetData,
  IntakeSession,
  IntakeDocument,
  ExtractedField,
  SuggestedRouting,
  HistoricalQuotation,
  HistoricalQuoteComparison,
  QuotationData,
  QuotationApprovalItem,
  ApprovalDetailPayload,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("fq_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Phase 2 Rate Masters API
export const ratesApi = {
  getMaterials: async (grade?: string): Promise<MaterialRate[]> => {
    const params = grade ? { grade } : {};
    const res = await api.get<MaterialRate[]>("/rates/materials", { params });
    return res.data;
  },
  createMaterial: async (data: Partial<MaterialRate>): Promise<MaterialRate> => {
    const res = await api.post<MaterialRate>("/rates/materials", data);
    return res.data;
  },
  getMachines: async (work_center?: string): Promise<MachineRate[]> => {
    const params = work_center ? { work_center } : {};
    const res = await api.get<MachineRate[]>("/rates/machines", { params });
    return res.data;
  },
  createMachine: async (data: Partial<MachineRate>): Promise<MachineRate> => {
    const res = await api.post<MachineRate>("/rates/machines", data);
    return res.data;
  },
  lookup: async (grade?: string, work_center?: string, date?: string) => {
    const res = await api.get("/rates/lookup", { params: { grade, work_center, date } });
    return res.data;
  },
};

// Phase 2 Costing Engine API
export const costingApi = {
  calculate: async (payload: any): Promise<CostingCalculationResponse> => {
    const res = await api.post<CostingCalculationResponse>("/costing/calculate", payload);
    return res.data;
  },
  saveDraft: async (payload: any): Promise<CostingSheetData> => {
    const res = await api.post<CostingSheetData>("/costing/draft", payload);
    return res.data;
  },
  getByRfq: async (rfqId: number | string) => {
    const res = await api.get(`/costing/rfq/${rfqId}`);
    return res.data;
  },
};

// Phase 3 AI-Assisted RFQ Intake API
export const intakeApi = {
  listSessions: async (): Promise<IntakeSession[]> => {
    const res = await api.get<IntakeSession[]>("/intake/sessions");
    return res.data;
  },
  createSession: async (payload: { title?: string; notes?: string }): Promise<IntakeSession> => {
    const res = await api.post<IntakeSession>("/intake/sessions", payload);
    return res.data;
  },
  getSession: async (sessionId: number): Promise<IntakeSession> => {
    const res = await api.get<IntakeSession>(`/intake/sessions/${sessionId}`);
    return res.data;
  },
  deleteSession: async (sessionId: number): Promise<void> => {
    await api.delete(`/intake/sessions/${sessionId}`);
  },
  uploadDocuments: async (sessionId: number, formData: FormData): Promise<IntakeDocument[]> => {
    const res = await api.post<IntakeDocument[]>(`/intake/sessions/${sessionId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  runExtraction: async (sessionId: number): Promise<{ session: IntakeSession; ai_mode: string; excel_preview?: any }> => {
    const res = await api.post(`/intake/sessions/${sessionId}/extract`);
    return res.data;
  },
  updateField: async (
    sessionId: number,
    fieldId: number,
    payload: { status?: string; confirmed_value?: string }
  ): Promise<ExtractedField> => {
    const res = await api.patch<ExtractedField>(`/intake/sessions/${sessionId}/fields/${fieldId}`, payload);
    return res.data;
  },
  updateRouting: async (
    sessionId: number,
    routingId: number,
    payload: Partial<SuggestedRouting>
  ): Promise<SuggestedRouting> => {
    const res = await api.patch<SuggestedRouting>(`/intake/sessions/${sessionId}/routing/${routingId}`, payload);
    return res.data;
  },
  commitSession: async (
    sessionId: number,
    overrides?: any
  ): Promise<{ detail: string; rfq_id: number; rfq_number: string; part_id?: number }> => {
    const res = await api.post(`/intake/sessions/${sessionId}/commit`, overrides || {});
    return res.data;
  },
  getDocumentDownloadUrl: (docId: number) => {
    return `${API_BASE_URL}/intake/documents/${docId}/download`;
  },
};

// Phase 3 Historical Quote Search API
export const historyApi = {
  searchQuotes: async (params: Record<string, any>): Promise<HistoricalQuotation[]> => {
    const res = await api.get<HistoricalQuotation[]>("/history/quotes", { params });
    return res.data;
  },
  getQuote: async (quoteId: number): Promise<HistoricalQuotation> => {
    const res = await api.get<HistoricalQuotation>(`/history/quotes/${quoteId}`);
    return res.data;
  },
  compareQuotes: async (quoteIdA: number, quoteIdB: number): Promise<HistoricalQuoteComparison> => {
    const res = await api.post<HistoricalQuoteComparison>("/history/compare", {
      quote_id_a: quoteIdA,
      quote_id_b: quoteIdB,
    });
    return res.data;
  },
  importExcel: async (file: File): Promise<{ total_imported: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/history/import-excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  applyReferenceToRfq: async (
    quoteId: number,
    rfqId: number
  ): Promise<{ detail: string; rfq_id: number; quote_number: string }> => {
    const res = await api.post("/history/apply-reference", {
      quote_id: quoteId,
      rfq_id: rfqId,
    });
    return res.data;
  },
};

// Phase 4 Commercial Quotations API
export const quotationsApi = {
  listQuotations: async (params?: { status?: string; customer?: string }): Promise<QuotationData[]> => {
    const res = await api.get<QuotationData[]>("/quotations/", { params });
    return res.data;
  },
  getQuotation: async (id: number): Promise<QuotationData> => {
    const res = await api.get<QuotationData>(`/quotations/${id}`);
    return res.data;
  },
  createQuotation: async (payload: {
    costing_sheet_id?: number;
    rfq_id?: number;
    customer_contact?: string;
    customer_address?: string;
    payment_terms?: string;
    validity_days?: number;
  }): Promise<QuotationData> => {
    const res = await api.post<QuotationData>("/quotations/", payload);
    return res.data;
  },
  generatePdf: async (id: number): Promise<{ detail: string; quotation_number: string; version: number }> => {
    const res = await api.post(`/quotations/${id}/generate-pdf`);
    return res.data;
  },
  sendQuotation: async (id: number): Promise<QuotationData> => {
    const res = await api.post<QuotationData>(`/quotations/${id}/send`);
    return res.data;
  },
  downloadPdf: async (id: number, filename?: string): Promise<void> => {
    const res = await api.get(`/quotations/${id}/pdf`, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename || `Quotation-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  viewPdf: async (id: number): Promise<void> => {
    const res = await api.get(`/quotations/${id}/pdf`, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
  },
  getPdfDownloadUrl: (id: number) => {
    return `${API_BASE_URL}/quotations/${id}/pdf`;
  },
};

// Phase 4 Approval Workflow API
export const approvalsApi = {
  listApprovals: async (status?: string): Promise<QuotationApprovalItem[]> => {
    const params = status && status !== "ALL" ? { status } : {};
    const res = await api.get<QuotationApprovalItem[]>("/approvals/", { params });
    return res.data;
  },
  getApproval: async (id: number): Promise<ApprovalDetailPayload> => {
    const res = await api.get<ApprovalDetailPayload>(`/approvals/${id}`);
    return res.data;
  },
  submitForApproval: async (quotationId: number): Promise<QuotationApprovalItem> => {
    const res = await api.post<QuotationApprovalItem>("/approvals/submit", {
      quotation_id: quotationId,
    });
    return res.data;
  },
  approve: async (id: number, reason?: string): Promise<QuotationApprovalItem> => {
    const res = await api.post<QuotationApprovalItem>(`/approvals/${id}/approve`, {
      reason: reason || "",
    });
    return res.data;
  },
  reject: async (id: number, reason: string): Promise<QuotationApprovalItem> => {
    const res = await api.post<QuotationApprovalItem>(`/approvals/${id}/reject`, {
      reason,
    });
    return res.data;
  },
  requestRevision: async (id: number, reason: string): Promise<QuotationApprovalItem> => {
    const res = await api.post<QuotationApprovalItem>(`/approvals/${id}/revision`, {
      reason,
    });
    return res.data;
  },
  resubmit: async (quotationId: number): Promise<QuotationApprovalItem> => {
    const res = await api.post<QuotationApprovalItem>("/approvals/resubmit", {
      quotation_id: quotationId,
    });
    return res.data;
  },
  getHistory: async (quotationId: number): Promise<QuotationApprovalItem[]> => {
    const res = await api.get<QuotationApprovalItem[]>(`/approvals/history/${quotationId}`);
    return res.data;
  },
};
