import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Send,
  AlertTriangle,
  Award,
  ArrowRight,
  Plus,
} from "lucide-react";
import { api } from "../services/api";
import { DashboardSummary } from "../types";

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardSummary>("/rfqs/dashboard")
      .then((res) => setSummary(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-white border border-border rounded p-4 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const kpis = [
    {
      label: "Total Active RFQs",
      value: summary.total_rfqs,
      icon: FileSpreadsheet,
      tone: "text-slate-800",
      bg: "bg-slate-100",
    },
    {
      label: "Awaiting Estimation",
      value: summary.awaiting_estimation,
      icon: Clock,
      tone: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Awaiting Approval",
      value: summary.awaiting_approval,
      icon: CheckCircle2,
      tone: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Overdue RFQs",
      value: summary.overdue_count,
      icon: AlertTriangle,
      tone: summary.overdue_count > 0 ? "text-red-600" : "text-slate-400",
      bg: summary.overdue_count > 0 ? "bg-red-50" : "bg-slate-50",
    },
    {
      label: "Quotations Sent",
      value: summary.quotations_sent,
      icon: Send,
      tone: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      label: "Won / Lost",
      value: `${summary.won_count} / ${summary.lost_count}`,
      icon: Award,
      tone: "text-[#00BD51]",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operations Overview</h1>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
              Demo Database Online
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Target turnaround: 4 working days (1.0 hr estimation/part benchmark).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/costing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition"
          >
            <span>Open Costing Workspace</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </Link>

          <Link
            to="/rfqs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#172B4D] hover:bg-[#1f375e] text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <span>RFQ Register</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-white border border-border rounded-xl p-4 flex items-center justify-between shadow-xs hover:border-slate-300 transition"
            >
              <div>
                <p className="text-xs text-muted font-medium">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${item.tone}`}>
                  {item.value}
                </p>
              </div>
              <div className={`w-11 h-11 rounded-lg ${item.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${item.tone}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Prioritized Quotation Due Dates</h2>
            <p className="text-xs text-muted">
              Live queue for CNC machining, hot/cold forging, and heat-treated parts
            </p>
          </div>
          <Link to="/rfqs" className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1">
            <span>View All RFQs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">RFQ ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Part Name</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Annual Vol.</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {summary.upcoming_rfqs.map((rfq) => {
                const part = rfq.parts[0];
                return (
                  <tr key={rfq.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                      <Link to={`/rfqs/${rfq.id}`} className="hover:text-emerald-600">
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-medium">{rfq.customer_name}</td>
                    <td className="py-3.5 px-4 text-slate-900 font-semibold">{part?.part_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{part?.material_spec}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums font-mono font-medium">
                      {part?.annual_volume.toLocaleString("en-IN")} pcs
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-slate-600">{rfq.due_date}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {rfq.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/costing?rfq_id=${rfq.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-[#00EA64] text-emerald-800 hover:text-[#0E141E] border border-emerald-200 rounded font-bold transition text-[11px]"
                      >
                        <span>Cost Part</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
