import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Eye, X, Calculator } from "lucide-react";
import { api } from "../services/api";
import { RFQ, RFQListResponse, RFQStatus } from "../types";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS: RFQStatus[] = [
  "New",
  "Estimating",
  "Awaiting Approval",
  "Approved",
  "Sent",
  "Won",
  "Lost",
];

const statusBadgeStyle = (status: RFQStatus) => {
  switch (status) {
    case "New":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Estimating":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Awaiting Approval":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Approved":
    case "Won":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Lost":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

export const RFQRegister: React.FC = () => {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newRfq, setNewRfq] = useState({
    rfq_number: "RFQ-2611-031",
    customer_name: "",
    industry: "Automotive",
    due_date: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    part_name: "",
    drawing_number: "",
    material_spec: "EN8",
    gross_weight_kg: "1.20",
    annual_volume: "50000",
    cycle_time_minutes: "4.50",
    machine_hourly_rate_inr: "950.00",
  });

  const fetchRfqs = () => {
    setLoading(true);
    const params: Record<string, any> = { page, page_size: 10 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (customerFilter) params.customer = customerFilter;

    api
      .get<RFQListResponse>("/rfqs", { params })
      .then((res) => {
        setRfqs(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRfqs();
  }, [search, statusFilter, customerFilter, page]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post("/rfqs", {
        rfq_number: newRfq.rfq_number,
        customer_name: newRfq.customer_name,
        industry: newRfq.industry,
        due_date: newRfq.due_date,
        part: {
          part_name: newRfq.part_name,
          drawing_number: newRfq.drawing_number || "DRW-PENDING",
          material_spec: newRfq.material_spec,
          gross_weight_kg: Number(newRfq.gross_weight_kg),
          annual_volume: Number(newRfq.annual_volume),
          cycle_time_minutes: Number(newRfq.cycle_time_minutes),
          machine_hourly_rate_inr: Number(newRfq.machine_hourly_rate_inr),
        },
      });
      setShowCreateModal(false);
      fetchRfqs();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || "Could not create RFQ. Check inputs.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">RFQ Register</h1>
          <p className="text-xs text-muted">
            Track incoming customer drawings, part specifications, and estimation status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/costing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Calculator className="w-4 h-4" />
            <span>Open Costing</span>
          </Link>

          {user?.role === "ESTIMATOR" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#172B4D] hover:bg-[#1f375e] text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New RFQ</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 shadow-xs">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search RFQ ID, part name, customer, or material..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-[#00EA64] focus:ring-1 focus:ring-[#00EA64]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-white focus:outline-none focus:border-[#00EA64] font-medium"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={customerFilter}
          onChange={(e) => {
            setPage(1);
            setCustomerFilter(e.target.value);
          }}
          placeholder="Filter by customer..."
          className="px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-[#00EA64]"
        />
      </div>

      {/* Main RFQ Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">RFQ ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Part Name</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Gross Wt (kg)</th>
                <th className="py-3 px-4 text-right">Annual Vol.</th>
                <th className="py-3 px-4">Estimator</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted">
                    Loading RFQ records...
                  </td>
                </tr>
              ) : rfqs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted">
                    No matching RFQs found. Adjust your search filters or create a new RFQ.
                  </td>
                </tr>
              ) : (
                rfqs.map((rfq) => {
                  const part = rfq.parts[0];
                  return (
                    <tr key={rfq.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        <Link to={`/rfqs/${rfq.id}`} className="hover:text-emerald-600">
                          {rfq.rfq_number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{rfq.customer_name}</div>
                        <div className="text-[11px] text-muted">{rfq.industry}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{part?.part_name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{part?.material_spec}</td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-mono">
                        {Number(part?.gross_weight_kg).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums font-mono font-medium">
                        {part?.annual_volume.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {rfq.assigned_estimator_name || "Unassigned"}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-slate-600">{rfq.due_date}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${statusBadgeStyle(
                            rfq.status
                          )}`}
                        >
                          {rfq.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <Link
                          to={`/costing?rfq_id=${rfq.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] rounded-md font-bold text-[11px] transition shadow-xs"
                          title="Cost this part"
                        >
                          <Calculator className="w-3 h-3" />
                          <span>Cost</span>
                        </Link>
                        <Link
                          to={`/rfqs/${rfq.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 font-semibold text-[11px] transition"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted bg-slate-50/50">
          <span>
            Showing {rfqs.length} of {total} total RFQs
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={page * 10 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create RFQ Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-border max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <h2 className="text-base font-bold text-slate-900">Register New Manufacturing RFQ</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RFQ Number</label>
                  <input
                    required
                    value={newRfq.rfq_number}
                    onChange={(e) => setNewRfq({ ...newRfq, rfq_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Due Date</label>
                  <input
                    type="date"
                    required
                    value={newRfq.due_date}
                    onChange={(e) => setNewRfq({ ...newRfq, due_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
                  <input
                    required
                    value={newRfq.customer_name}
                    onChange={(e) => setNewRfq({ ...newRfq, customer_name: e.target.value })}
                    placeholder="e.g. Mahindra Tractors"
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Industry Sector</label>
                  <input
                    required
                    value={newRfq.industry}
                    onChange={(e) => setNewRfq({ ...newRfq, industry: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Part Name</label>
                  <input
                    required
                    value={newRfq.part_name}
                    onChange={(e) => setNewRfq({ ...newRfq, part_name: e.target.value })}
                    placeholder="e.g. Bevel Pinion"
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material Grade</label>
                  <input
                    required
                    value={newRfq.material_spec}
                    onChange={(e) => setNewRfq({ ...newRfq, material_spec: e.target.value })}
                    placeholder="e.g. 20MnCr5"
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gross Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={newRfq.gross_weight_kg}
                    onChange={(e) => setNewRfq({ ...newRfq, gross_weight_kg: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Annual Volume (pcs)</label>
                  <input
                    type="number"
                    required
                    value={newRfq.annual_volume}
                    onChange={(e) => setNewRfq({ ...newRfq, annual_volume: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Est. Cycle Time (min)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newRfq.cycle_time_minutes}
                    onChange={(e) => setNewRfq({ ...newRfq, cycle_time_minutes: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Machine Rate (₹/hr)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={newRfq.machine_hourly_rate_inr}
                    onChange={(e) =>
                      setNewRfq({ ...newRfq, machine_hourly_rate_inr: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold rounded-lg shadow-sm cursor-pointer transition"
                >
                  Create RFQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
