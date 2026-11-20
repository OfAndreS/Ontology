import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  FolderTree,
  GitBranch,
  Layers,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { riskBadgeClass, riskShortLabel, statusBadgeClass } from "@/lib/levels";

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get("category") ?? "";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [proxyOnly, setProxyOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(Boolean(urlCategory));
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    setCategoryFilter(urlCategory);
    if (urlCategory) {
      setShowFilters(true);
    }
  }, [urlCategory]);

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
  const vocabQ = useQuery({ queryKey: ["vocabularies"], queryFn: api.getVocabularies });

  const variables = varsQ.data ?? [];
  const categories = catsQ.data ?? [];

  const stats = useMemo(() => {
    const vetosOrMax = variables.filter(
      (v) => v.nivel_risco_maximo === "Risco_Veto" || v.nivel_risco_maximo === "Risco_Maximo",
    ).length;
    const totalRiscos = variables.reduce((acc, v) => acc + v.riscos.length, 0);
    const sensiveis = variables.filter((v) => v.sensivel).length;
    const proxies = variables.filter((v) => v.is_proxy).length;
    return { total: variables.length, vetosOrMax, totalRiscos, sensiveis, proxies };
  }, [variables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return variables
      .filter((v) => {
        if (categoryFilter && v.categoria_id !== categoryFilter) return false;
        if (riskFilter && v.nivel_risco_maximo !== riskFilter) return false;
        if (statusFilter && v.status_curadoria !== statusFilter) return false;
        if (sensitiveOnly && !v.sensivel) return false;
        if (proxyOnly && !v.is_proxy) return false;
        if (!q) return true;
        const hay = [
          v.id,
          v.label,
          v.categoria_label ?? "",
          v.descricoes.origem,
          v.descricoes.justificativa_legal,
          ...v.riscos.map((r) => `${r.descricao} ${r.implicacao_legal}`),
          ...v.conceitos_equivalentes,
          ...v.conceitos_baseados,
          ...v.bases_autorizadoras_labels,
          ...v.bases_restringidas_labels,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        sortAsc
          ? a.label.localeCompare(b.label, "pt-BR")
          : b.label.localeCompare(a.label, "pt-BR"),
      );
  }, [
    variables,
    search,
    categoryFilter,
    riskFilter,
    statusFilter,
    sensitiveOnly,
    proxyOnly,
    sortAsc,
  ]);

  const panelFiltersCount =
    (categoryFilter ? 1 : 0) + (riskFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const hasAnyFilter =
    panelFiltersCount > 0 || sensitiveOnly || proxyOnly || search.trim() !== "";

  const clearAll = () => {
    setSearch("");
    setCategoryFilter("");
    setRiskFilter("");
    setStatusFilter("");
    setSensitiveOnly(false);
    setProxyOnly(false);
    if (searchParams.has("category")) {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="min-h-full">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
                Catálogo Semântico & Riscos
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                Governança Preventiva de Variáveis de Crédito
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Consulte atributos por categoria temática, severidade de risco, autorização vs.
                restrição legal, proxies e linhagem.
              </p>
            </div>
            <Link
              to="/variables/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              Cadastrar variável
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-rule bg-background p-4">
              <p className="text-xs font-medium text-muted-foreground">Variáveis</p>
              <p className="mt-1 font-mono text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-rule bg-background p-4">
              <p className="text-xs font-medium text-muted-foreground">Riscos</p>
              <p className="mt-1 font-mono text-2xl font-bold">{stats.totalRiscos}</p>
            </div>
            <div className="rounded-xl border border-rule bg-background p-4">
              <p className="text-xs font-medium text-muted-foreground">Veto ou Máximo</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[oklch(0.45_0.18_28)]">
                {stats.vetosOrMax}
              </p>
            </div>
            <div className="rounded-xl border border-rule bg-background p-4">
              <p className="text-xs font-medium text-muted-foreground">Sensíveis / Proxies</p>
              <p className="mt-1 font-mono text-2xl font-bold">
                {stats.sensiveis}{" "}
                <span className="text-sm font-normal text-muted-foreground">/ {stats.proxies}</span>
              </p>
            </div>
          </div>

          {/* Barra de busca limpa + pills de filtro expansível */}
          <div className="mt-7 flex items-center gap-3 rounded-lg border border-rule bg-background px-4 py-3 shadow-xs focus-within:border-primary">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por variável, categoria, norma, risco ou conceito Schema.org…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <span className="hidden rounded border border-rule bg-surface px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground sm:inline">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                showFilters || panelFiltersCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-rule bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {panelFiltersCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[0.65rem] text-primary-foreground">
                  {panelFiltersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSensitiveOnly((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                sensitiveOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-rule bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Sensíveis
            </button>

            <button
              type="button"
              onClick={() => setProxyOnly((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                proxyOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-rule bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" /> Somente Proxies
            </button>

            <button
              type="button"
              onClick={() => setSortAsc((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-background px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowUpDown className="h-3.5 w-3.5" /> {sortAsc ? "A–Z" : "Z–A"}
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-4 rounded-xl border border-rule bg-background p-4 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Categoria Temática
                </span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.variable_count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Nível de Risco
                </span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Qualquer nível</option>
                  {(vocabQ.data?.niveis_risco ?? []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status de Curadoria
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Todos os status</option>
                  {(vocabQ.data?.status_curadoria ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {varsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando catálogo...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-rule bg-surface p-10 text-center">
            <p className="text-sm font-medium text-foreground">
              Nenhuma variável encontrada com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((v) => (
              <Link
                key={v.id}
                to={`/variables/${encodeURIComponent(v.id)}`}
                className="group flex flex-col justify-between rounded-xl border border-rule bg-surface p-5 shadow-xs transition-all hover:border-primary/60 hover:shadow-sm"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskBadgeClass(
                        v.nivel_risco_maximo,
                      )}`}
                    >
                      {riskShortLabel(v.nivel_risco_maximo)}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {v.sensivel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.94_0.08_30)] px-2 py-0.5 text-[0.7rem] font-semibold text-[oklch(0.40_0.15_30)]">
                          <ShieldAlert className="h-3 w-3" /> Sensível
                        </span>
                      )}
                      {v.is_proxy && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-semibold text-accent-foreground">
                          <GitBranch className="h-3 w-3" /> Proxy ({v.proxy_de.length})
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${statusBadgeClass(
                          v.status_curadoria,
                        )}`}
                      >
                        {v.status_curadoria === "Status_Auditada" ? "Auditada" : "Pendente"}
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-3 text-lg font-semibold text-foreground group-hover:text-primary">
                    {v.label}
                  </h2>

                  {v.categoria_label && (
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium text-foreground">
                        <FolderTree className="h-3 w-3 text-primary" />
                        {v.categoria_label}
                      </span>
                    </div>
                  )}

                  {v.riscos.length > 0 && (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {v.riscos.length} risco(s):
                      </span>{" "}
                      {v.riscos[0].descricao}
                    </p>
                  )}

                  {v.inherited_alerts.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-md bg-[oklch(0.96_0.05_75)] px-2.5 py-1.5 text-[0.72rem] text-[oklch(0.38_0.12_65)]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{v.inherited_alerts.length} alerta(s) propagado(s) por linhagem</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {v.conceitos_equivalentes.length + v.conceitos_baseados.length} vínculo(s)
                    Schema.org
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
