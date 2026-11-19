import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckSquare,
  Download,
  FileCheck2,
  Loader2,
  Printer,
  Search,
  Square,
} from "lucide-react";
import { api, DESC_FIELDS, type ReportResponse, type VariableRecord } from "@/lib/api";
import { governanceBadgeClass, governanceShortLabel, statusBadgeClass } from "@/lib/levels";

const DEFAULT_SAMPLE = ["Income", "HomeOwnership", "Age", "Gender", "GeographicalLocations"];

export function ReportPage() {
  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const variables = varsQ.data ?? [];
  const byId = useMemo(() => new Map(variables.map((v) => [v.id, v])), [variables]);

  const [modelName, setModelName] = useState("Modelo Score de Crédito PF — V1");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && variables.length > 0) {
      setSelectedIds(DEFAULT_SAMPLE.filter((id) => byId.has(id)));
      setInitialized(true);
    }
  }, [initialized, variables.length, byId]);

  const reportMut = useMutation({
    mutationFn: ({ ids, name }: { ids: string[]; name: string }) => api.generateReport(ids, name),
  });

  useEffect(() => {
    if (initialized) {
      reportMut.mutate({ ids: selectedIds, name: modelName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, modelName, initialized]);

  const filteredVars = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter((v) => `${v.id} ${v.label}`.toLowerCase().includes(q));
  }, [variables, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const downloadMarkdown = (report: ReportResponse) => {
    const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_governanca_v1.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (varsQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const report = reportMut.data;

  return (
    <div className="min-h-full bg-background">
      <section className="no-print border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">
                Relatório Preventivo de Governança (UC-05)
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Selecione as variáveis (*features*) que serão usadas no modelo preditivo para
                consolidar justificativas legais, riscos éticos, alertas de *proxy* e lastro
                no Schema.org.
              </p>
            </div>

            {report && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadMarkdown(report)}
                  disabled={selectedIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Exportar Markdown (.md)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={selectedIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-md border border-rule bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" /> Imprimir / PDF
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Nome do Modelo / Iniciativa
              </span>
              <input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Filtrar variáveis para seleção
              </span>
              <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ex.: Income, Age, Loan..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{selectedIds.length} selecionada(s)</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedIds(variables.map((v) => v.id))}
                  className="hover:text-foreground hover:underline"
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="hover:text-foreground hover:underline"
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-rule bg-background p-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVars.map((v) => {
                const checked = selectedIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggle(v.id)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                      checked
                        ? "border-primary bg-accent/50 font-medium text-foreground"
                        : "border-transparent hover:bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {selectedIds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule bg-surface px-6 py-16 text-center">
            <FileCheck2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-base font-medium">Nenhuma variável selecionada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Marque ao menos uma feature acima para gerar o relatório consolidado de auditoria.
            </p>
          </div>
        ) : (
          report && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard label="Features Selecionadas" value={report.summary.total} />
                <KpiCard
                  label="Veto / Governança Máxima"
                  value={report.summary.vetosOrMaxima}
                  highlight={report.summary.vetosOrMaxima > 0}
                />
                <KpiCard
                  label="Variáveis Sensíveis"
                  value={report.summary.sensiveis}
                  highlight={report.summary.sensiveis > 0}
                />
                <KpiCard label="Atuam como Proxy" value={report.summary.proxies} />
                <KpiCard
                  label="Pendentes Jurídico"
                  value={report.summary.pendentes}
                  highlight={report.summary.pendentes > 0}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-rule bg-surface shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-rule bg-surface-muted text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Variável</th>
                      <th className="px-4 py-3">Governança</th>
                      <th className="px-4 py-3">Sensível</th>
                      <th className="px-4 py-3">Atua como Proxy de</th>
                      <th className="px-4 py-3">Schema.org</th>
                      <th className="px-4 py-3">Curadoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {report.selectedVariables.map((v) => (
                      <tr key={v.id} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-mono font-semibold text-foreground">
                          <Link to={`/variables/${encodeURIComponent(v.id)}`} className="hover:underline">
                            {v.label}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${governanceBadgeClass(
                              v.nivelGovernanca,
                            )}`}
                          >
                            {governanceShortLabel(v.nivelGovernanca)}
                          </span>
                        </td>
                        <td className="px-4 py-3">{v.sensivel ? "Sim" : "Não"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {v.proxyDe.length > 0
                            ? v.proxyDe.map((p) => byId.get(p)?.label ?? p).join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {[...v.conceitosEquivalentes, ...v.conceitosBaseados].join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${statusBadgeClass(
                              v.statusCuradoria,
                            )}`}
                          >
                            {v.statusCuradoria === "Status_Auditada" ? "Auditada" : "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold">
                  Parecer Consolidado — {modelName || "Modelo de Crédito"}
                </h2>
                {report.selectedVariables.map((v) => (
                  <ReportVariableCard key={v.id} v={v} byId={byId} />
                ))}
              </div>
            </>
          )
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-rule bg-surface p-4 shadow-xs">
      <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function ReportVariableCard({
  v,
  byId,
}: {
  v: VariableRecord;
  byId: Map<string, VariableRecord>;
}) {
  const concepts = [...v.conceitosEquivalentes, ...v.conceitosBaseados];
  return (
    <article className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3">
        <div>
          <h3 className="font-mono text-lg font-bold text-foreground">{v.label}</h3>
          <p className="font-mono text-xs text-muted-foreground">
            Lastro Schema.org: {concepts.join(", ") || "Sem vínculo externo"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${governanceBadgeClass(
              v.nivelGovernanca,
            )}`}
          >
            {v.nivelLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${statusBadgeClass(
              v.statusCuradoria,
            )}`}
          >
            {v.statusLabel}
          </span>
        </div>
      </div>

      {v.inheritedAlerts.length > 0 && (
        <div className="rounded-lg border border-[oklch(0.85_0.12_45)] bg-accent/40 p-3 text-xs">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-accent-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-primary" />
            Alertas Propagados por Derivação
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {v.inheritedAlerts.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <span className="font-semibold text-foreground">Bases Legais: </span>
          <span className="text-muted-foreground">
            {v.basesLegaisLabels.join(", ") || "Não informada"}
          </span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Atua como Proxy de: </span>
          <span className="text-muted-foreground">
            {v.proxyDe.length > 0
              ? v.proxyDe.map((p) => byId.get(p)?.label ?? p).join(", ")
              : "Nenhuma ligação direta"}
          </span>
        </div>
      </div>

      <div className="grid gap-2.5 pt-1 text-sm">
        {DESC_FIELDS.map((field) => {
          const val = v.descricoes[field.key];
          if (!val) return null;
          return (
            <div key={field.key}>
              <span className="font-semibold text-foreground">{field.title}: </span>
              <span className="text-muted-foreground">{val}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
