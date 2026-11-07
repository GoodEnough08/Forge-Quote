import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  History,
  Search,
  Filter,
  ArrowRight,
  GitCompare,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Sparkles,
  Layers,
  Scale,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { historyApi } from "../services/api";
import { HistoricalQuotation, HistoricalQuoteComparison } from "../types";

export const HistoricalQuotesPage: React.FC = () => {
  const [quotes, setQuotes] = useState<HistoricalQuotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [partName, setPartName] = useState<string>("");
  const [customer, setCustomer] = useState<string>("");
  const [materialGrade, setMaterialGrade] = useState<string>("");
  const [drawingNumber, setDrawingNumber] = useState<string>("");
  const [minWeight, setMinWeight] = useState<string>("");
  const [maxWeight, setMaxWeight] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [refWeight, setRefWeight] = useState<string>("");

  // Modals
  const [selectedQuote, setSelectedQuote] = useState<HistoricalQuotation | null>(null);
  const [comparisonQuotes, setComparisonQuotes] = useState<number[]>([]);
  const [comparisonData, setComparisonData] = useState<HistoricalQuoteComparison | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState<boolean>(false);

  const fetchQuotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (partName.trim()) params.part_name = partName.trim();
      if (customer.trim()) params.customer_name = customer.trim();
      if (materialGrade.trim()) params.material_grade = materialGrade.trim();
      if (drawingNumber.trim()) params.drawing_number = drawingNumber.trim();
      if (minWeight) params.min_weight = minWeight;
      if (maxWeight) params.max_weight = maxWeight;
      if (statusFilter) params.status = statusFilter;
      if (refWeight) params.reference_weight = refWeight;
      if (materialGrade) params.reference_grade = materialGrade;

      const data = await historyApi.searchQuotes(params);
      setQuotes(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load historical quotations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuotes();
  };

  const handleReset = () => {
    setPartName("");
    setCustomer("");
    setMaterialGrade("");
    setDrawingNumber("");
    setMinWeight("");
    setMaxWeight("");
    setStatusFilter("");
    setRefWeight("");
    setTimeout(() => {
      historyApi.searchQuotes({}).then(setQuotes);
    }, 50);
  };

  const handleToggleComparison = (id: number) => {
    if (comparisonQuotes.includes(id)) {
      setComparisonQuotes(comparisonQuotes.filter((qid) => qid !== id));
    } else {
      if (comparisonQuotes.length >= 2) {
        setComparisonQuotes([comparisonQuotes[1], id]);
      } else {
        setComparisonQuotes([...comparisonQuotes, id]);
      }
    }
  };

  const handleRunComparison = async () => {
    if (comparisonQuotes.length !== 2) return;
    try {
      const res = await historyApi.compareQuotes(comparisonQuotes[0], comparisonQuotes[1]);
      setComparisonData(res);
    } catch (err: any) {
      setError("Failed to run comparison between selected quotes.");
    }
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const res = await historyApi.importExcel(importFile);
      setSuccess(`Imported ${res.total_imported} legacy quotations from Excel file.`);
      setShowImportModal(false);
      setImportFile(null);
      fetchQuotes();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Excel batch import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-border rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 text-emerald-800 flex items-center justify-center">
            <History className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Historical Quotation Search & Archive</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                Phase 3
              </span>
            </h1>
            <p className="text-xs text-muted">
              Search verified past quotations, evaluate geometry similarity scores, and compare routing variances.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {comparisonQuotes.length === 2 && (
            <button
              onClick={handleRunComparison}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
            >
              <GitCompare className="w-4 h-4 stroke-[2.5]" />
              <span>Compare Selected (2)</span>
            </button>
          )}

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#172B4D] hover:bg-[#1f375e] text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Legacy Excel</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Multi-Facet Filter Bar */}
      <form onSubmit={handleSearch} className="bg-white border border-border rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>Search Filters & Similarity Matching</span>
          </h2>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Part Name / Geometry</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="e.g. Spindle, Gear Blank..."
                className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:border-[#00EA64]"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Customer Name</label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="e.g. Tata Motors, Mahindra..."
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:border-[#00EA64]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Material Grade</label>
            <input
              type="text"
              value={materialGrade}
              onChange={(e) => setMaterialGrade(e.target.value)}
              placeholder="e.g. EN8, 20MnCr5, 40Cr4..."
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:border-[#00EA64]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Reference Target Weight (kg)</label>
            <input
              type="number"
              step="0.01"
              value={refWeight}
              onChange={(e) => setRefWeight(e.target.value)}
              placeholder="Calculates proximity %"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 tabular-nums font-mono focus:border-[#00EA64]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Gross Weight Range (kg)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Min kg"
                value={minWeight}
                onChange={(e) => setMinWeight(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg tabular-nums font-mono"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="number"
                step="0.01"
                placeholder="Max kg"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg tabular-nums font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Quote Commercial Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
            >
              <option value="">All Statuses (Won, Lost, Quoted)</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
              <option value="Expired">Expired</option>
              <option value="Quoted">Quoted</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 px-4 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Apply Structured Filter</span>
            </button>
          </div>
        </div>
      </form>

      {/* Historical Quotes Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Quotation Archive Records ({quotes.length})
            </h3>
            <p className="text-xs text-muted">
              Select any two quotes to generate side-by-side variance analysis.
            </p>
          </div>

          {comparisonQuotes.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
              {comparisonQuotes.length} selected for comparison
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">Compare</th>
                <th className="py-3 px-4">Quote #</th>
                <th className="py-3 px-4">Part Description</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Weight (kg)</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                <th className="py-3 px-4">Quoted Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Similarity Match</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted">
                    No historical quotes found matching filter parameters.
                  </td>
                </tr>
              ) : (
                quotes.map((q) => {
                  const isSelected = comparisonQuotes.includes(q.id);
                  const isWon = q.status === "Won";

                  return (
                    <tr
                      key={q.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? "bg-emerald-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleComparison(q.id)}
                          className="rounded text-emerald-600 focus:ring-[#00EA64] cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{q.quote_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{q.part_name}</div>
                        <div className="text-[10px] text-muted font-mono">{q.drawing_number}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{q.customer_name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{q.material_grade}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {Number(q.gross_weight_kg).toFixed(3)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{Number(q.final_price_per_unit).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 tabular-nums">{q.quoted_date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isWon
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {q.similarity_score !== undefined && (
                          <div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                q.similarity_score >= 80
                                  ? "bg-[#00EA64]/20 text-emerald-800 border border-emerald-300"
                                  : q.similarity_score >= 50
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {q.similarity_score}% Match
                            </span>
                            {q.similarity_reasons && q.similarity_reasons.length > 0 && (
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]" title={q.similarity_reasons.join(" • ")}>
                                {q.similarity_reasons[0]}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedQuote(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Detail Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-border max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                  Historical Snapshot (Immutable)
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedQuote.quote_number} — {selectedQuote.part_name}
                </h3>
                <p className="text-xs text-muted">
                  Customer: {selectedQuote.customer_name} • Quoted: {selectedQuote.quoted_date}
                </p>
              </div>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-muted block">Material Grade</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{selectedQuote.material_grade}</span>
              </div>
              <div>
                <span className="text-muted block">Gross Weight</span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {Number(selectedQuote.gross_weight_kg).toFixed(3)} kg
                </span>
              </div>
              <div>
                <span className="text-muted block">Material Rate</span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  ₹{Number(selectedQuote.material_rate_per_kg).toFixed(2)}/kg
                </span>
              </div>
              <div>
                <span className="text-muted block">Final Price</span>
                <span className="font-bold text-emerald-700 mt-0.5 block font-mono text-sm">
                  ₹{Number(selectedQuote.final_price_per_unit).toFixed(2)}/pc
                </span>
              </div>
            </div>

            {/* Manufacturing Operations */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold uppercase tracking-wider text-slate-800">
                Manufacturing Routing Snapshot
              </h4>
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {selectedQuote.operations && selectedQuote.operations.length > 0 ? (
                  selectedQuote.operations.map((op) => (
                    <div key={op.sequence} className="p-3 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-[10px]">
                          {op.sequence}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900">{op.operation_name}</span>
                          <span className="text-muted ml-2">({op.work_center})</span>
                        </div>
                      </div>
                      <div className="font-mono text-slate-700 text-right">
                        <span>{op.cycle_time_minutes} min @ ₹{op.machine_hourly_rate}/hr</span>
                        <span className="text-slate-400 mx-1.5">•</span>
                        <span className="font-bold text-slate-900">₹{op.processing_cost}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="p-3 text-muted">No individual operations recorded.</p>
                )}
              </div>
            </div>

            {selectedQuote.notes && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <span className="font-bold block mb-0.5">Quotation Notes:</span>
                <span>{selectedQuote.notes}</span>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {comparisonData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-border max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                  Side-by-Side Variance Analysis
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Comparing {comparisonData.quote_a.quote_number} vs {comparisonData.quote_b.quote_number}
                </h3>
              </div>
              <button
                onClick={() => setComparisonData(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Key Variances Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-muted block">Unit Price Delta</span>
                <span
                  className={`font-bold mt-0.5 block font-mono text-sm ${
                    comparisonData.variances.unit_price_delta > 0 ? "text-emerald-700" : "text-slate-900"
                  }`}
                >
                  {comparisonData.variances.unit_price_delta > 0 ? "+" : ""}
                  ₹{comparisonData.variances.unit_price_delta} ({comparisonData.variances.unit_price_pct_change}%)
                </span>
              </div>
              <div>
                <span className="text-muted block">Gross Weight Delta</span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {comparisonData.variances.weight_delta_kg > 0 ? "+" : ""}
                  {comparisonData.variances.weight_delta_kg} kg
                </span>
              </div>
              <div>
                <span className="text-muted block">Material Rate Delta</span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {comparisonData.variances.material_rate_delta_per_kg > 0 ? "+" : ""}
                  ₹{comparisonData.variances.material_rate_delta_per_kg}/kg
                </span>
              </div>
              <div>
                <span className="text-muted block">Material Match</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {comparisonData.variances.material_match ? "Identical Grade" : "Different Alloy"}
                </span>
              </div>
            </div>

            {/* Comparison Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-border rounded-xl p-4 space-y-3 bg-white">
                <div className="border-b border-border pb-2">
                  <span className="font-bold text-slate-900 text-sm">{comparisonData.quote_a.part_name}</span>
                  <p className="text-[11px] text-muted">
                    {comparisonData.quote_a.quote_number} • {comparisonData.quote_a.customer_name}
                  </p>
                </div>
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted">Material:</span>
                    <span className="font-bold">{comparisonData.quote_a.material_grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Weight:</span>
                    <span>{comparisonData.quote_a.gross_weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Final Price:</span>
                    <span className="font-bold text-slate-900">₹{comparisonData.quote_a.final_price_per_unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Volume:</span>
                    <span>{comparisonData.quote_a.annual_volume.toLocaleString("en-IN")} pcs</span>
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-xl p-4 space-y-3 bg-white">
                <div className="border-b border-border pb-2">
                  <span className="font-bold text-slate-900 text-sm">{comparisonData.quote_b.part_name}</span>
                  <p className="text-[11px] text-muted">
                    {comparisonData.quote_b.quote_number} • {comparisonData.quote_b.customer_name}
                  </p>
                </div>
                <div className="space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted">Material:</span>
                    <span className="font-bold">{comparisonData.quote_b.material_grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Weight:</span>
                    <span>{comparisonData.quote_b.gross_weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Final Price:</span>
                    <span className="font-bold text-slate-900">₹{comparisonData.quote_b.final_price_per_unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Volume:</span>
                    <span>{comparisonData.quote_b.annual_volume.toLocaleString("en-IN")} pcs</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setComparisonData(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Batch Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-border max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Import Legacy Quotations (.xlsx)</span>
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportExcel} className="space-y-4 text-xs">
              <p className="text-muted">
                Select a spreadsheet containing historical quote numbers, part names, materials, weights, and unit prices.
              </p>

              <div>
                <input
                  type="file"
                  required
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-5 py-2 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold text-xs rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
                >
                  {importing ? "Importing Records..." : "Import Spreadsheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

