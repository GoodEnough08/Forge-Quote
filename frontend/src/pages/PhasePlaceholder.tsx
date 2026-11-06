import React from "react";

export const PhasePlaceholder: React.FC<{ title: string; phase: number; details: string }> = ({
  title,
  phase,
  details,
}) => {
  return (
    <div className="bg-white border border-border rounded p-8 max-w-2xl">
      <span className="text-xs font-semibold uppercase px-2.5 py-1 rounded bg-blue-50 text-accent border border-blue-200">
        Scheduled for Phase {phase}
      </span>
      <h1 className="text-xl font-bold text-primary mt-3">{title}</h1>
      <p className="text-xs text-muted mt-2 leading-relaxed">{details}</p>
    </div>
  );
};