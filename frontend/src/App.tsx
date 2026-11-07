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
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { SettingsPage } from "./pages/SettingsPage";

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

            {/* Phase 4: Commercial Approval Inbox & Quotations */}
            <Route path="approvals" element={<ApprovalsPage />} />

            {/* Phase 5: System & Environment Governance Settings */}
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;