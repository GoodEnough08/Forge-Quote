import React from "react";
import { useLocation } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const pathSegments = location.pathname.split("/").filter(Boolean);

  return (
    <header className="h-16 bg-white border-b border-border px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">ForgeQuote</span>
        {pathSegments.map((seg, i) => (
          <React.Fragment key={i}>
            <span className="text-muted">/</span>
            <span className="font-medium text-ink capitalize">{seg}</span>
          </React.Fragment>
        ))}
      </div>

      {user && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-canvas px-3 py-1.5 rounded border border-border">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <div className="text-xs">
              <p className="font-semibold text-ink leading-none">{user.full_name}</p>
              <p className="text-muted text-[11px] mt-0.5">Role: {user.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-red-600 px-2.5 py-1.5 rounded border border-transparent hover:border-border transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </header>
  );
};