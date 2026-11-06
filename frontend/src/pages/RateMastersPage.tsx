import React, { useState, useEffect } from "react";
import { Plus, Database, Calendar, Check, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { ratesApi } from "../services/api";
import { MaterialRate, MachineRate } from "../types";
import { useAuth } from "../context/AuthContext";

export const RateMastersPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"materials" | "machines">("materials");
  const [materials, setMaterials] = useState<MaterialRate[]>([]);
  const [machines, setMachines] = useState<MachineRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Material form
  const [newMat, setNewMat] = useState({
    material_name: "Carbon Steel Forging Bar",
    material_grade: "EN8",
    rate_per_kg: "75.00",
    effective_from: new Date().toISOString().split("T")[0],
    effective_until: "",
  });

  // New Machine form
  const [newMach, setNewMach] = useState({
    machine_name: "CNC Turning Center 2",
    work_center: "CNC Turning",
    hourly_rate: "900.00",
    effective_from: new Date().toISOString().split("T")[0],
    effective_until: "",
  });

  const loadRates = async () => {
    setLoading(true);
    try {
      const [mats, machs] = await Promise.all([
        ratesApi.getMaterials(),
        ratesApi.getMachines(),
      ]);
      setMaterials(mats);
      setMachines(machs);
    } catch (err) {
      console.error("Failed to load rates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (activeTab === "materials") {
        await ratesApi.createMaterial({
          ...newMat,
          rate_per_kg: Number(newMat.rate_per_kg),
          effective_until: newMat.effective_until || null,
        });
        setSuccess("Material rate version added successfully!");
      } else {
        await ratesApi.createMachine({
          ...newMach,
          hourly_rate: Number(newMach.hourly_rate),
          effective_until: newMach.effective_until || null,
        });
        setSuccess("Machine hourly rate version added successfully!");
      }
      setShowModal(false);
      loadRates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "object"
          ? JSON.stringify(err.response.data)
          : "Failed to create rate. Check for overlapping effective date ranges.");
      setError(detail);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 flex items-center justify-center text-emerald-800">
              <Database className="w-4 h-4 text-emerald-700" />
            </div>
            <span>Versioned Rate Masters</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Manage effective-date-based steel bar prices, work center burden rates, and prevent date overlaps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadRates}
            className="p-2 border border-slate-300 bg-white rounded-lg hover:bg-slate-100 text-slate-700 transition cursor-pointer shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add {activeTab === "materials" ? "Material Rate" : "Machine Rate"}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold shadow-xs">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border space-x-6 text-sm">
        <button
          onClick={() => setActiveTab("materials")}
          className={`pb-3 font-bold transition-all cursor-pointer ${
            activeTab === "materials"
              ? "border-b-2 border-[#00EA64] text-slate-900"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Raw Material Masters ({materials.length})
        </button>
        <button
          onClick={() => setActiveTab("machines")}
          className={`pb-3 font-bold transition-all cursor-pointer ${
            activeTab === "machines"
              ? "border-b-2 border-[#00EA64] text-slate-900"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Machine & Work Center Masters ({machines.length})
        </button>
      </div>

      {/* Content Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted">Loading versioned rate masters...</div>
        ) : activeTab === "materials" ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-border text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Material Grade</th>
                <th className="py-3 px-4">Specification / Name</th>
                <th className="py-3 px-4 text-right">Rate (₹/kg)</th>
                <th className="py-3 px-4">Effective Range</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {materials.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-mono text-sm">{m.material_grade}</td>
                  <td className="py-3.5 px-4 text-slate-800 font-medium">{m.material_name}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums text-sm">
                    ₹{Number(m.rate_per_kg).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 tabular-nums font-medium">
                    {m.effective_from} → {m.effective_until || "Present (Open)"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      ACTIVE
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{m.created_by_name || "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-border text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Machine Center</th>
                <th className="py-3 px-4">Work Center</th>
                <th className="py-3 px-4 text-right">Hourly Rate (₹/hr)</th>
                <th className="py-3 px-4">Effective Range</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {machines.map((mach) => (
                <tr key={mach.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{mach.machine_name}</td>
                  <td className="py-3.5 px-4 text-slate-800 font-semibold">{mach.work_center}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums text-sm">
                    ₹{Number(mach.hourly_rate).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 tabular-nums font-medium">
                    {mach.effective_from} → {mach.effective_until || "Present (Open)"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      ACTIVE
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{mach.created_by_name || "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for Creating Rate */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-border w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900 mb-3.5">
              Add Versioned {activeTab === "materials" ? "Material Rate" : "Machine Rate"}
            </h2>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              {activeTab === "materials" ? (
                <>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Material Name</label>
                    <input
                      required
                      value={newMat.material_name}
                      onChange={(e) => setNewMat({ ...newMat, material_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Material Grade</label>
                    <input
                      required
                      value={newMat.material_grade}
                      onChange={(e) => setNewMat({ ...newMat, material_grade: e.target.value })}
                      placeholder="e.g. EN8, 40Cr4, 20MnCr5"
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg font-bold font-mono focus:border-[#00EA64]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Base Rate in INR (₹/kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newMat.rate_per_kg}
                      onChange={(e) => setNewMat({ ...newMat, rate_per_kg: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono font-bold focus:border-[#00EA64]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Effective From</label>
                      <input
                        type="date"
                        required
                        value={newMat.effective_from}
                        onChange={(e) => setNewMat({ ...newMat, effective_from: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Effective Until (Optional)</label>
                      <input
                        type="date"
                        value={newMat.effective_until}
                        onChange={(e) => setNewMat({ ...newMat, effective_until: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-medium"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Machine Name</label>
                    <input
                      required
                      value={newMach.machine_name}
                      onChange={(e) => setNewMach({ ...newMach, machine_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Work Center</label>
                    <input
                      required
                      value={newMach.work_center}
                      onChange={(e) => setNewMach({ ...newMach, work_center: e.target.value })}
                      placeholder="e.g. CNC Turning, Hot Forging, Grinding"
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg font-semibold focus:border-[#00EA64]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Hourly Rate in INR (₹/hr)</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={newMach.hourly_rate}
                      onChange={(e) => setNewMach({ ...newMach, hourly_rate: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-mono font-bold focus:border-[#00EA64]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Effective From</label>
                      <input
                        type="date"
                        required
                        value={newMach.effective_from}
                        onChange={(e) => setNewMach({ ...newMach, effective_from: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Effective Until (Optional)</label>
                      <input
                        type="date"
                        value={newMach.effective_until}
                        onChange={(e) => setNewMach({ ...newMach, effective_until: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-border rounded-lg tabular-nums font-medium"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end gap-2.5 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold rounded-lg shadow-sm cursor-pointer transition"
                >
                  Save Rate Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
