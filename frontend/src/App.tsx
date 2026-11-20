import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/auth";
import { CatalogPage } from "@/pages/CatalogPage";
import { ConceptsPage } from "@/pages/ConceptsPage";
import { LawDetailPage } from "@/pages/LawDetailPage";
import { LawFormPage } from "@/pages/LawFormPage";
import { LawsPage } from "@/pages/LawsPage";
import { LoginPage } from "@/pages/LoginPage";
import { ReportPage } from "@/pages/ReportPage";
import { VariableDetailPage } from "@/pages/VariableDetailPage";
import { VariableFormPage } from "@/pages/VariableFormPage";
import { AdminCategoriesPage } from "@/pages/admin/AdminCategoriesPage";
import { AdminLawsPage } from "@/pages/admin/AdminLawsPage";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminOverviewPage } from "@/pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { AdminVariablesPage } from "@/pages/admin/AdminVariablesPage";

function ProtectedShell() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verificando sessão...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/variables/new" element={<VariableFormPage />} />
        <Route path="/variables/:id" element={<VariableDetailPage />} />
        <Route path="/variables/:id/edit" element={<VariableFormPage />} />
        <Route path="/laws" element={<LawsPage />} />
        <Route path="/laws/new" element={<LawFormPage />} />
        <Route path="/laws/:slug" element={<LawDetailPage />} />
        <Route path="/laws/:slug/edit" element={<LawFormPage />} />
        <Route path="/concepts" element={<ConceptsPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="variables" element={<AdminVariablesPage />} />
          <Route path="laws" element={<AdminLawsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedShell />} />
    </Routes>
  );
}
