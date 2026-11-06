import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, AlertCircle, Lock, Mail } from "lucide-react";
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
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-md border border-border shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-white">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">ForgeQuote</h1>
            <p className="text-xs text-muted">From RFQ to Quote. Faster. Smarter. Traceable.</p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-ink mb-1">Sign in to Operations Portal</h2>
        <p className="text-xs text-muted mb-6">
          Authorized access for Costing Estimators and Commercial Approvers.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink mb-1" htmlFor="email">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-accent"
                placeholder="name@forgequote.in"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted absolute left-3 top-2.5" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-medium text-sm rounded transition disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-xs font-medium text-muted mb-2">Quick Fill Demo Credentials:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount("estimator")}
              className="text-xs py-1.5 px-2.5 border border-border rounded bg-canvas hover:bg-gray-100 text-ink font-medium"
            >
              Estimator Account
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount("sales")}
              className="text-xs py-1.5 px-2.5 border border-border rounded bg-canvas hover:bg-gray-100 text-ink font-medium"
            >
              Sales Head Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};