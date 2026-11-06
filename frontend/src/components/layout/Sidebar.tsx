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
} from "lucide-react";

const navItems = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "RFQ Register", to: "/rfqs", icon: FileSpreadsheet },
  { label: "Costing Workspace", to: "/costing", icon: Calculator },
  { label: "Rate Masters", to: "/rates", icon: Database },
  { label: "Approvals", to: "/approvals", icon: CheckCircle2 },
  { label: "Quote History", to: "/history", icon: History },
  { label: "Settings", to: "/settings", icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col shrink-0 min-h-screen">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
        <div className="w-9 h-9 rounded bg-primary flex items-center justify-center text-white">
          <Factory className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-primary tracking-tight text-base block leading-none">
            ForgeQuote
          </span>
          <span className="text-[11px] text-muted font-medium">
            Manufacturing RFQ Ops
          </span>
        </div>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors ${isActive
                  ? "bg-primary text-white"
                  : "text-ink hover:bg-canvas"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border bg-canvas/60">
        <p className="text-xs font-medium text-primary">From RFQ to Quote.</p>
        <p className="text-[11px] text-muted">Faster. Smarter. Traceable.</p>
      </div>
    </aside>
  );
};