import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckSquare,
  Copy,
  Download,
  FileCheck2,
  FileCode2,
  FileDown,
  Loader2,
  Search,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { GovernanceManualPreview } from "@/components/GovernanceManualPreview";
import { api, type ReportResponse } from "@/lib/api";
import { riskBadgeClass, riskShortLabel } from "@/lib/levels";

export function ReportPage() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("variable");
  const [modelName, setModelName] = useState("Modelo de Risco de Crédito V2");
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    preselected ? [preselected] : [],
  );
  const [search, setSearch] = useState("");
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [viewMode, setViewMode] = useState<"manual" | "markdown">("manual");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (preselected) {
      setSelectedIds((prev) => (prev.includes(preselected) ? prev : [...prev, preselected]));
    }
  }, [preselected]);

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
  const variables = varsQ.data ?? [];
  const categories = catsQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter((v) =>
      `${v.label} ${v.id} ${v.categoria_label ?? ""}`.toLowerCase().includes(q),
    );
  }, [variables, search]);

  const mutation = useMutation({
    mutationFn: () => api.generateReport(selectedIds, modelName),
    onSuccess: (data) => {
      setReport(data);
      toast.success("Relatório preventivo gerado.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar relatório.");
    },
  });

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const copyMarkdown = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.markdown);
    toast.success("Markdown copiado para a área de transferência.");
  };

  const downloadMarkdown = () => {
    if (!report) return;
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-governanca-preventiva.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setDownloadingPdf(true);
    try {
      const ids = report.selected_variables.map((v) => v.id);
      await api.downloadReportPdf(ids, modelName);
      toast.success("PDF do Manual de Governança baixado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao baixar o PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-full">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center gap-2 text-primary">
            <FileCheck2 className="h-4 w-4" />
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
              Relatório Preventivo
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold">Gerador de Relatório de Governança</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Selecione as variáveis candidatas do modelo para consolidar riscos, bases legais autorizadoras/restringidas, proxies e alertas de linhagem.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-12">
        <section className="space-y-4 rounded-xl border border-rule bg-surface p-5 lg:col-span-5">
          <div>
            <label className="block text-xs font-semibold text-foreground">Nome do Modelo</label>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Variáveis ({selectedIds.length} selecionadas)
            </span>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedIds(variables.map((v) => v.id))}
                className="text-primary hover:underline"
              >
                Selecionar todas
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-muted-foreground hover:underline"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar variáveis..."
              className="flex-1 bg-transparent text-xs outline-none"
            />
          </div>

          <div className="max-h-96 divide-y divide-rule overflow-y-auto rounded-lg border border-rule bg-background">
            {filtered.map((v) => {
              const checked = selectedIds.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(v.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-surface-muted"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {checked ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{v.label}</p>
                      <p className="truncate text-[0.7rem] text-muted-foreground">
                        {v.categoria_label ?? "Sem categoria"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${riskBadgeClass(
                      v.nivel_risco_maximo,
                    )}`}
                  >
                    {riskShortLabel(v.nivel_risco_maximo)}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={selectedIds.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-50"
          >
            {mutation.isPending ? "Gerando..." : "Gerar Relatório Preventivo"}
          </button>
        </section>

        <section className="space-y-4 rounded-xl border border-rule bg-surface p-5 lg:col-span-7">
          {!report ? (
            <div className="flex h-full min-h-72 items-center justify-center text-center text-sm text-muted-foreground">
              Selecione ao menos uma variável ao lado e clique em Gerar Relatório Preventivo.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-background p-2.5 text-xs">
                    <span className="text-muted-foreground">Selecionadas</span>
                    <p className="font-mono text-lg font-bold">{report.summary.total}</p>
                  </div>
                  <div className="rounded-lg bg-background p-2.5 text-xs">
                    <span className="text-muted-foreground">Riscos</span>
                    <p className="font-mono text-lg font-bold">{report.summary.total_riscos}</p>
                  </div>
                  <div className="rounded-lg bg-background p-2.5 text-xs">
                    <span className="text-muted-foreground">Veto/Máximo</span>
                    <p className="font-mono text-lg font-bold text-[oklch(0.45_0.18_28)]">
                      {report.summary.vetos_or_maxima}
                    </p>
                  </div>
                  <div className="rounded-lg bg-background p-2.5 text-xs">
                    <span className="text-muted-foreground">Proxies</span>
                    <p className="font-mono text-lg font-bold">{report.summary.proxies}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-rule bg-background p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode("manual")}
                      className={`inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 font-medium transition-colors ${
                        viewMode === "manual"
                          ? "bg-surface text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <BookOpen className="h-3.5 w-3.5" /> Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("markdown")}
                      className={`inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 font-medium transition-colors ${
                        viewMode === "markdown"
                          ? "bg-surface text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileCode2 className="h-3.5 w-3.5" /> Markdown
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={copyMarkdown}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar MD
                  </button>
                  <button
                    type="button"
                    onClick={downloadMarkdown}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
                  >
                    <Download className="h-3.5 w-3.5" /> Baixar .md
                  </button>
                  <button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-60"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    Baixar PDF
                  </button>
                </div>
              </div>

              {viewMode === "manual" ? (
                <GovernanceManualPreview
                  report={report}
                  modelName={modelName}
                  categories={categories}
                  allVariables={variables}
                />
              ) : (
                <pre className="max-h-[42rem] overflow-auto rounded-lg border border-rule bg-background p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                  {report.markdown}
                </pre>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
