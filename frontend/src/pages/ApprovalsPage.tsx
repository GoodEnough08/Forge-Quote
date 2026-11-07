import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  FileText,
  Download,
  Send,
  Eye,
  Search,
  ShieldCheck,
  UserCheck,
  Building,
  Layers,
  ArrowRight,
  TrendingDown,
  Clock,
  ExternalLink,
  History as HistoryIcon,
  RefreshCw,
  PlusCircle,
  X,
  FileCheck,
  DollarSign,
  Scale,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { approvalsApi, quotationsApi, api } from "../services/api";
import {
  QuotationApprovalItem,
  ApprovalDetailPayload,
  QuotationData,
  RFQ,
} from "../types";

export const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<QuotationApprovalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Review Drawer / Modal state
  const [selectedApprovalId, setSelectedApprovalId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailData, setDetailData] = useState<ApprovalDetailPayload | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<QuotationData | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<QuotationApprovalItem[]>([]);

  // Action Dialog states (Approve / Reject / Revision)
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | "REVISION" | "SEND" | null>(null);
  const [reasonInput, setReasonInput] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  // Create Quotation Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [availableRfqs, setAvailableRfqs] = useState<RFQ[]>([]);
  const [selectedRfqId, setSelectedRfqId] = useState<string>("");
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  const isSalesHead = user?.role === "SALES_HEAD" || (user as any)?.role === "Sales Head";
  const isEstimator = user?.role === "ESTIMATOR" || (user as any)?.role === "Estimator";

  const fetchApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await approvalsApi.listApprovals(statusFilter === "ALL" ? undefined : statusFilter);
      setApprovals(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load approval queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  // Load detailed context when an approval is selected
  const handleSelectApproval = async (approvalId: number) => {
    setSelectedApprovalId(approvalId);
    setDetailLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const detail = await approvalsApi.getApproval(approvalId);
      setDetailData(detail);

      const quote = await quotationsApi.getQuotation(detail.approval.quotation);
      setQuotationDetail(quote);

      const history = await approvalsApi.getHistory(detail.approval.quotation);
      setApprovalHistory(history);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load quotation details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedApprovalId(null);
    setDetailData(null);
    setQuotationDetail(null);
    setApprovalHistory([]);
    setActionType(null);
    setReasonInput("");
  };

  // Execute approval actions
  const handleExecuteAction = async () => {
    if (!selectedApprovalId || !actionType) return;
    setActionSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (actionType === "APPROVE") {
        await approvalsApi.approve(selectedApprovalId, reasonInput);
        setSuccess("Quotation commercially approved. Customer PDF is now available for download.");
      } else if (actionType === "REJECT") {
        if (!reasonInput.trim()) {
          setError("A detailed rejection reason is mandatory.");
          setActionSubmitting(false);
          return;
        }
        await approvalsApi.reject(selectedApprovalId, reasonInput.trim());
        setSuccess("Quotation rejected and logged in the immutable audit trail.");
      } else if (actionType === "REVISION") {
        if (!reasonInput.trim()) {
          setError("A detailed revision request reason is mandatory.");
          setActionSubmitting(false);
          return;
        }
        await approvalsApi.requestRevision(selectedApprovalId, reasonInput.trim());
        setSuccess("Revision requested. Estimator has been notified to modify costing.");
      } else if (actionType === "SEND") {
        if (quotationDetail) {
          await quotationsApi.sendQuotation(quotationDetail.id);
          setSuccess("Quotation officially marked as Sent to Customer.");
        }
      }

      setActionType(null);
      setReasonInput("");
      await fetchApprovals();
      if (selectedApprovalId) {
        await handleSelectApproval(selectedApprovalId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Action failed.");
    } finally {
      setActionSubmitting(false);
    }
  };

  // Estimator Resubmission
  const handleResubmit = async () => {
    if (!quotationDetail) return;
    setActionSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await approvalsApi.resubmit(quotationDetail.id);
      setSuccess("Quotation successfully resubmitted for Sales Head commercial review.");
      await fetchApprovals();
      if (selectedApprovalId) {
        await handleSelectApproval(selectedApprovalId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Resubmission failed.");
    } finally {
      setActionSubmitting(false);
    }
  };

  // PDF Download trigger
  const handleDownloadPdf = async (quotationId: number, quoteNumber: string) => {
    try {
      await quotationsApi.downloadPdf(quotationId, `${quoteNumber}_Quotation.pdf`);
    } catch (err: any) {
      setError("Failed to download PDF. Please ensure quotation has been generated.");
    }
  };

  // Open Create Quotation Dialog
  const handleOpenCreateModal = async () => {
    setShowCreateModal(true);
    try {
      const res = await api.get<{ results?: RFQ[] } | RFQ[]>("/rfqs/");
      const rfqs = Array.isArray(res.data) ? res.data : res.data.results || [];
      setAvailableRfqs(rfqs);
    } catch (err) {
      // fallback
    }
  };

  const handleCreateQuotationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfqId) return;
    setCreateSubmitting(true);
    setError(null);
    try {
      const newQuote = await quotationsApi.createQuotation({ rfq_id: Number(selectedRfqId) });
      setShowCreateModal(false);
      setSelectedRfqId("");
      setSuccess(`Quotation ${newQuote.quotation_number} generated successfully as Draft.`);
      await fetchApprovals();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create quotation from RFQ.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Formatting Helpers
  const formatINR = (val: string | number | undefined | null) => {
    if (val === undefined || val === null || val === "") return "₹0.00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (val: number | string | undefined) => {
    if (!val) return "0";
    const num = typeof val === "string" ? parseFloat(val) : val;
    return num.toLocaleString("en-IN");
  };

  // KPI Calculations
  const pendingCount = approvals.filter((a) => a.status === "Pending").length;
  const highValueCount = approvals.filter(
    (a) => parseFloat(String(a.total_annual_value || 0)) > 2500000
  ).length;
  const revisionCount = approvals.filter((a) => a.status === "Revision Requested").length;
  const approvedCount = approvals.filter((a) => a.status === "Approved").length;

  // Filtered List
  const filteredApprovals = approvals.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.quotation_number.toLowerCase().includes(q) ||
      item.customer_name.toLowerCase().includes(q) ||
      item.part_name.toLowerCase().includes(q) ||
      item.rfq_number.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 text-emerald-800 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Commercial Approval Inbox</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                Phase 4
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                ₹25L Rule Active
              </span>
            </h1>
            <p className="text-xs text-muted">
              Commercial governance, gross margin compliance, and authenticated ReportLab customer PDF issuance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* User Role Badge */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-slate-500 font-medium">Role: </span>
              <strong className="text-slate-800">{user?.role || "Sales Head"}</strong>
            </div>
          </div>

          <button
            onClick={fetchApprovals}
            className="p-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
            title="Refresh pipeline"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {isEstimator && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Create Quotation Draft</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center justify-between font-medium shadow-xs">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center justify-between font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Awaiting Sign-off */}
        <div className="bg-white border border-border rounded-xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Awaiting Sign-Off</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Commercial queue</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: High-Value > 25L */}
        <div className="bg-white border border-border rounded-xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">High-Value (&gt; ₹25L)</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{highValueCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Mandatory Sales Head rule</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Revisions Active */}
        <div className="bg-white border border-border rounded-xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Revisions Active</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{revisionCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Returned to Estimator</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Commercially Approved */}
        <div className="bg-white border border-border rounded-xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Commercially Approved</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{approvedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Ready for PDF Dispatch</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#00EA64]/20 border border-[#00EA64]/30 flex items-center justify-center text-emerald-800">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-border rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { label: "All Items", value: "ALL", count: approvals.length },
            { label: "Pending", value: "Pending", count: pendingCount },
            { label: "Approved", value: "Approved", count: approvedCount },
            { label: "Revision Requested", value: "Revision Requested", count: revisionCount },
            { label: "Rejected", value: "Rejected", count: approvals.filter((a) => a.status === "Rejected").length },
          ].map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  active
                    ? "bg-[#172B4D] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by quote, customer, part, RFQ..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-[#00EA64]"
          />
        </div>
      </div>

      {/* Main Approvals Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted font-medium">
            Loading commercial approval pipeline...
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="p-12 text-center">
            <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">No quotation approvals match this filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Select another status filter or clear your search terms.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-border text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Quotation # & Rev</th>
                  <th className="py-3 px-4">Customer & RFQ</th>
                  <th className="py-3 px-4">Part & Specification</th>
                  <th className="py-3 px-4">Annual Volume</th>
                  <th className="py-3 px-4">Quoted Price</th>
                  <th className="py-3 px-4">Total Annual Value</th>
                  <th className="py-3 px-4">Est. Margin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-slate-700">
                {filteredApprovals.map((item) => {
                  const totalValNum = parseFloat(String(item.total_annual_value || 0));
                  const isHighValue = totalValNum > 2500000;
                  const isLowMargin = item.margin_percentage < 12;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      {/* Quote Number & Rev */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {item.quotation_number}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            v{item.revision_number}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Submitted by <strong className="text-slate-700">{item.submitted_by_name}</strong>
                        </span>
                      </td>

                      {/* Customer & RFQ */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{item.customer_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {item.rfq_number}
                        </div>
                      </td>

                      {/* Part & Specification */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{item.part_name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="font-mono">DWG: {item.drawing_number}</span>
                          <span>&bull;</span>
                          <span className="font-medium text-slate-600">{item.material_spec}</span>
                        </div>
                      </td>

                      {/* Annual Volume */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900">
                          {formatNumber(item.annual_volume)}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">pcs/yr</span>
                      </td>

                      {/* Quoted Price */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-slate-900 text-sm">
                        {formatINR(item.unit_price)}
                        <span className="text-[10px] text-slate-500 font-normal ml-0.5">/pc</span>
                      </td>

                      {/* Total Annual Value & Threshold */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {formatINR(item.total_annual_value)}
                        </div>
                        {isHighValue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            &gt; ₹25L Limit
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 block mt-0.5">&le; ₹25L Standard</span>
                        )}
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isLowMargin ? "text-red-700" : "text-emerald-700"
                            }`}
                          >
                            {item.margin_percentage.toFixed(1)}%
                          </span>
                          {isLowMargin && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                              Low
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {isLowMargin ? "Target: \u226512%" : "Target met"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === "Pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Awaiting Approval
                          </span>
                        )}
                        {item.status === "Approved" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved
                          </span>
                        )}
                        {item.status === "Revision Requested" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <RotateCcw className="w-3 h-3 text-indigo-600" />
                            Revision Requested
                          </span>
                        )}
                        {item.status === "Rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3 text-red-600" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSelectApproval(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#172B4D] hover:bg-[#1f375e] text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                            title="Review quotation details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>

                          {item.status === "Approved" && (
                            <button
                              onClick={() => handleDownloadPdf(item.quotation, item.quotation_number)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold transition cursor-pointer"
                              title="Download customer quotation PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Drawer / Modal */}
      {selectedApprovalId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white border-l border-slate-300 h-full overflow-y-auto flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                    Commercial Sign-Off Review
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Revision v{detailData?.approval.revision_number || 1}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                  {detailData?.approval.quotation_number}
                </h2>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            {detailLoading || !detailData ? (
              <div className="p-12 text-center text-xs text-muted flex-1 flex items-center justify-center">
                Loading quotation review data...
              </div>
            ) : (
              <div className="p-6 space-y-6 flex-1 text-slate-800">
                {/* Statutory Limit Callout Banner */}
                {parseFloat(String(detailData.approval.total_annual_value || 0)) > 2500000 && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3 shadow-xs">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                        Mandatory Approval Required (&gt; ₹25,00,000 Statutory Limit)
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Total annual quotation value of{" "}
                        <strong className="text-slate-900 font-bold font-mono">
                          {formatINR(detailData.approval.total_annual_value)}
                        </strong>{" "}
                        strictly triggers the commercial threshold requirement. Unapproved quotes are prohibited from being dispatched to customers.
                      </p>
                    </div>
                  </div>
                )}

                {/* Low Margin Warning Callout */}
                {detailData.approval.margin_percentage < 12 && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 shadow-xs">
                    <TrendingDown className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide">
                        Low Gross Margin Alert ({detailData.approval.margin_percentage.toFixed(1)}%)
                      </h4>
                      <p className="text-xs text-red-800 mt-1">
                        The quoted profit margin is below the internal benchmark target of 12.0%. Ensure adequate machining recovery or request estimator revision.
                      </p>
                    </div>
                  </div>
                )}

                {/* Customer & Technical Profile Card */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Customer Name
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{detailData.approval.customer_name}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {detailData.customer_details.address || "Standard Industrial Delivery Hub"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      RFQ Reference
                    </span>
                    <p className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                      {detailData.approval.rfq_number}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Contact: {detailData.customer_details.contact || "Procurement Dept"}
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Part Description
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{detailData.approval.part_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">DWG: {detailData.approval.drawing_number}</p>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Steel Spec & Weight
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {detailData.approval.material_spec}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Gross: {quotationDetail?.gross_weight_kg || 0} kg / piece
                    </p>
                  </div>
                </div>

                {/* Volume Pricing Tiers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Customer Pricing Tiers (ReportLab PDF Output)
                    </h3>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      GST (18%) Computed Separately
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold">
                          <th className="py-2.5 px-3">Batch Tier</th>
                          <th className="py-2.5 px-3">Base Unit Price</th>
                          <th className="py-2.5 px-3">GST (18%)</th>
                          <th className="py-2.5 px-3">Final Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Batch Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {quotationDetail?.tiers && quotationDetail.tiers.length > 0 ? (
                          quotationDetail.tiers.map((tier, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                {formatNumber(tier.quantity)} pcs
                              </td>
                              <td className="py-2.5 px-3 font-mono">{formatINR(tier.unit_price)}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{formatINR(tier.gst_amount)}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                                {formatINR(tier.unit_price_with_gst)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {formatINR(tier.total_with_gst)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {formatNumber(detailData.approval.annual_volume)} pcs
                            </td>
                            <td className="py-2.5 px-3 font-mono">{formatINR(detailData.approval.unit_price)}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {formatINR(parseFloat(String(detailData.approval.unit_price)) * 0.18)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                              {formatINR(parseFloat(String(detailData.approval.unit_price)) * 1.18)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatINR(parseFloat(String(detailData.approval.total_annual_value)) * 1.18)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Confidential Internal Costing Breakdown (Sales Head Only) */}
                {detailData.costing_breakdown && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Confidential Internal Costing (Never Exposed in PDF)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                        Date Effective Snapshot
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Steel Material Cost</span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                          {formatINR(detailData.costing_breakdown.material_cost)}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          @{detailData.costing_breakdown.material_rate_per_kg_snapshot}/kg
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Forging / Processing</span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                          {formatINR(detailData.costing_breakdown.total_processing_cost)}
                        </p>
                        <span className="text-[10px] text-slate-500">
                          {detailData.costing_breakdown.operations?.length || 0} operations
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Direct Labour & O/H</span>
                        <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                          {formatINR(
                            parseFloat(detailData.costing_breakdown.labour_cost || "0") +
                              parseFloat(detailData.costing_breakdown.overhead_cost || "0")
                          )}
                        </p>
                        <span className="text-[10px] text-slate-500">Factory overhead</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-emerald-800 font-semibold uppercase">Gross Margin Amount</span>
                        <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                          {formatINR(detailData.costing_breakdown.margin_amount)}
                        </p>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {detailData.costing_breakdown.margin_percentage}% margin
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Commercial Terms Summary */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 grid grid-cols-3 gap-3 text-xs shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Payment Terms
                    </span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {detailData.customer_details.payment_terms || "30 Days Net"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Delivery Terms
                    </span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {detailData.customer_details.delivery_terms || "Ex-Works Pune Plant"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Quotation Validity
                    </span>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {detailData.customer_details.validity_days || 30} Days
                    </p>
                  </div>
                </div>

                {/* Audit Trail & History */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Approval & Revision Audit Trail
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {approvalHistory.map((hist, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">Revision Cycle {hist.revision_number}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                hist.status === "Approved"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                                  : hist.status === "Revision Requested"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : hist.status === "Rejected"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-300"
                              }`}
                            >
                              {hist.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(hist.submitted_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="text-slate-600 text-[11px]">
                          Submitted by <strong className="text-slate-800">{hist.submitted_by_name}</strong>
                          {hist.reviewed_by_name && (
                            <>
                              {" "}&bull; Reviewed by{" "}
                              <strong className="text-slate-900">{hist.reviewed_by_name}</strong>
                            </>
                          )}
                        </div>

                        {hist.decision_reason && (
                          <div className="p-2.5 rounded bg-white text-slate-800 text-[11px] border border-slate-200 mt-1 shadow-2xs">
                            <span className="text-slate-500 font-bold block text-[10px] uppercase">
                              Reviewer Note / Justification:
                            </span>
                            {hist.decision_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reason Input Modal when an action is selected */}
                {actionType && (
                  <div className="p-4 rounded-xl bg-white border-2 border-emerald-500 space-y-3 shadow-lg animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        {actionType === "APPROVE" && "Confirm Commercial Approval"}
                        {actionType === "REJECT" && "Mandatory Rejection Justification"}
                        {actionType === "REVISION" && "Specify Requested Costing Changes"}
                        {actionType === "SEND" && "Dispatch Official Quotation"}
                      </h4>
                      <button
                        onClick={() => setActionType(null)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {actionType !== "SEND" && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          {actionType === "APPROVE"
                            ? "Approval Note (Optional)"
                            : "Detailed Reason (Strictly Required for Audit Trail)*"}
                        </label>
                        <textarea
                          rows={3}
                          value={reasonInput}
                          onChange={(e) => setReasonInput(e.target.value)}
                          placeholder={
                            actionType === "APPROVE"
                              ? "e.g., Margin targets validated. Commercial terms aligned with buyer agreement."
                              : "e.g., Steel raw material scrap allowance is too aggressive; please re-verify with forging supervisor."
                          }
                          className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00EA64]"
                        />
                      </div>
                    )}

                    {actionType === "SEND" && (
                      <p className="text-xs text-slate-700">
                        Are you sure you want to mark this quotation as officially dispatched to the customer?
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActionType(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteAction}
                        disabled={actionSubmitting}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          actionType === "APPROVE"
                            ? "bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E]"
                            : actionType === "REJECT"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : actionType === "REVISION"
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : "bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E]"
                        }`}
                      >
                        {actionSubmitting ? "Executing..." : `Confirm ${actionType}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Drawer Action Footer */}
            {detailData && (
              <div className="p-4 border-t border-border bg-slate-50/90 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 z-10">
                {/* PDF Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleDownloadPdf(
                        detailData.approval.quotation,
                        detailData.approval.quotation_number
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                    <span>Download Customer PDF</span>
                  </button>
                </div>

                {/* Commercial Decision Controls */}
                <div className="flex items-center gap-2">
                  {detailData.approval.status === "Pending" && (
                    <>
                      {isSalesHead ? (
                        <>
                          <button
                            onClick={() => {
                              setActionType("REJECT");
                              setReasonInput("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>

                          <button
                            onClick={() => {
                              setActionType("REVISION");
                              setReasonInput("");
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold transition cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Request Revision</span>
                          </button>

                          <button
                            onClick={() => {
                              setActionType("APPROVE");
                              setReasonInput("");
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold shadow-sm transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>Approve Quotation</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-300 font-semibold">
                          Awaiting Sales Head commercial sign-off
                        </div>
                      )}
                    </>
                  )}

                  {detailData.approval.status === "Revision Requested" && isEstimator && (
                    <button
                      onClick={handleResubmit}
                      disabled={actionSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                      <span>{actionSubmitting ? "Resubmitting..." : "Resubmit for Approval"}</span>
                    </button>
                  )}

                  {detailData.approval.status === "Approved" && quotationDetail?.status !== "Sent" && (
                    <button
                      onClick={() => setActionType("SEND")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#172B4D] hover:bg-[#1f375e] text-white text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Mark as Sent to Customer</span>
                    </button>
                  )}

                  {quotationDetail?.status === "Sent" && (
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Dispatched to Customer
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-border rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Commercial Quotation</h3>
                <p className="text-xs text-muted mt-0.5">
                  Generate formal customer pricing tiers from an RFQ with completed costing.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotationSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select RFQ with Costing Sheet *
                </label>
                <select
                  value={selectedRfqId}
                  onChange={(e) => setSelectedRfqId(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#00EA64]"
                >
                  <option value="">-- Choose an RFQ --</option>
                  {availableRfqs.map((rfq) => (
                    <option key={rfq.id} value={rfq.id}>
                      {rfq.rfq_number} &bull; {rfq.customer_name} &bull; {rfq.parts?.[0]?.part_name || "Part"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1 text-amber-800">
                <p className="font-bold text-amber-900">Governance note:</p>
                <p>
                  Quotations exceeding ₹25,00,000 annual value are automatically flagged as requiring Sales Head approval before customer dispatch.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting || !selectedRfqId}
                  className="px-4 py-2 rounded-lg bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {createSubmitting ? "Generating..." : "Generate Quotation Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
