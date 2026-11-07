import React, { useState, useEffect } from "react";
import {
  Settings,
  ShieldCheck,
  Server,
  Database,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserCheck,
  FileText,
  Percent,
  DollarSign,
  Scale,
  Sparkles,
  Info,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

interface HealthStatus {
  status: string;
  service: string;
  version: string;
  phase: string;
  database: string;
  statutory_threshold_inr: string;
  gst_rate: string;
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pinging, setPinging] = useState<boolean>(false);
  const [lastPingTime, setLastPingTime] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkHealth = async () => {
    setPinging(true);
    setErrorMsg(null);
    try {
      const res = await api.get<HealthStatus>("/health");
      setHealth(res.data);
      setLastPingTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Backend health probe failed.");
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 text-emerald-800 flex items-center justify-center">
            <Settings className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>System & Governance Settings</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                Phase 5 Final
              </span>
            </h1>
            <p className="text-xs text-muted">
              Environment health diagnostics, statutory threshold parameters, AI intake status, and RBAC matrix.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkHealth}
            disabled={pinging}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pinging ? "animate-spin text-[#00EA64]" : ""}`} />
            <span>{pinging ? "Probing..." : "Ping Health Probe"}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-medium shadow-xs">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid of Diagnostics & Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: System Health & Diagnostics */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">API Engine Health</h2>
            </div>
            {health?.status === "healthy" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ONLINE (200 OK)
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                CHECKING
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Service Name</span>
              <strong className="text-slate-900">{health?.service || "ForgeQuote REST Backend"}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Backend Platform</span>
              <strong className="text-slate-900">Django 5.0.6 &bull; Django REST Framework</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Database Layer</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1 font-mono">
                <Database className="w-3.5 h-3.5" />
                {health?.database === "connected" ? "PostgreSQL / SQLite (Active)" : "Disconnected"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">PDF Engine</span>
              <strong className="text-slate-900">ReportLab 4.2.0 (Vector A4)</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Last Probe Time</span>
              <span className="text-slate-600 font-mono">{lastPingTime || "Just now"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Commercial Governance Rules */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">Statutory Governance Rules</h2>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Enforced Backend
            </span>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Approval Value Threshold</span>
              <strong className="text-slate-900 font-mono font-bold text-emerald-800">
                ₹25,00,000.00 (Annual)
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Threshold Rule Scope</span>
              <strong className="text-slate-800">Strict Prohibitory Send Block</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Statutory GST Standard</span>
              <strong className="text-slate-900 font-mono">18.00% (Separately Computed)</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Benchmark Gross Margin</span>
              <strong className="text-slate-900 font-mono">12.00% (Internal Target)</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Quotation Proposal Validity</span>
              <strong className="text-slate-900 font-mono">30 Calendar Days Default</strong>
            </div>
          </div>
        </div>

        {/* Card 3: AI Document Extraction Engine */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">AI Intake Pipeline Status</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
              Advisory Mode (Human-in-the-Loop)
            </span>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">PDF Parser</span>
              <strong className="text-slate-900 font-mono">PyMuPDF (fitz) v1.24.14</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Spreadsheet Parser</span>
              <strong className="text-slate-900 font-mono">Pandas 2.2.2 &bull; OpenPyXL 3.1.4</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Max Upload File Size</span>
              <strong className="text-slate-900 font-mono">20 MB per Document</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Document Storage Policy</span>
              <strong className="text-slate-900">Encrypted Private Media (Non-Public)</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">CAD / Dimensional Geometry</span>
              <span className="text-slate-600 italic">Advisory Text &amp; Title Blocks Only</span>
            </div>
          </div>
        </div>

        {/* Card 4: Role-Based Access Control (RBAC) Matrix */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">Access Control &amp; Session</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>{user?.email}</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Current User Role</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {user?.role}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Estimator Capabilities</span>
              <span className="text-slate-800 font-medium">Create RFQ, Run AI Intake, Costing, Draft Quotes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Sales Head Capabilities</span>
              <span className="text-slate-800 font-medium">Approve/Reject Quotes, View Internal Costs, Dispatch PDF</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Authentication Token</span>
              <strong className="text-slate-900 font-mono">SimpleJWT Bearer (8h Expiry)</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Audit History Preservation</span>
              <strong className="text-emerald-700 font-bold">Immutable Chronological Log</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Credentials Reference Box for Evaluators */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-700" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Evaluation Demo Accounts (Pre-Seeded)
          </h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          For technical evaluation and end-to-end user journey demonstration, the following pre-configured personas are available in the local database:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-800 block">Costing Estimator Persona</span>
            <span className="text-slate-500 font-mono block mt-0.5">estimator@forgequote.in / Estimator@123</span>
            <span className="text-[11px] text-slate-600 block mt-1">
              Permitted: RFQ creation, AI intake document extraction, costing calculation, quote drafting.
            </span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-800 block">Commercial Sales Head Persona</span>
            <span className="text-slate-500 font-mono block mt-0.5">saleshead@forgequote.in / SalesHead@123</span>
            <span className="text-[11px] text-slate-600 block mt-1">
              Permitted: Commercial sign-off, ₹25L threshold approval, revision requests, official customer PDF generation.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

