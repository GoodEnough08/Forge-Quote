import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Mail,
  CheckCircle2,
  XCircle,
  Edit3,
  ArrowRight,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Database,
  Calculator,
  Eye,
  FileCheck,
} from "lucide-react";
import { intakeApi } from "../services/api";
import {
  IntakeSession,
  IntakeDocument,
  ExtractedField,
  SuggestedRouting,
  IntakeDocType,
} from "../types";

export const AIIntakeWorkspace: React.FC = () => {
  const navigate = useNavigate();

  // Sessions list & active session
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<string>("ForgeQuote Deterministic Engine");

  // Step 1: Upload state
  const [selectedDocType, setSelectedDocType] = useState<IntakeDocType>("PDF_RFQ");
  const [emailText, setEmailText] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  // Field edit modal
  const [editingField, setEditingField] = useState<ExtractedField | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Load sessions list
  const loadSessions = async () => {
    try {
      const data = await intakeApi.listSessions();
      setSessions(data);
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load intake sessions", err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // Load active session details
  const loadActiveSession = async (id: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await intakeApi.getSession(id);
      setSession(data);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Could not retrieve intake session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSessionId) {
      loadActiveSession(activeSessionId);
    }
  }, [activeSessionId]);

  // Create new intake session
  const handleCreateSession = async () => {
    try {
      const title = prompt("Enter a title for this RFQ Intake Session:", "Tender Document Intake");
      if (!title) return;
      const newSession = await intakeApi.createSession({ title });
      setSessions([newSession, ...sessions]);
      setActiveSessionId(newSession.id);
      setSuccessMsg("Created new intake workspace session.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg("Failed to create session.");
    }
  };

  // Upload files or email text
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId) return;

    if (!selectedFiles && !emailText.trim()) {
      setErrorMsg("Please select a document file or paste tender email text.");
      return;
    }

    setProcessing(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file_type", selectedDocType);
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          formData.append("files", selectedFiles[i]);
        }
      }
      if (emailText.trim()) {
        formData.append("email_text", emailText.trim());
      }

      await intakeApi.uploadDocuments(activeSessionId, formData);
      setEmailText("");
      setSelectedFiles(null);
      // Reset input element
      const fileInput = document.getElementById("file-upload-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      await loadActiveSession(activeSessionId);
      setSuccessMsg("Document(s) securely uploaded to private storage.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Failed to upload document.");
    } finally {
      setProcessing(false);
    }
  };

  // Run AI / Deterministic extraction
  const handleRunExtraction = async () => {
    if (!activeSessionId) return;
    setProcessing(true);
    setErrorMsg(null);
    try {
      const res = await intakeApi.runExtraction(activeSessionId);
      setSession(res.session);
      setAiMode(res.ai_mode);
      setSuccessMsg(`Extraction completed using ${res.ai_mode}. Review advisory suggestions below.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Extraction execution failed.");
    } finally {
      setProcessing(false);
    }
  };

  // Field status updates
  const handleFieldStatus = async (fieldId: number, status: "ACCEPTED" | "REJECTED") => {
    if (!activeSessionId) return;
    try {
      const updated = await intakeApi.updateField(activeSessionId, fieldId, { status });
      if (session && session.extracted_fields) {
        const nextFields = session.extracted_fields.map((f) => (f.id === fieldId ? updated : f));
        setSession({ ...session, extracted_fields: nextFields });
      }
    } catch (err) {
      console.error("Failed to update field status", err);
    }
  };

  // Field edit modal submit
  const handleSaveFieldEdit = async () => {
    if (!activeSessionId || !editingField) return;
    try {
      const updated = await intakeApi.updateField(activeSessionId, editingField.id, {
        status: "EDITED",
        confirmed_value: editValue,
      });
      if (session && session.extracted_fields) {
        const nextFields = session.extracted_fields.map((f) => (f.id === editingField.id ? updated : f));
        setSession({ ...session, extracted_fields: nextFields });
      }
      setEditingField(null);
    } catch (err) {
      console.error("Failed to save field edit", err);
    }
  };

  // Routing toggle
  const handleToggleRouting = async (routeId: number, current: boolean) => {
    if (!activeSessionId) return;
    try {
      const updated = await intakeApi.updateRouting(activeSessionId, routeId, { is_accepted: !current });
      if (session && session.suggested_routings) {
        const nextR = session.suggested_routings.map((r) => (r.id === routeId ? updated : r));
        setSession({ ...session, suggested_routings: nextR });
      }
    } catch (err) {
      console.error("Failed to toggle routing", err);
    }
  };

  // Commit session to RFQ
  const handleCommitSession = async () => {
    if (!activeSessionId) return;
    const confirmCommit = window.confirm(
      "Commit verified fields and routing to create a new production RFQ? (Rejected fields will be excluded)."
    );
    if (!confirmCommit) return;

    setProcessing(true);
    setErrorMsg(null);
    try {
      const res = await intakeApi.commitSession(activeSessionId);
      setSuccessMsg(`RFQ ${res.rfq_number} successfully registered from intake session!`);
      await loadActiveSession(activeSessionId);
      loadSessions();
      setTimeout(() => {
        navigate(`/costing?rfq_id=${res.rfq_id}`);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Failed to commit intake data to RFQ.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 text-emerald-800 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>AI-Assisted RFQ Intake</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                Phase 3
              </span>
            </h1>
            <p className="text-xs text-muted">
              Extract technical specifications from drawing PDFs, customer RFQ packages, Excel part lists, and email tenders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sessions.length > 0 && (
            <select
              value={activeSessionId || ""}
              onChange={(e) => setActiveSessionId(Number(e.target.value))}
              className="text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 shadow-2xs"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id}: {s.title} ({s.status})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleCreateSession}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#172B4D] hover:bg-[#1f375e] text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Notification Banners */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step Indicator */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className={`p-3 rounded-xl border transition ${
            session?.status === "UPLOADED" || !session?.extracted_fields?.length
              ? "bg-[#0E141E] text-white border-slate-700"
              : "bg-white border-border text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-5 h-5 rounded-full bg-[#00EA64] text-[#0E141E] flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Document Intake</span>
          </div>
          <p className="text-[11px] text-muted mt-1">PDFs, Drawings, Excel, Text</p>
        </div>

        <div
          className={`p-3 rounded-xl border transition ${
            session?.status === "EXTRACTING"
              ? "bg-[#0E141E] text-white border-slate-700"
              : "bg-white border-border text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-5 h-5 rounded-full bg-[#00EA64] text-[#0E141E] flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Parsing & OCR</span>
          </div>
          <p className="text-[11px] text-muted mt-1">PyMuPDF + OpenPyXL Engine</p>
        </div>

        <div
          className={`p-3 rounded-xl border transition ${
            session?.status === "REVIEW_READY"
              ? "bg-[#0E141E] text-white border-slate-700"
              : "bg-white border-border text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-5 h-5 rounded-full bg-[#00EA64] text-[#0E141E] flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Advisory Review</span>
          </div>
          <p className="text-[11px] text-muted mt-1">Accept, Edit, or Reject</p>
        </div>

        <div
          className={`p-3 rounded-xl border transition ${
            session?.status === "COMMITTED"
              ? "bg-emerald-900 text-white border-emerald-600"
              : "bg-white border-border text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="w-5 h-5 rounded-full bg-[#00EA64] text-[#0E141E] flex items-center justify-center text-[10px]">
              4
            </span>
            <span>RFQ Creation</span>
          </div>
          <p className="text-[11px] text-muted mt-1">
            {session?.rfq_number ? `Committed to ${session.rfq_number}` : "Pending Verification"}
          </p>
        </div>
      </div>

      {/* Main Workflow Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Document Upload & Session Files */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-border pb-3">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              <span>Step 1: Upload Tender Documents</span>
            </h2>

            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDocType("PDF_RFQ")}
                    className={`py-2 px-2.5 rounded-lg border text-left font-semibold transition ${
                      selectedDocType === "PDF_RFQ"
                        ? "border-[#00EA64] bg-emerald-50/50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 mb-1 text-emerald-600" />
                    <span>RFQ PDF Spec</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDocType("PDF_DRAWING")}
                    className={`py-2 px-2.5 rounded-lg border text-left font-semibold transition ${
                      selectedDocType === "PDF_DRAWING"
                        ? "border-[#00EA64] bg-emerald-50/50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mb-1 text-blue-600" />
                    <span>Drawing PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDocType("EXCEL_PART_LIST")}
                    className={`py-2 px-2.5 rounded-lg border text-left font-semibold transition ${
                      selectedDocType === "EXCEL_PART_LIST"
                        ? "border-[#00EA64] bg-emerald-50/50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mb-1 text-teal-600" />
                    <span>Excel Part List</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDocType("EMAIL_TEXT")}
                    className={`py-2 px-2.5 rounded-lg border text-left font-semibold transition ${
                      selectedDocType === "EMAIL_TEXT"
                        ? "border-[#00EA64] bg-emerald-50/50 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 mb-1 text-amber-600" />
                    <span>Email Text</span>
                  </button>
                </div>
              </div>

              {selectedDocType !== "EMAIL_TEXT" ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select File (Max 20MB)
                  </label>
                  <input
                    id="file-upload-input"
                    type="file"
                    multiple
                    accept=".pdf,.xlsx,.xls,.txt,.eml"
                    onChange={(e) => setSelectedFiles(e.target.files)}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Documents are saved in private isolated storage (never public).
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Paste RFQ Email / Tender Notes
                  </label>
                  <textarea
                    rows={4}
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder="Customer: Tata Motors&#10;Part: Spindle EN8&#10;Gross Weight: 0.61 kg&#10;Volume: 180,000 pcs..."
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:border-[#00EA64]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={processing || (!selectedFiles && !emailText.trim())}
                className="w-full py-2.5 px-4 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold text-xs rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>{processing ? "Uploading..." : "Upload Document"}</span>
              </button>
            </form>
          </div>

          {/* Session Documents List */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Uploaded Files ({session?.documents?.length || 0})
              </h3>
              {session?.documents && session.documents.length > 0 && (
                <button
                  onClick={handleRunExtraction}
                  disabled={processing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{processing ? "Extracting..." : "Run Extraction"}</span>
                </button>
              )}
            </div>

            {session?.documents && session.documents.length > 0 ? (
              <div className="space-y-2">
                {session.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 truncate">{doc.file_name}</p>
                        <p className="text-[10px] text-muted">
                          {doc.file_type} • {(doc.file_size_bytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted py-4 text-center">
                No documents uploaded yet in this session.
              </p>
            )}
          </div>
        </div>

        {/* Center & Right Column: Extracted Fields Review & Suggested Routing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Advisory Notice */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#00EA64] animate-pulse" />
                <p className="text-xs font-bold text-white uppercase tracking-wider">
                  Advisory Extraction Mode: {aiMode}
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Extracted specifications are strictly proposals. Review, confirm, or edit every field before committing to an RFQ.
              </p>
            </div>

            {session?.status === "COMMITTED" ? (
              <Link
                to={`/costing?rfq_id=${session.rfq}`}
                className="shrink-0 px-4 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <span>Cost {session.rfq_number}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
            ) : (
              <button
                onClick={handleCommitSession}
                disabled={processing || !session?.extracted_fields?.length}
                className="shrink-0 px-5 py-2.5 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-lg shadow-[#00EA64]/20 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <span>Commit & Create RFQ</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>

          {/* Extracted Fields Table */}
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Step 3 & 4: Extracted Technical Specifications
                </h3>
                <p className="text-[11px] text-muted">
                  Verify provenance, inspect confidence, and mark each proposal.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-600">
                {session?.extracted_fields?.filter((f) => f.status === "ACCEPTED" || f.status === "EDITED").length || 0} of{" "}
                {session?.extracted_fields?.length || 0} Verified
              </span>
            </div>

            {session?.extracted_fields && session.extracted_fields.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Field</th>
                      <th className="py-2.5 px-4">Proposed Value</th>
                      <th className="py-2.5 px-4">Source Provenance</th>
                      <th className="py-2.5 px-4">Confidence</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {session.extracted_fields.map((f) => {
                      const isAccepted = f.status === "ACCEPTED";
                      const isEdited = f.status === "EDITED";
                      const isRejected = f.status === "REJECTED";

                      return (
                        <tr
                          key={f.id}
                          className={`hover:bg-slate-50/80 transition ${
                            isRejected ? "opacity-50 line-through bg-red-50/30" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-800">{f.field_label}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                            {f.confirmed_value || f.suggested_value}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-semibold block text-[11px] text-slate-800">
                              {f.source_document_name}
                            </span>
                            <span className="text-[10px] text-muted">{f.source_page_or_row}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              {Math.round(Number(f.confidence_score) * 100)}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isAccepted
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isEdited
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : isRejected
                                  ? "bg-red-100 text-red-800 border border-red-300"
                                  : "bg-amber-100 text-amber-800 border border-amber-300"
                              }`}
                            >
                              {f.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <button
                              onClick={() => handleFieldStatus(f.id, "ACCEPTED")}
                              className={`p-1.5 rounded hover:bg-emerald-100 transition cursor-pointer ${
                                isAccepted ? "text-emerald-700 font-bold" : "text-slate-400 hover:text-emerald-600"
                              }`}
                              title="Accept value"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingField(f);
                                setEditValue(f.confirmed_value || f.suggested_value);
                              }}
                              className="p-1.5 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                              title="Edit proposal"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFieldStatus(f.id, "REJECTED")}
                              className={`p-1.5 rounded hover:bg-red-100 transition cursor-pointer ${
                                isRejected ? "text-red-700" : "text-slate-400 hover:text-red-600"
                              }`}
                              title="Reject suggestion"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                No extracted fields yet. Click "Run Extraction" to parse uploaded documents.
              </div>
            )}
          </div>

          {/* Step 5: Suggested Routing from Historical Parts */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Step 5: Recommended Manufacturing Routing</span>
                </h3>
                <p className="text-[11px] text-muted">
                  Suggested machining & forging steps pulled from historical quotation database.
                </p>
              </div>
            </div>

            {session?.suggested_routings && session.suggested_routings.length > 0 ? (
              <div className="space-y-3">
                {session.suggested_routings.map((route) => (
                  <div
                    key={route.id}
                    className={`p-3.5 rounded-lg border text-xs transition ${
                      route.is_accepted
                        ? "bg-slate-50 border-emerald-300"
                        : "bg-slate-100/50 border-slate-200 opacity-60 line-through"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 font-bold text-slate-700 flex items-center justify-center text-[10px]">
                          {route.sequence}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900">{route.operation_name}</span>
                          <span className="text-slate-500 ml-2">({route.work_center})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-700">
                          {route.cycle_time_minutes} min @ ₹{route.machine_hourly_rate}/hr
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleRouting(route.id, route.is_accepted)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                            route.is_accepted
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                        >
                          {route.is_accepted ? "Included" : "Excluded"}
                        </button>
                      </div>
                    </div>

                    {route.recommendation_reason && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded mt-2 font-medium">
                        💡 {route.recommendation_reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted text-center py-4">
                Routing recommendations will appear after running document extraction.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Field Edit Modal */}
      {editingField && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-border max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-border pb-2">
              Edit Extracted Value: {editingField.field_label}
            </h3>

            <div className="text-xs space-y-2">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">AI Proposed Value</label>
                <input
                  type="text"
                  disabled
                  value={editingField.suggested_value}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-800 font-bold mb-1">Estimator Confirmed Value</label>
                <input
                  type="text"
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold font-mono focus:border-[#00EA64]"
                />
              </div>

              {editingField.source_snippet && (
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-semibold block text-slate-700">Source Context:</span>
                  <span className="italic font-mono">"{editingField.source_snippet}"</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFieldEdit}
                className="px-5 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold text-xs rounded-lg shadow-sm cursor-pointer transition"
              >
                Save Confirmed Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

