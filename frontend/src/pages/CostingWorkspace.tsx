import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Calculator,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  FileCheck,
  RefreshCw,
  Info,
} from "lucide-react";
import { api, costingApi, ratesApi } from "../services/api";
import {
  CostingOperationInput,
  CostingCalculationResponse,
  CostingVolumeTier,
  MaterialRate,
  MachineRate,
  RFQ,
} from "../types";

export const CostingWorkspace: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rfqIdParam = searchParams.get("rfq_id");

  const [rfqList, setRfqList] = useState<RFQ[]>([]);
  const [selectedRfqId, setSelectedRfqId] = useState<number | string>(rfqIdParam || "");
  const [rfqDetails, setRfqDetails] = useState<RFQ | null>(null);

  // Available rates for lookup
  const [materialRates, setMaterialRates] = useState<MaterialRate[]>([]);
  const [machineRates, setMachineRates] = useState<MachineRate[]>([]);

  // Calculation Form State
  const [partId, setPartId] = useState<number | null>(null);
  const [grossWeight, setGrossWeight] = useState("0.610");
  const [materialGrade, setMaterialGrade] = useState("EN8");
  const [materialRatePerKg, setMaterialRatePerKg] = useState("72.50");
  const [selectedMaterialRateId, setSelectedMaterialRateId] = useState<number | null>(null);
  const [scrapPercentage, setScrapPercentage] = useState("5.00");

  // Routing operations
  const [operations, setOperations] = useState<CostingOperationInput[]>([
    {
      operation_name: "Cold Forging + CNC Turning",
      work_center: "CNC Turning",
      cycle_time_minutes: "3.20",
      machine_hourly_rate: "850.00",
      machine_rate_id: null,
    },
  ]);

  // Overheads and Margin
  const [labourCost, setLabourCost] = useState("5.00");
  const [overheadCost, setOverheadCost] = useState("10.00");
  const [freightCost, setFreightCost] = useState("3.00");
  const [otherCost, setOtherCost] = useState("2.00");
  const [marginPercentage, setMarginPercentage] = useState("15.00");
  const [gstPercentage, setGstPercentage] = useState("18.00");

  // Calculation result & volume tiers
  const [calculation, setCalculation] = useState<CostingCalculationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Initial Load: Load RFQs list and Rate Masters
  useEffect(() => {
    api.get("/rfqs?page_size=50").then((res) => {
      setRfqList(res.data.items);
      if (!selectedRfqId && res.data.items.length > 0) {
        setSelectedRfqId(res.data.items[0].id);
      }
    });

    ratesApi.getMaterials().then(setMaterialRates);
    ratesApi.getMachines().then(setMachineRates);
  }, []);

  // 2. When Selected RFQ changes: Fetch Part & existing costing draft or suggested defaults
  useEffect(() => {
    if (!selectedRfqId) return;

    setLoading(true);
    costingApi
      .getByRfq(selectedRfqId)
      .then((data) => {
        if (data.has_draft) {
          const sheet = data.costing_sheet;
          setPartId(sheet.part_id);
          setGrossWeight(sheet.gross_weight_kg);
          setMaterialGrade(sheet.material_grade_snapshot);
          setMaterialRatePerKg(sheet.material_rate_per_kg_snapshot);
          setScrapPercentage(sheet.scrap_percentage);
          setLabourCost(sheet.labour_cost);
          setOverheadCost(sheet.overhead_cost);
          setFreightCost(sheet.freight_cost);
          setOtherCost(sheet.other_cost);
          setMarginPercentage(sheet.margin_percentage);
          setGstPercentage(sheet.gst_percentage);

          setOperations(
            sheet.operations.map((op: any) => ({
              operation_name: op.operation_name,
              work_center: op.work_center,
              cycle_time_minutes: op.cycle_time_minutes,
              machine_hourly_rate: op.machine_hourly_rate_snapshot,
              machine_rate_id: null,
            }))
          );
        } else {
          const p = data.part;
          setPartId(p.id);
          setGrossWeight(p.gross_weight_kg);
          setMaterialGrade(p.material_spec);
          setMaterialRatePerKg(data.suggested_rates.material_rate);
          setSelectedMaterialRateId(data.suggested_rates.material_rate_id);
          setOperations([
            {
              operation_name: p.process_type,
              work_center: "CNC Turning",
              cycle_time_minutes: p.cycle_time_minutes,
              machine_hourly_rate: data.suggested_rates.machine_rate,
              machine_rate_id: data.suggested_rates.machine_rate_id,
            },
          ]);
        }
        setHasUnsavedChanges(false);
      })
      .catch((err) => {
        console.error("Error loading RFQ costing", err);
      })
      .finally(() => setLoading(false));

    api.get(`/rfqs/${selectedRfqId}`).then((res) => setRfqDetails(res.data));
  }, [selectedRfqId]);

  // 3. Trigger recalculation when relevant inputs change
  useEffect(() => {
    if (!grossWeight || Number(grossWeight) <= 0) return;

    const payload = {
      gross_weight_kg: Number(grossWeight),
      material_rate_per_kg: Number(materialRatePerKg),
      material_grade: materialGrade,
      material_rate_id: selectedMaterialRateId,
      scrap_percentage: Number(scrapPercentage),
      operations: operations.map((op) => ({
        operation_name: op.operation_name,
        work_center: op.work_center,
        cycle_time_minutes: Number(op.cycle_time_minutes),
        machine_hourly_rate: Number(op.machine_hourly_rate),
        machine_rate_id: op.machine_rate_id,
      })),
      labour_cost: Number(labourCost) || 0,
      overhead_cost: Number(overheadCost) || 0,
      freight_cost: Number(freightCost) || 0,
      other_cost: Number(otherCost) || 0,
      margin_percentage: Number(marginPercentage) || 0,
      gst_percentage: Number(gstPercentage) || 18,
    };

    costingApi
      .calculate(payload)
      .then((res) => {
        setCalculation(res);
        setErrorMsg(null);
      })
      .catch((err) => {
        setErrorMsg(err?.response?.data?.detail || "Calculation error. Check inputs.");
      });
  }, [
    grossWeight,
    materialGrade,
    materialRatePerKg,
    scrapPercentage,
    operations,
    labourCost,
    overheadCost,
    freightCost,
    otherCost,
    marginPercentage,
    gstPercentage,
  ]);

  // Operation management
  const handleAddOperation = () => {
    setOperations([
      ...operations,
      {
        operation_name: "Secondary Machining",
        work_center: "CNC Turning",
        cycle_time_minutes: "2.00",
        machine_hourly_rate: "850.00",
        machine_rate_id: null,
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveOperation = (idx: number) => {
    if (operations.length === 1) {
      alert("At least one operation is required.");
      return;
    }
    setOperations(operations.filter((_, i) => i !== idx));
    setHasUnsavedChanges(true);
  };

  const handleOperationChange = (idx: number, field: keyof CostingOperationInput, value: any) => {
    const updated = [...operations];
    updated[idx] = { ...updated[idx], [field]: value };
    setOperations(updated);
    setHasUnsavedChanges(true);
  };

  // Rate Master pickers
  const handleSelectMaterialGrade = (grade: string) => {
    setMaterialGrade(grade);
    const found = materialRates.find((m) => m.material_grade.toLowerCase() === grade.toLowerCase());
    if (found) {
      setMaterialRatePerKg(String(found.rate_per_kg));
      setSelectedMaterialRateId(found.id);
    }
    setHasUnsavedChanges(true);
  };

  const handleSaveDraft = async () => {
    if (!partId) {
      alert("No RFQ Part loaded to save draft.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        part_id: partId,
        gross_weight_kg: Number(grossWeight),
        material_rate_per_kg: Number(materialRatePerKg),
        material_grade: materialGrade,
        material_rate_id: selectedMaterialRateId,
        scrap_percentage: Number(scrapPercentage),
        operations: operations.map((op) => ({
          operation_name: op.operation_name,
          work_center: op.work_center,
          cycle_time_minutes: Number(op.cycle_time_minutes),
          machine_hourly_rate: Number(op.machine_hourly_rate),
          machine_rate_id: op.machine_rate_id,
        })),
        labour_cost: Number(labourCost) || 0,
        overhead_cost: Number(overheadCost) || 0,
        freight_cost: Number(freightCost) || 0,
        other_cost: Number(otherCost) || 0,
        margin_percentage: Number(marginPercentage) || 0,
        gst_percentage: Number(gstPercentage) || 18,
      };

      await costingApi.saveDraft(payload);
      setHasUnsavedChanges(false);
      setSaveSuccessMsg("Costing snapshot draft saved to PostgreSQL!");
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Failed to save costing draft.");
    } finally {
      setSaving(false);
    }
  };

  const part = rfqDetails?.parts[0];

  return (
    <div className="space-y-4">
      {/* Top Banner & RFQ Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary text-white flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary tracking-tight">
              Flagship Costing Workspace
            </h1>
            <p className="text-xs text-muted">
              Deterministic Python Decimal calculation sheet with 3 volume tiers & immutable snapshots.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted font-medium">Select RFQ:</span>
            <select
              value={selectedRfqId}
              onChange={(e) => setSelectedRfqId(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded bg-white font-semibold text-primary"
            >
              {rfqList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rfq_number} — {r.parts[0]?.part_name || r.customer_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold shadow-sm transition ${
              hasUnsavedChanges
                ? "bg-accent hover:bg-accent/90 text-white animate-pulse"
                : "bg-primary hover:bg-primary/90 text-white"
            } disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Snapshot..." : hasUnsavedChanges ? "Save Changes*" : "Save Draft"}</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-success text-xs rounded flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3-PANEL FLAGSHIP DESKTOP LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT PANEL (3 COLS): PART INFORMATION ================= */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-border rounded p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Part & Customer Details
              </span>
              <span className="text-[10px] bg-canvas border border-border px-1.5 py-0.5 rounded text-muted font-mono">
                {rfqDetails?.rfq_number}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-muted block text-[11px]">Part Name</span>
                <span className="font-semibold text-ink block">{part?.part_name || "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted block text-[11px]">Drawing Number</span>
                  <span className="font-mono text-ink block">{part?.drawing_number || "—"}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Customer</span>
                  <span className="text-ink font-medium block">{rfqDetails?.customer_name || "—"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted block text-[11px]">Annual Volume</span>
                  <span className="font-semibold text-ink block tabular-nums">
                    {part?.annual_volume ? part.annual_volume.toLocaleString("en-IN") : "—"} pcs
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Gross Weight</span>
                  <span className="font-semibold text-ink block tabular-nums">
                    {grossWeight} kg
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Manufacturing Routing</span>
                <span className="text-ink text-[11px] block bg-canvas p-2 rounded border border-border mt-0.5">
                  {part?.process_type || "Cold/Hot Forging + CNC Machining"}
                </span>
              </div>
            </div>
          </div>

          {/* Rate Master Source Snapshot Pill */}
          <div className="bg-blue-50/50 border border-blue-100 rounded p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-accent font-semibold text-[11px] uppercase tracking-wider">
              <Info className="w-3.5 h-3.5" />
              <span>Rate Versioning & Snapshot Source</span>
            </div>
            <p className="text-muted text-[11px] leading-relaxed">
              Base rates are snapshot on costing date. If steel prices change tomorrow in Rate Masters,
              this quotation maintains its immutable record.
            </p>
            <div className="pt-1 flex items-center justify-between text-[11px] text-ink font-medium border-t border-blue-100/80">
              <span>Active Grade: {materialGrade}</span>
              <Link to="/rates" className="text-accent hover:underline">
                View Masters →
              </Link>
            </div>
          </div>
        </div>

        {/* ================= CENTER PANEL (5 COLS): EDITABLE COST BREAKDOWN ================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-border rounded p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-bold text-primary">Editable Cost Breakdown</h2>
              <span className="text-[11px] text-muted font-medium">All amounts in INR (₹)</span>
            </div>

            {/* 1. Material & Scrap Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  1. Raw Material & Forging Scrap
                </span>
                <span className="text-xs font-semibold text-accent font-mono tabular-nums">
                  ₹{calculation?.material_cost || "0.00"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-muted block text-[11px] mb-1">Gross Wt (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={grossWeight}
                    onChange={(e) => {
                      setGrossWeight(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2.5 py-1.5 border border-border rounded font-semibold tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-muted block text-[11px] mb-1">Material Grade</label>
                  <select
                    value={materialGrade}
                    onChange={(e) => handleSelectMaterialGrade(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded bg-white text-ink font-medium"
                  >
                    {materialRates.map((m) => (
                      <option key={m.id} value={m.material_grade}>
                        {m.material_grade} (₹{m.rate_per_kg})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted block text-[11px] mb-1">Scrap (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={scrapPercentage}
                    onChange={(e) => {
                      setScrapPercentage(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2.5 py-1.5 border border-border rounded tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* 2. Machining & Processing Operations */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                    2. Machining & Processing Operations
                  </span>
                  <span className="text-[10px] text-muted">
                    Formula: (Cycle Time / 60) × Machine Hourly Rate
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddOperation}
                  className="inline-flex items-center gap-1 text-[11px] text-accent font-medium hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </button>
              </div>

              <div className="space-y-2">
                {operations.map((op, idx) => (
                  <div
                    key={idx}
                    className="bg-canvas border border-border rounded p-2.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        value={op.operation_name}
                        onChange={(e) =>
                          handleOperationChange(idx, "operation_name", e.target.value)
                        }
                        placeholder="Operation Name"
                        className="px-2 py-1 bg-white border border-border rounded text-xs font-medium w-2/3"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOperation(idx)}
                        className="text-muted hover:text-red-600 transition p-1"
                        title="Delete operation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted block mb-0.5">Work Center</label>
                        <select
                          value={op.work_center}
                          onChange={(e) => {
                            const wc = e.target.value;
                            const matched = machineRates.find((m) => m.work_center === wc);
                            handleOperationChange(idx, "work_center", wc);
                            if (matched) {
                              handleOperationChange(
                                idx,
                                "machine_hourly_rate",
                                String(matched.hourly_rate)
                              );
                              handleOperationChange(idx, "machine_rate_id", matched.id);
                            }
                          }}
                          className="w-full px-1.5 py-1 bg-white border border-border rounded text-[11px]"
                        >
                          {machineRates.map((m) => (
                            <option key={m.id} value={m.work_center}>
                              {m.work_center}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted block mb-0.5">Cycle Time (min)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={op.cycle_time_minutes}
                          onChange={(e) =>
                            handleOperationChange(idx, "cycle_time_minutes", e.target.value)
                          }
                          className="w-full px-2 py-1 bg-white border border-border rounded tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-muted block mb-0.5">Rate (₹/hr)</label>
                        <input
                          type="number"
                          step="1"
                          value={op.machine_hourly_rate}
                          onChange={(e) =>
                            handleOperationChange(idx, "machine_hourly_rate", e.target.value)
                          }
                          className="w-full px-2 py-1 bg-white border border-border rounded tabular-nums font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-1 font-semibold text-ink">
                <span>Total Processing Cost:</span>
                <span className="font-mono text-accent">
                  ₹{calculation?.total_processing_cost || "0.00"}
                </span>
              </div>
            </div>

            {/* 3. Labour, Overheads & Logistics */}
            <div className="space-y-3 pt-3 border-t border-border">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                3. Direct Costs, Overhead & Freight
              </span>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="text-muted block text-[10px] mb-1">Labour (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={labourCost}
                    onChange={(e) => {
                      setLabourCost(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-muted block text-[10px] mb-1">Overhead (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={overheadCost}
                    onChange={(e) => {
                      setOverheadCost(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-muted block text-[10px] mb-1">Freight (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={freightCost}
                    onChange={(e) => {
                      setFreightCost(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-muted block text-[10px] mb-1">Other (₹)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={otherCost}
                    onChange={(e) => {
                      setOtherCost(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2 py-1.5 border border-border rounded tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* 4. Commercial Margin & Taxes */}
            <div className="space-y-3 pt-3 border-t border-border">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                4. Margin & GST Parameters
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-muted block text-[11px] mb-1">Target Margin (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={marginPercentage}
                    onChange={(e) => {
                      setMarginPercentage(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2.5 py-1.5 border border-border rounded tabular-nums font-semibold"
                  />
                </div>
                <div>
                  <label className="text-muted block text-[11px] mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={gstPercentage}
                    onChange={(e) => {
                      setGstPercentage(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2.5 py-1.5 border border-border rounded tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT PANEL (4 COLS): STICKY QUOTATION SUMMARY ================= */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <div className="bg-white border border-border rounded p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-success" />
                <span>Quotation Summary</span>
              </h2>
              <span className="text-[10px] font-semibold text-success bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                LIVE CALC
              </span>
            </div>

            {/* Per-Unit Price Breakdown */}
            <div className="space-y-2 text-xs divide-y divide-border">
              <div className="flex justify-between py-1.5">
                <span className="text-muted">Raw Material Cost:</span>
                <span className="font-mono text-ink tabular-nums">
                  ₹{calculation?.material_cost || "0.00"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted">Total Processing (Machining):</span>
                <span className="font-mono text-ink tabular-nums">
                  ₹{calculation?.total_processing_cost || "0.00"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted">Labour + Overheads + Logistics:</span>
                <span className="font-mono text-ink tabular-nums">
                  ₹{((Number(labourCost) || 0) + (Number(overheadCost) || 0) + (Number(freightCost) || 0) + (Number(otherCost) || 0)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-2 font-semibold bg-canvas px-2 rounded">
                <span className="text-primary">Manufacturing Subtotal:</span>
                <span className="font-mono text-primary tabular-nums">
                  ₹{calculation?.manufacturing_subtotal || "0.00"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted">Commercial Margin ({marginPercentage}%):</span>
                <span className="font-mono text-emerald-700 font-semibold tabular-nums">
                  + ₹{calculation?.margin_amount || "0.00"}
                </span>
              </div>

              {/* Final Quotation Price (Per Unit) */}
              <div className="pt-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-primary">Final Price / Unit (excl. GST):</span>
                  <span className="text-lg font-bold font-mono text-primary tabular-nums">
                    ₹{calculation?.final_price_per_unit || "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-muted mt-1">
                  <span>Applicable GST (18%):</span>
                  <span className="tabular-nums">₹{calculation?.gst_amount || "0.00"}</span>
                </div>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>Landed Price with GST:</span>
                  <span className="font-semibold text-ink tabular-nums">
                    ₹{calculation?.total_price_with_gst_per_unit || "0.00"}
                  </span>
                </div>
              </div>
            </div>

            {/* Multi-Volume Tier Calculations Section */}
            <div className="pt-4 border-t border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-accent" />
                  <span>Volume Tier Comparison</span>
                </span>
                <span className="text-[10px] text-muted">3 Batch Tiers</span>
              </div>

              <div className="space-y-2">
                {calculation?.volume_tiers?.map((tier) => (
                  <div
                    key={tier.quantity}
                    className="p-2.5 rounded bg-canvas border border-border text-xs space-y-1 hover:border-accent transition"
                  >
                    <div className="flex items-center justify-between font-bold text-primary">
                      <span>{tier.quantity.toLocaleString("en-IN")} units</span>
                      <span className="font-mono text-accent tabular-nums">
                        ₹{tier.quotation_price_per_unit} / unit
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-muted">
                      <span>Total Quotation Value:</span>
                      <span className="font-semibold text-ink font-mono tabular-nums">
                        ₹{Number(tier.total_quotation_value).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-muted">
                      <span>GST: ₹{Number(tier.total_gst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span>
                        Grand Total: ₹{Number(tier.grand_total_with_gst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

