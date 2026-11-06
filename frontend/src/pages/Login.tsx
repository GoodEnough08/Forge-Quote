import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, AlertCircle, Lock, Mail, ArrowRight, UserCheck, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("estimator@forgequote.in");
  const [password, setPassword] = useState("Estimator@123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === "SALES_HEAD") {
        navigate("/approvals");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Authentication failed. Please check credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (role: "estimator" | "sales") => {
    if (role === "estimator") {
      setEmail("estimator@forgequote.in");
      setPassword("Estimator@123");
    } else {
      setEmail("saleshead@forgequote.in");
      setPassword("SalesHead@123");
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0E141E] flex flex-col justify-center items-center p-4">
      {/* Glow highlight */}
      <div className="w-full max-w-md bg-[#161F2E] rounded-xl border border-slate-700/80 shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-[#00EA64] to-teal-400" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-lg bg-[#00EA64]/10 border border-[#00EA64]/30 flex items-center justify-center text-[#00EA64]">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              ForgeQuote
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#00EA64]/20 text-[#00EA64] border border-[#00EA64]/30">
                PRO
              </span>
            </h1>
            <p className="text-xs text-slate-400">Precision Costing & RFQ Lifecycle System</p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-white mb-1">Sign in to Operations Portal</h2>
        <p className="text-xs text-slate-400 mb-6">
          Authorized access for Costing Estimators and Commercial Approvers.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-700 flex items-center gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1" htmlFor="email">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-900 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-[#00EA64] focus:ring-1 focus:ring-[#00EA64] placeholder-slate-500"
                placeholder="name@forgequote.in"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-900 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-[#00EA64] focus:ring-1 focus:ring-[#00EA64]"
              />
            </div>
          </div>

          {/* High-visibility HackerRank-style action button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-[#00EA64] hover:bg-[#00BD51] text-[#0E141E] font-bold text-sm rounded-lg transition-all duration-200 shadow-lg shadow-[#00EA64]/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{submitting ? "Signing in..." : "Sign In to ForgeQuote"}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        {/* Demo Fast-Login Pill Buttons */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Quick Fill Demo Accounts:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => fillDemoAccount("estimator")}
              className="text-xs py-2 px-3 border border-emerald-500/40 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Estimator</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount("sales")}
              className="text-xs py-2 px-3 border border-teal-500/40 rounded-lg bg-teal-950/40 hover:bg-teal-900/60 text-teal-300 font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Sales Head</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
