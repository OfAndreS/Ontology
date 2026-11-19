import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  BookOpen,
  GitBranch,
  Loader2,
  PlusCircle,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api, type VariableRecord } from "@/lib/api";
import { governanceBadgeClass, governanceShortLabel, statusBadgeClass } from "@/lib/levels";

type BucketKey = "all" | "auditadas" | "pendentes" | "sensiveis" | "proxies" | "derivadas";

export function CatalogPage() {
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<BucketKey>("all");
  const [govFilter, setGovFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [proxyOnly, setProxyOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const vocabQ = useQuery({ queryKey: ["vocabularies"], queryFn: api.getVocabularies });

  const variables = varsQ.data ?? [];
  const byId = useMemo(() => new Map(variables.map((v) => [v.id, v])), [variables]);

  const counts = useMemo(
    () => ({
      all: variables.length,
      auditadas: variables.filter((v) => v.statusCuradoria === "Status_Auditada").length,
      pendentes: variables.filter((v) => v.statusCuradoria !== "Status_Auditada").length,
      sensiveis: variables.filter((v) => v.sensivel).length,
      proxies: variables.filter((v) => v.isProxy).length,
      derivadas: variables.filter((v) => v.derivadaDe.length > 0).length,
    }),
    [variables],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return variables
      .filter((v) => {
        if (bucket === "auditadas" && v.statusCuradoria !== "Status_Auditada") return false;
        if (bucket === "pendentes" && v.statusCuradoria === "Status_Auditada") return false;
        if (bucket === "sensiveis" && !v.sensivel) return false;
        if (bucket === "proxies" && !v.isProxy) return false;
        if (bucket === "derivadas" && v.derivadaDe.length === 0) return false;

        if (sensitiveOnly && !v.sensivel) return false;
        if (proxyOnly && !v.isProxy) return false;
        if (govFilter && v.nivelGovernanca !== govFilter) return false;
        if (statusFilter && v.statusCuradoria !== statusFilter) return false;

        if (q) {
          const haystack = [
            v.id,
            v.label,
            ...v.conceitosEquivalentes,
            ...v.conceitosBaseados,
            ...v.basesLegaisLabels,
            ...Object.values(v.descricoes),
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        sortAsc
          ? a.label.localeCompare(b.label, "pt-BR")
          : b.label.localeCompare(a.label, "pt-BR"),
      );
  }, [variables, query, bucket, govFilter, statusFilter, sensitiveOnly, proxyOnly, sortAsc]);

  const activeFilters =
    (govFilter ? 1 : 0) +
    (statusFilter ? 1 : 0) +
    (sensitiveOnly ? 1 : 0) +
    (proxyOnly ? 1 : 0);

  const clearFilters = () => {
    setBucket("all");
    setGovFilter("");
    setStatusFilter("");
    setSensitiveOnly(false);
    setProxyOnly(false);
  };

  if (varsQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (varsQ.isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-destructive">
        <p>Não foi possível conectar ao backend Node.js da ontologia.</p>
      </div>
    );
  }

  const bucketItems: Array<{ key: BucketKey; label: string; count: number }> = [
    { key: "all", label: "Todas as variáveis", count: counts.all },
    { key: "auditadas", label: "Auditadas pelo Jurídico", count: counts.auditadas },
    { key: "pendentes", label: "Pendentes de Revisão", count: counts.pendentes },
    { key: "sensiveis", label: "Sensíveis / Protegidas", count: counts.sensiveis },
    { key: "proxies", label: "Atuam como Proxy", count: counts.proxies },
    { key: "derivadas", label: "Derivadas (Feature Eng.)", count: counts.derivadas },
  ];

  return (
    <div className="min-h-full bg-background text-foreground">
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
                Repositório semântico de variáveis para modelos de crédito.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                <strong>{counts.all}</strong> variáveis catalogadas na{" "}
                <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
                  MyOnt V1
                </code>{" "}
                — <strong>{counts.sensiveis}</strong> sensíveis/protegidas e{" "}
                <strong>{counts.proxies}</strong> com atuação como proxy mapeada.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/concepts"
                className="inline-flex items-center gap-2 rounded-md border border-rule bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                Explorar Schema.org
              </Link>
              <Link
                to="/variables/new"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <PlusCircle className="h-4 w-4" /> Cadastrar Variável
              </Link>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-lg border border-rule bg-background px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por variável, termo Schema.org, base legal ou risco ético…"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden rounded border border-rule px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground md:inline">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            </kbd>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
                showFilters || activeFilters > 0
                  ? "border-primary text-primary"
                  : "border-rule bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" /> Filtros
              {activeFilters > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[0.65rem] text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSensitiveOnly((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
                sensitiveOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-rule bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="h-3 w-3" /> Sensíveis / Protegidas
            </button>

            <button
              type="button"
              onClick={() => setProxyOnly((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors ${
                proxyOnly
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-rule bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3 w-3" /> Somente Proxies
            </button>

            <button
              type="button"
              onClick={() => setSortAsc((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowUpDown className="h-3 w-3" /> {sortAsc ? "A–Z" : "Z–A"}
            </button>

            {(activeFilters > 0 || bucket !== "all") && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-4 rounded-lg border border-rule bg-background p-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  Nível de Governança
                </span>
                <select
                  value={govFilter}
                  onChange={(e) => setGovFilter(e.target.value)}
                  className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Qualquer nível</option>
                  {(vocabQ.data?.niveisGovernanca ?? []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  Status de Curadoria Jurídica
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Todos os status</option>
                  {(vocabQ.data?.statusCuradoria ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-16 lg:self-start">
            <p className="mb-3 text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
              Visões do Grafo
            </p>
            <ul className="space-y-1">
              {bucketItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setBucket(item.key)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      bucket === item.key
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="font-mono text-xs">{item.count}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-lg border border-rule bg-surface-muted p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-primary" />
                Sobre a V1 (Schema.org)
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Cada variável documenta justificativa legal, risco ético, atuação como proxy e
                lastro em termos padronizados do Schema.org. Clique em uma entrada para auditar ou
                consultar detalhes.
              </p>
            </div>
          </aside>

          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">
                {bucketItems.find((b) => b.key === bucket)?.label ?? "Variáveis"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {filtered.length} de {variables.length}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-rule bg-surface px-6 py-16 text-center">
                <p className="text-lg">Nenhuma variável corresponde à busca.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tente outra palavra-chave, limpe os filtros ou cadastre uma nova variável.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface">
                {filtered.map((v) => (
                  <VariableRow key={v.id} variable={v} byId={byId} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function VariableRow({
  variable,
  byId,
}: {
  variable: VariableRecord;
  byId: Map<string, VariableRecord>;
}) {
  const concepts = [...variable.conceitosEquivalentes, ...variable.conceitosBaseados];
  const proxyNames = variable.proxyDe.map((p) => byId.get(p)?.label ?? p);

  return (
    <li>
      <Link
        to={`/variables/${encodeURIComponent(variable.id)}`}
        className="block px-5 py-4 transition-colors hover:bg-surface-muted"
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm font-semibold text-foreground">
            {variable.label}
          </code>
          <span className="feature-chip">{variable.id}</span>

          <span
            className={`rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${governanceBadgeClass(
              variable.nivelGovernanca,
            )}`}
          >
            gov: {governanceShortLabel(variable.nivelGovernanca)}
          </span>

          {variable.sensivel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.94_0.08_30)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[oklch(0.4_0.15_30)]">
              <ShieldAlert className="h-3 w-3" /> sensível
            </span>
          )}

          {variable.isProxy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent-foreground">
              <GitBranch className="h-3 w-3" /> proxy ({proxyNames.join(", ")})
            </span>
          )}

          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${statusBadgeClass(
              variable.statusCuradoria,
            )}`}
          >
            {variable.statusCuradoria === "Status_Auditada" ? "Auditada" : "Pendente"}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {variable.descricoes.risco_etico ||
            variable.descricoes.demanda_governanca ||
            variable.descricoes.justificativa_legal ||
            "Sem anotações jurídicas cadastradas ainda."}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Schema.org:{" "}
            <span className="font-mono text-foreground/80">
              {concepts.length > 0 ? concepts.join(", ") : "—"}
            </span>
          </span>
          <span>bases legais: {variable.basesLegais.length}</span>
          {variable.derivadaDe.length > 0 && (
            <span>derivada de: {variable.derivadaDe.join(", ")}</span>
          )}
        </div>
      </Link>
    </li>
  );
}
