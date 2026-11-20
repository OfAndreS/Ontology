import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  FolderTree,
  GitBranch,
  Layers,
  Loader2,
  Pencil,
  ShieldAlert,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api, DESC_FIELDS } from "@/lib/api";
import {
  riskBadgeClass,
  riskHeaderStyle,
  riskShortLabel,
  statusBadgeClass,
} from "@/lib/levels";

const FIELD_ICON = {
  origem: Tag,
  justificativa_legal: CheckCircle2,
  explicabilidade: Eye,
  atuacao_proxy: GitBranch,
} as const;

function VerticalRelationPipeline({
  topTitle,
  topItems,
  centerTitle = "2. Variável em Análise",
  centerLabel,
  centerChip,
  bottomTitle,
  bottomItems,
  highlightBottom = false,
}: {
  topTitle: string;
  topItems: Array<{ id: string; label: string }>;
  centerTitle?: string;
  centerLabel: string;
  centerChip?: string;
  bottomTitle: string;
  bottomItems: Array<{ id: string; label: string }>;
  highlightBottom?: boolean;
}) {
  return (
    <div className="relative space-y-5 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-0.5 before:bg-rule">
      <div className="relative">
        <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-rule bg-surface">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        </span>
        <p
          className={`${
            topItems.length > 0 ? "mb-1.5 " : ""
          }text-xs font-semibold uppercase tracking-wider text-muted-foreground`}
        >
          {topTitle}
        </p>
        {topItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topItems.map((item) => (
              <Link
                key={item.id}
                to={`/variables/${encodeURIComponent(item.id)}`}
                className="rounded-md border border-rule bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-surface">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          {centerTitle}
        </p>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-primary/35 bg-primary/8 px-3 py-1.5">
          <span className="text-xs font-bold text-foreground">{centerLabel}</span>
          {centerChip && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-semibold text-accent-foreground">
              {centerChip}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <span className="absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-rule bg-surface">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        </span>
        <p
          className={`${
            bottomItems.length > 0 ? "mb-1.5 " : ""
          }text-xs font-semibold uppercase tracking-wider text-muted-foreground`}
        >
          {bottomTitle}
        </p>
        {bottomItems.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bottomItems.map((item) => (
              <Link
                key={item.id}
                to={`/variables/${encodeURIComponent(item.id)}`}
                className={
                  highlightBottom
                    ? "rounded-md border border-primary/30 bg-accent/60 px-2.5 py-1 text-xs font-medium text-accent-foreground hover:border-primary"
                    : "rounded-md border border-rule bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary"
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function VariableDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const varQ = useQuery({
    queryKey: ["variable", id],
    queryFn: () => api.getVariable(id),
    enabled: Boolean(id),
  });
  const allVarsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const conceptsQ = useQuery({ queryKey: ["concepts"], queryFn: () => api.getConcepts() });
  const vocabQ = useQuery({ queryKey: ["vocabularies"], queryFn: api.getVocabularies });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteVariable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variables"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Variável excluída.");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir variável.");
    },
  });

  const byId = useMemo(
    () => new Map((allVarsQ.data ?? []).map((v) => [v.id, v])),
    [allVarsQ.data],
  );
  const conceptByCurie = useMemo(
    () => new Map((conceptsQ.data ?? []).map((c) => [c.curie, c])),
    [conceptsQ.data],
  );
  const baseVocabMap = useMemo(
    () => new Map((vocabQ.data?.bases_legais ?? []).map((b) => [b.id, b])),
    [vocabQ.data],
  );

  const getLawRoute = (baseId: string) => {
    const meta = baseVocabMap.get(baseId);
    const target = meta?.instrumento_id ?? baseId;
    return `/laws/${encodeURIComponent(target)}`;
  };

  if (varQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (varQ.isError || !varQ.data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="max-w-md text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">404</p>
          <h1 className="mt-2 text-2xl font-semibold">Variável não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta variável não existe no catálogo carregado.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para o catálogo
          </Link>
        </div>
      </div>
    );
  }

  const v = varQ.data;
  const reverseProxies = v.reverse_proxies ?? [];
  const derivedChildren = v.derived_children ?? [];
  const hasLineage = v.derivada_de.length > 0 || derivedChildren.length > 0;
  const totalConceitos = v.conceitos_equivalentes.length + v.conceitos_baseados.length;

  const copyName = () => {
    navigator.clipboard.writeText(v.label);
    setCopied(true);
    toast.success(`"${v.label}" copiado.`);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-full bg-background">
      {/* Cabeçalho Hero */}
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link to="/" className="font-medium hover:text-foreground">
                Catálogo
              </Link>
              {v.categoria_id && v.categoria_label && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <Link
                    to={`/?category=${encodeURIComponent(v.categoria_id)}`}
                    className="font-medium hover:text-foreground"
                  >
                    {v.categoria_label}
                  </Link>
                </>
              )}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/report?variable=${encodeURIComponent(v.id)}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Relatório
              </Link>
              <Link
                to={`/variables/${encodeURIComponent(v.id)}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                <Pencil className="h-3.5 w-3.5" /> Auditar / Editar
              </Link>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (window.confirm(`Deseja realmente excluir a variável "${v.label}"?`)) {
                    deleteMut.mutate();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-50"
                title="Excluir variável"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {v.label}
              </h1>
              <button
                type="button"
                onClick={copyName}
                title="Copiar nome da variável"
                aria-label="Copiar nome da variável"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-background text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${riskBadgeClass(
                  v.nivel_risco_maximo,
                )}`}
              >
                Risco Máximo: {riskShortLabel(v.nivel_risco_maximo)}
              </span>

              {v.sensivel && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.85_0.12_25)] bg-[oklch(0.94_0.08_25)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[oklch(0.40_0.20_25)]">
                  <ShieldAlert className="h-3.5 w-3.5" /> Variável sensível
                </span>
              )}

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusBadgeClass(
                  v.status_curadoria,
                )}`}
              >
                {v.status_label}
              </span>

              {v.categoria_id && v.categoria_label && (
                <Link
                  to={`/?category=${encodeURIComponent(v.categoria_id)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-background px-3 py-1 text-xs font-semibold text-foreground hover:border-primary"
                >
                  <FolderTree className="h-3.5 w-3.5 text-primary" />
                  {v.categoria_label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {v.inherited_alerts.length > 0 && (
          <section className="rounded-xl border border-[oklch(0.85_0.12_45)] bg-accent/40 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-accent-foreground">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span>Alertas herdados</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {v.inherited_alerts.map((alert, idx) => (
                <li key={idx}>{alert}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Autorização legal */}
        <section className="space-y-4 rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-[oklch(0.45_0.15_145)]" />
            <span>Autorização legal</span>
          </div>

          {v.bases_autorizadoras.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {v.bases_autorizadoras.map((bid, idx) => (
                <Link
                  key={bid}
                  to={getLawRoute(bid)}
                  className="rounded-full border border-[oklch(0.82_0.08_145)] bg-[oklch(0.96_0.03_145)] px-3 py-1 text-xs font-medium text-[oklch(0.28_0.10_145)] hover:opacity-85"
                >
                  {v.bases_autorizadoras_labels[idx] ?? bid}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma base legal autorizadora vinculada diretamente.
            </p>
          )}

          {v.descricoes.justificativa_legal && (
            <p className="whitespace-pre-line border-t border-rule pt-3 text-sm leading-relaxed text-muted-foreground">
              {v.descricoes.justificativa_legal}
            </p>
          )}
        </section>

        {/* Origem Sugerida e Explicabilidade Necessária */}
        <section className="grid gap-4 md:grid-cols-2">
          {DESC_FIELDS.filter(
            (f) => f.key === "origem" || f.key === "explicabilidade",
          ).map((field) => {
            const Icon = FIELD_ICON[field.key];
            const val = v.descricoes[field.key];
            return (
              <div
                key={field.key}
                className="rounded-xl border border-rule bg-surface p-6 shadow-xs"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{field.title}</span>
                </div>
                {val ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {val}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Não informado ainda.</p>
                )}
              </div>
            );
          })}
        </section>

        {/* Riscos */}
        <section className="space-y-4 rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span>Riscos ({v.riscos.length})</span>
          </div>

          {v.riscos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum risco cadastrado para esta variável ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {v.riscos.map((risk, idx) => {
                const headerStyle = riskHeaderStyle(risk.nivel_risco);

                return (
                  <div
                    key={risk.id}
                    className="overflow-hidden rounded-xl border border-rule bg-background"
                  >
                    <div
                      className={`grid items-center gap-1.5 border-b px-5 py-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-3 ${headerStyle.container}`}
                    >
                      <span
                        className={`justify-self-start text-xs font-bold uppercase tracking-wider ${headerStyle.title}`}
                      >
                        Risco {idx + 1}
                      </span>
                      <span
                        className={`text-xs font-bold uppercase tracking-wider sm:text-center ${headerStyle.label}`}
                      >
                        {risk.nivel_label}
                      </span>
                      <span className="hidden sm:block" aria-hidden="true" />
                    </div>

                    <div className="space-y-4 px-5 pt-4 pb-5">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {risk.descricao}
                      </p>

                      <div className="border-t border-rule pt-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Governança
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {risk.demanda_governanca || "Não informada."}
                        </p>
                      </div>

                      <div className="border-t border-rule pt-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Implicação Legal
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {risk.implicacao_legal || "Não informada."}
                        </p>
                      </div>

                      <div className="border-t border-rule pt-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Normas acionadas
                        </p>
                        {risk.bases_acionadas.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {risk.bases_acionadas.map((bid, bIdx) => (
                              <Link
                                key={bid}
                                to={getLawRoute(bid)}
                                className="rounded-full border border-[oklch(0.85_0.10_30)] bg-[oklch(0.95_0.04_30)] px-2.5 py-0.5 text-xs font-medium text-[oklch(0.38_0.16_30)] hover:opacity-85"
                              >
                                {risk.bases_acionadas_labels[bIdx] ?? bid}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Nenhuma norma específica vinculada a este risco.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Schema.org */}
        <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span>Schema.org</span>
          </div>

          {totalConceitos === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum conceito externo vinculado ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {[
                ...v.conceitos_equivalentes.map((c) => ({ curie: c, kind: "Equivalente a" })),
                ...v.conceitos_baseados.map((c) => ({ curie: c, kind: "Baseada em" })),
              ].map(({ curie, kind }) => {
                const info = conceptByCurie.get(curie);
                const fallbackUri = curie.startsWith("schema:")
                  ? `https://schema.org/${curie.slice(7)}`
                  : null;
                const externalHref = info?.uri ?? fallbackUri;
                return (
                  <div
                    key={`${kind}-${curie}`}
                    className="rounded-lg border border-rule bg-background p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="feature-chip">{kind}</span>
                        <code className="font-mono text-sm font-semibold text-foreground">
                          {curie}
                        </code>
                        {info?.tipo && (
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                            {info.tipo}
                          </span>
                        )}
                      </div>
                      {externalHref && (
                        <a
                          href={externalHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          URI oficial <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {info?.comment && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {info.comment}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Relações de Proxy + Observações */}
        <section className="space-y-5 rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              <span>Relações de Proxy</span>
            </div>
            <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Direção de Proxy
            </span>
          </div>

          <VerticalRelationPipeline
            topTitle="1. Atuam como proxy desta"
            topItems={reverseProxies}
            centerLabel={v.label}
            bottomTitle="3. Atua como proxy de"
            bottomItems={v.proxy_de.map((pid) => ({
              id: pid,
              label: byId.get(pid)?.label ?? pid,
            }))}
            highlightBottom
          />

          <div className="border-t border-rule pt-4">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Observações
            </p>
            {v.descricoes.atuacao_proxy ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {v.descricoes.atuacao_proxy}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Não informado ainda.</p>
            )}
          </div>
        </section>

        {/* Linhagem — Pipeline Vertical */}
        {hasLineage && (
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Layers className="h-4 w-4 text-primary" />
                <span>Linhagem</span>
              </div>
              <span className="feature-chip">
                {v.derivada_de.length === 0
                  ? "Atributo primário"
                  : `${v.derivada_de.length} origem(ns)`}
              </span>
            </div>

            <VerticalRelationPipeline
              topTitle="1. Origens"
              topItems={v.derivada_de.map((did) => ({
                id: did,
                label: byId.get(did)?.label ?? did,
              }))}
              centerLabel={v.label}
              centerChip={
                v.inherited_alerts.length > 0
                  ? `${v.inherited_alerts.length} alerta(s) herdado(s)`
                  : undefined
              }
              bottomTitle="3. Derivadas desta"
              bottomItems={derivedChildren}
            />
          </section>
        )}

        {/* Histórico de Alterações */}
        {v.history && v.history.length > 0 ? (
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span>Histórico de Alterações</span>
            </div>
            <ul className="divide-y divide-rule text-xs">
              {v.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <span>
                    <strong className="text-foreground">{h.action}</strong> — {h.author_name}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Sem edições registradas após a carga inicial.
          </p>
        )}
      </article>
    </div>
  );
}
