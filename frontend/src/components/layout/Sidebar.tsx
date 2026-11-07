import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Calculator,
  Database,
  CheckCircle2,
  History,
  Settings,
  Factory,
  Sparkles,
} from "lucide-react";

const navItems = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "AI RFQ Intake", to: "/intake", icon: Sparkles },
  { label: "RFQ Register", to: "/rfqs", icon: FileSpreadsheet },
  { label: "Costing Workspace", to: "/costing", icon: Calculator },
  { label: "Rate Masters", to: "/rates", icon: Database },
  { label: "Approvals", to: "/approvals", icon: CheckCircle2 },
  { label: "Quote History", to: "/history", icon: History },
  { label: "Settings", to: "/settings", icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#0E141E] border-r border-slate-800 flex flex-col shrink-0 min-h-screen text-slate-300">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-[#00EA64]/20 border border-[#00EA64]/40 flex items-center justify-center text-[#00EA64]">
          <Factory className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-white tracking-tight text-base block leading-none flex items-center gap-1.5">
            ForgeQuote
            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-[#00EA64]/20 text-[#00EA64] font-bold">
              v2
            </span>
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            Manufacturing RFQ Ops
          </span>
        </div>
      </div>

      <nav className="p-3 space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#00EA64] text-[#0E141E] shadow-md shadow-[#00EA64]/10"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-[#00EA64] animate-pulse" />
          <p className="text-xs font-semibold text-white">System Active</p>
        </div>
        <p className="text-[11px] text-slate-400">PostgreSQL + Django Engine</p>
      </div>
    </aside>
  );
};
