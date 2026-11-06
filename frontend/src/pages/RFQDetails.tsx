import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Check } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/rfqs"
            className="p-2 bg-white border border-border rounded hover:bg-canvas text-ink"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-primary">
              {rfq.rfq_number} — {part?.part_name}
            </h1>
            <p className="text-xs text-muted">
              Customer: {rfq.customer_name} ({rfq.industry}) • Drawing: {part?.drawing_number}
            </p>
          </div>
        </div>

        {savedBanner && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-success text-xs font-medium">
            <Check className="w-4 h-4" />
            <span>Changes saved to PostgreSQL</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white border border-border rounded p-5 space-y-4">
          <h2 className="text-sm font-semibold text-primary border-b border-border pb-2">
            Engineering & Part Specifications
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted block">Part Name</span>
              <span className="font-semibold text-ink mt-0.5 block">{part?.part_name}</span>
            </div>
            <div>
              <span className="text-muted block">Material Specification</span>
              <span className="font-semibold text-ink mt-0.5 block">{part?.material_spec}</span>
            </div>
            <div>
              <span className="text-muted block">Drawing Number</span>
              <span className="font-semibold text-ink mt-0.5 block">{part?.drawing_number}</span>
            </div>
            <div>
              <label className="text-muted block mb-1">Gross Weight (kg)</label>
              <input
                type="number"
                step="0.001"
                value={grossWeight}
                onChange={(e) => setGrossWeight(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded tabular-nums font-medium"
              />
            </div>
            <div>
              <label className="text-muted block mb-1">Annual Volume (pcs)</label>
              <input
                type="number"
                value={annualVolume}
                onChange={(e) => setAnnualVolume(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-border rounded tabular-nums font-medium"
              />
            </div>
            <div>
              <span className="text-muted block">Cycle Time / Machine Rate</span>
              <span className="font-semibold text-ink mt-1.5 block tabular-nums">
                {part?.cycle_time_minutes} min @ ₹{part?.machine_hourly_rate_inr}/hr
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              Estimator & Engineering Notes
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-xs border border-border rounded focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="bg-white border border-border rounded p-5 space-y-4">
          <h2 className="text-sm font-semibold text-primary border-b border-border pb-2">
            Workflow & Schedule
          </h2>

          <div className="text-xs space-y-3">
            <div>
              <label className="block text-muted mb-1">Current RFQ Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RFQStatus)}
                className="w-full px-2.5 py-2 border border-border rounded bg-white font-medium"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-muted block">Assigned Estimator</span>
              <span className="font-medium text-ink">{rfq.assigned_estimator_name}</span>
            </div>

            <div>
              <span className="text-muted block">Target Due Date</span>
              <span className="font-medium text-ink tabular-nums">{rfq.due_date}</span>
            </div>

            <div>
              <span className="text-muted block">Delivery Terms</span>
              <span className="font-medium text-ink">
                {rfq.delivery_requirements || "Standard Ex-Works"}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-primary text-white text-xs font-medium rounded flex items-center justify-center gap-2 hover:bg-primary/90"
          >
            <Save className="w-4 h-4" />
            <span>Save RFQ Updates</span>
          </button>
        </div>
      </form>
    </div>
  );
};