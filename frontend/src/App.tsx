import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { RFQRegister } from "./pages/RFQRegister";
import { RFQDetails } from "./pages/RFQDetails";
import { CostingWorkspace } from "./pages/CostingWorkspace";
import { RateMastersPage } from "./pages/RateMastersPage";
import { AIIntakeWorkspace } from "./pages/AIIntakeWorkspace";
import { HistoricalQuotesPage } from "./pages/HistoricalQuotesPage";
import { PhasePlaceholder } from "./pages/PhasePlaceholder";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-xs text-muted">Verifying session...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="rfqs" element={<RFQRegister />} />
            <Route path="rfqs/:id" element={<RFQDetails />} />

            {/* Phase 2: Costing Workspace & Rate Masters */}
            <Route path="costing" element={<CostingWorkspace />} />
            <Route path="rates" element={<RateMastersPage />} />

            {/* Phase 3: AI-Assisted RFQ Intake & Historical Quotation Search */}
            <Route path="intake" element={<AIIntakeWorkspace />} />
            <Route path="history" element={<HistoricalQuotesPage />} />

            {/* Upcoming Phase Placeholders */}
            <Route
              path="approvals"
              element={
                <PhasePlaceholder
                  title="Sales Head Commercial Approval Inbox"
                  phase={4}
                  details="Enforcement of the ₹25,00,000 annual value threshold, margin inspection, and approve/reject/revision workflows will be implemented in Phase 4."
                />
              }
            />
            <Route
              path="settings"
              element={
                <PhasePlaceholder
                  title="System & Environment Settings"
                  phase={5}
                  details="AI extraction provider status, GST configuration assumptions, and role audit logs."
                />
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;