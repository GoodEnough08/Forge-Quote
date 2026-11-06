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
      tone: "text-primary",
    },
    {
      label: "Awaiting Estimation",
      value: summary.awaiting_estimation,
      icon: Clock,
      tone: "text-accent",
    },
    {
      label: "Awaiting Approval",
      value: summary.awaiting_approval,
      icon: CheckCircle2,
      tone: "text-amber-600",
    },
    {
      label: "Overdue RFQs",
      value: summary.overdue_count,
      icon: AlertTriangle,
      tone: summary.overdue_count > 0 ? "text-red-600" : "text-muted",
    },
    {
      label: "Quotations Sent",
      value: summary.quotations_sent,
      icon: Send,
      tone: "text-ink",
    },
    {
      label: "Won / Lost",
      value: `${summary.won_count} / ${summary.lost_count}`,
      icon: Award,
      tone: "text-success",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary">Operations Overview</h1>
            <span className="text-[11px] bg-blue-50 text-accent border border-blue-200 px-2 py-0.5 rounded font-medium">
              Demo Seeded Data Active
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Target turnaround: 4 working days (1.0 hr estimation/part benchmark).
          </p>
        </div>

        <Link
          to="/rfqs"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition"
        >
          <span>Open RFQ Register</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-white border border-border rounded p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-xs text-muted font-medium">{item.label}</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${item.tone}`}>
                  {item.value}
                </p>
              </div>
              <div className="w-10 h-10 rounded bg-canvas flex items-center justify-center">
                <Icon className={`w-5 h-5 ${item.tone}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-border rounded">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Upcoming Quotation Due Dates</h2>
            <p className="text-xs text-muted">
              Prioritized queue for machining and forging RFQs
            </p>
          </div>
          <Link to="/rfqs" className="text-xs text-accent font-medium hover:underline">
            View all RFQs
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-canvas text-[11px] font-semibold text-muted uppercase">
                <th className="py-2.5 px-4">RFQ ID</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Part Name</th>
                <th className="py-2.5 px-4">Material</th>
                <th className="py-2.5 px-4 text-right">Annual Vol.</th>
                <th className="py-2.5 px-4">Due Date</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {summary.upcoming_rfqs.map((rfq) => {
                const part = rfq.parts[0];
                return (
                  <tr key={rfq.id} className="hover:bg-canvas/50">
                    <td className="py-3 px-4 font-semibold text-primary">
                      <Link to={`/rfqs/${rfq.id}`} className="hover:underline">
                        {rfq.rfq_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-ink">{rfq.customer_name}</td>
                    <td className="py-3 px-4 text-ink font-medium">{part?.part_name}</td>
                    <td className="py-3 px-4 text-muted">{part?.material_spec}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {part?.annual_volume.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 tabular-nums">{rfq.due_date}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-canvas border border-border text-ink">
                        {rfq.status}
                      </span>
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