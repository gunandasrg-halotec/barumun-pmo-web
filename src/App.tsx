import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./layouts/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import ProjectListPage from "./pages/projects/ProjectListPage";
import ProjectDashboardPage from "./pages/projects/ProjectDashboardPage";
import WbdPage from "./pages/wbd/WbdPage";
import WbdApprovalsPage from "./pages/wbd/WbdApprovalsPage";
import GanttPage from "./pages/analytics/GanttPage";
import ProgressListPage from "./pages/progress/ProgressListPage";
import BudgetRealizationPage from "./pages/budget/BudgetRealizationPage";
import CostListPage from "./pages/cost/CostListPage";
import FilesPage from "./pages/files/FilesPage";
import SCurvePage from "./pages/analytics/SCurvePage";
import CostAnalysisPage from "./pages/analytics/CostAnalysisPage";
import ReportsPage from "./pages/reports/ReportsPage";
import AdminPage from "./pages/admin/AdminPage";
import PublicHeavyEquipmentLogPage from "./pages/public/PublicHeavyEquipmentLogPage";
import MasterAlatBeratPage from "./pages/master/MasterAlatBeratPage";
import HeavyEquipmentUsagePage from "./pages/heavy-equipment/HeavyEquipmentUsagePage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      {/* Public — laporan alat berat dari lapangan (tanpa login, proteksi PIN) */}
      <Route path="/lapor-alat-berat" element={<PublicHeavyEquipmentLogPage />} />

      {/* Protected — all authenticated users */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Default redirect */}
        <Route index element={<Navigate to="/projects" replace />} />

        {/* Projects */}
        <Route
          path="projects"
          element={<ProjectListPage />}
          handle={{ title: "Dashboard" }}
        />
        <Route
          path="projects/:projectId/dashboard"
          element={<ProjectDashboardPage />}
        />
        <Route path="projects/:projectId/wbd" element={<WbdPage />} />
        <Route path="projects/:projectId/gantt" element={<GanttPage />} />
        <Route
          path="projects/:projectId/progress"
          element={<ProgressListPage />}
        />
        <Route path="projects/:projectId/budget-realization" element={<BudgetRealizationPage />} />
        <Route path="projects/:projectId/costs" element={<CostListPage />} />
        <Route path="projects/:projectId/files" element={<FilesPage />} />
        <Route path="projects/:projectId/s-curve" element={<SCurvePage />} />
        <Route
          path="projects/:projectId/cost-analysis"
          element={<CostAnalysisPage />}
        />
        <Route path="projects/:projectId/reports" element={<ReportsPage />} />

        {/* Penggunaan Alat Berat — analitik + data mentah */}
        <Route path="penggunaan-alat-berat" element={<HeavyEquipmentUsagePage />} />

        {/* Master alat berat + item biaya — guarded inside page */}
        <Route path="master/alat-berat" element={<MasterAlatBeratPage />} />

        {/* Admin — guarded inside AdminPage */}
        <Route path="admin" element={<AdminPage />} />

        {/* Direksi WBD Approvals — guarded inside WbdApprovalsPage */}
        <Route path="wbd-approvals" element={<WbdApprovalsPage />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Route>
    </Routes>
  );
}
