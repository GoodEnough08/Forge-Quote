import axios from "axios";
import {
  MaterialRate,
  MachineRate,
  CostingCalculationResponse,
  CostingSheetData,
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