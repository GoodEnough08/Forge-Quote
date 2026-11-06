import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Check, Calculator, Building, Clock } from "lucide-react";
import { api } from "../services/api";
import { RFQ, RFQStatus } from "../types";

const STATUSES: RFQStatus[] = [
  "New",
  "Estimating",
  "Awaiting Approval",
  "Approved",
  "Sent",
  "Won",
  "Lost",
];

export const RFQDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [status, setStatus] = useState<RFQStatus>("New");
  const [notes, setNotes] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [annualVolume, setAnnualVolume] = useState("");
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    api.get<RFQ>(`/rfqs/${id}`).then((res) => {
      setRfq(res.data);
      setStatus(res.data.status);
      setNotes(res.data.notes || "");
      if (res.data.parts[0]) {
        setGrossWeight(String(res.data.parts[0].gross_weight_kg));
        setAnnualVolume(String(res.data.parts[0].annual_volume));
      }
    });
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfq) return;
    const res = await api.patch<RFQ>(`/rfqs/${rfq.id}`, {
      status,
      notes,
      gross_weight_kg: Number(grossWeight),
      annual_volume: Number(annualVolume),
    });
    setRfq(res.data);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  if (!rfq) {
    return <div className="p-6 text-xs text-muted">Loading RFQ details...</div>;
  }

  const part = rfq.parts[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/rfqs"
            className="p-2.5 bg-white border border-border rounded-lg hover:bg-slate-50 text-slate-700 shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {rfq.rfq_number} — {part?.part_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                {rfq.status}
              </span>
            </div>
            <p className="text-xs text-muted">
              Customer: {rfq.customer_name} ({rfq.industry}) • Drawing: {part?.drawing_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedBanner && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Saved to Database</span>
            </div>
          )}

          <Link
            to={`/costing?rfq_id=${rfq.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition"
          >
            <Calculator className="w-4 h-4" />
            <span>Launch Costing Sheet</span>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white border border-border rounded-xl p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 border-b border-border pb-3">
            Engineering & Part Specifications
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted block font-medium">Part Name</span>
              <span className="font-bold text-slate-900 mt-1 block">{part?.part_name}</span>
            </div>
            <div>
              <span className="text-muted block font-medium">Material Specification</span>
              <span className="font-bold text-slate-900 mt-1 block">{part?.material_spec}</span>
            </div>
            <div>
              <span className="text-muted block font-medium">Drawing Number</span>
              <span className="font-mono font-bold text-slate-800 mt-1 block">{part?.drawing_number}</span>
            </div>
            <div>
              <label className="text-slate-700 block font-semibold mb-1">Gross Weight (kg)</label>
              <input
                type="number"
                step="0.001"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono font-bold focus:border-[#00EA64]"
              />
            </div>
            <div>
              <label className="text-slate-700 block font-semibold mb-1">Annual Volume (pcs)</label>
              <input
                type="number"
                value={annualVolume}
                onChange={(e) => setAnnualVolume(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono font-bold focus:border-[#00EA64]"
              />
            </div>
            <div>
              <span className="text-muted block font-medium">Cycle Time / Machine Rate</span>
              <span className="font-bold text-slate-900 mt-1.5 block tabular-nums">
                {part?.cycle_time_minutes} min @ ₹{part?.machine_hourly_rate_inr}/hr
              </span>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Estimator & Engineering Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 text-xs border border-border rounded-lg focus:outline-none focus:border-[#00EA64] focus:ring-1 focus:ring-[#00EA64]"
              placeholder="Record material grain flow requirements, ultrasonic testing specs, tolerance flags..."
            />
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 border-b border-border pb-3">
            Workflow & Schedule
          </h2>

          <div className="text-xs space-y-3.5">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Current RFQ Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RFQStatus)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-white font-bold text-slate-800 focus:border-[#00EA64]"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-muted block font-medium">Assigned Estimator</span>
              <span className="font-bold text-slate-900">{rfq.assigned_estimator_name || "Unassigned"}</span>
            </div>

            <div>
              <span className="text-muted block font-medium">Target Due Date</span>
              <span className="font-bold text-slate-900 tabular-nums">{rfq.due_date}</span>
            </div>

            <div>
              <span className="text-muted block font-medium">Delivery Terms</span>
              <span className="font-semibold text-slate-800">
                {rfq.delivery_requirements || "Standard Ex-Works"}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Save RFQ Updates</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
