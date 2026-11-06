import React from "react";
import { useLocation } from "react-router-dom";
import { LogOut, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const pathSegments = location.pathname.split("/").filter(Boolean);

  return (
    <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted font-medium">ForgeQuote</span>
        {pathSegments.map((seg, i) => (
          <React.Fragment key={i}>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-ink capitalize">
              {seg === "rfqs" ? "RFQ Register" : seg === "costing" ? "Costing Workspace" : seg}
            </span>
          </React.Fragment>
        ))}
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <div className="text-xs">
              <p className="font-bold text-slate-800 leading-none">{user.full_name}</p>
              <p className="text-emerald-700 font-semibold text-[10px] mt-0.5 uppercase tracking-wider">
                {user.role}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 transition cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </header>
  );
};
