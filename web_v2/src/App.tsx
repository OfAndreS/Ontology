import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { CatalogPage } from "@/pages/CatalogPage";
import { ConceptsPage } from "@/pages/ConceptsPage";
import { ReportPage } from "@/pages/ReportPage";
import { VariableDetailPage } from "@/pages/VariableDetailPage";
import { VariableFormPage } from "@/pages/VariableFormPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/concepts" element={<ConceptsPage />} />
            <Route path="/variables/new" element={<VariableFormPage />} />
            <Route path="/variables/:id" element={<VariableDetailPage />} />
            <Route path="/variables/:id/edit" element={<VariableFormPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
