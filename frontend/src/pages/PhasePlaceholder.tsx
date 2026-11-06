import React from "react";

export const PhasePlaceholder: React.FC<{ title: string; phase: number; details: string }> = ({
  title,
  phase,
  details,
}) => {
  return (
    <div className="bg-white border border-border rounded-xl p-8 max-w-2xl shadow-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
        Scheduled for Phase {phase}
      </span>
      <h1 className="text-xl font-bold text-slate-900 mt-4 tracking-tight">{title}</h1>
      <p className="text-xs text-muted mt-2 leading-relaxed">{details}</p>
    </div>
  );
};
