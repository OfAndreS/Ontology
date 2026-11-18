import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Eye,
  FileText,
  Gavel,
  GitBranch,
  Loader2,
  Pencil,
  Scale,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { api, DESC_FIELDS } from "@/lib/api";
import { governanceBadgeClass, governanceShortLabel, statusBadgeClass } from "@/lib/levels";

const FIELD_ICON = {
  origem: Tag,
  justificativa_legal: Scale,
  risco_etico: ShieldAlert,
  demanda_governanca: BookOpen,
  explicabilidade: Eye,
  implicacao_legal: Gavel,
  atuacao_proxy: GitBranch,
} as const;

export function VariableDetailPage() {
  const { id = "" } = useParams();

  const varQ = useQuery({
    queryKey: ["variable", id],
    queryFn: () => api.getVariable(id),
    enabled: Boolean(id),
  });
  const allVarsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const conceptsQ = useQuery({ queryKey: ["concepts"], queryFn: api.getConcepts });

  const byId = useMemo(
    () => new Map((allVarsQ.data ?? []).map((v) => [v.id, v])),
    [allVarsQ.data],
  );
  const conceptByCurie = useMemo(
    () => new Map((conceptsQ.data ?? []).map((c) => [c.curie, c])),
    [conceptsQ.data],
  );

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
            Esta variável não existe na ontologia carregada.
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
  const reverseProxies = v.reverseProxies ?? [];
  const derivedChildren = v.derivedChildren ?? [];

  return (
    <div className="min-h-full bg-background">
      <article className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Link>

          <Link
            to={`/variables/${encodeURIComponent(v.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Pencil className="h-4 w-4" /> Auditar / Editar Variável
          </Link>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{v.uri}</p>
            <h1 className="mt-1 font-mono text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {v.label}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="feature-chip">{v.id}</span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${governanceBadgeClass(
                v.nivelGovernanca,
              )}`}
            >
              Governança: {governanceShortLabel(v.nivelGovernanca)}
            </span>

            {v.sensivel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.85_0.12_25)] bg-[oklch(0.94_0.08_25)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[oklch(0.40_0.20_25)]">
                <ShieldAlert className="h-3.5 w-3.5" /> Variável Sensível / Protegida
              </span>
            ) : (
              <span className="rounded-full border border-rule/60 bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Não sensível diretamente
              </span>
            )}

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusBadgeClass(
                v.statusCuradoria,
              )}`}
            >
              {v.statusLabel}
            </span>
          </div>
        </div>

        {v.inheritedAlerts.length > 0 && (
          <section className="rounded-xl border border-[oklch(0.85_0.12_45)] bg-accent/40 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-accent-foreground">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <span>Alertas Preventivos Herdados por Derivação</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
              {v.inheritedAlerts.map((alert, idx) => (
                <li key={idx}>{alert}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span>Lastro Conceitual em Ontologias Externas (Schema.org)</span>
          </div>

          {v.conceitosEquivalentes.length === 0 && v.conceitosBaseados.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum conceito externo vinculado ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {[
                ...v.conceitosEquivalentes.map((c) => ({ curie: c, kind: "Equivalente a" })),
                ...v.conceitosBaseados.map((c) => ({ curie: c, kind: "Baseada em" })),
              ].map(({ curie, kind }) => {
                const info = conceptByCurie.get(curie);
                return (
                  <div
                    key={`${kind}-${curie}`}
                    className="rounded-lg border border-rule bg-surface-muted/60 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="feature-chip">{kind}</span>
                        <code className="font-mono text-sm font-semibold text-foreground">
                          {curie}
                        </code>
                        {info && (
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                            {info.tipo}
                          </span>
                        )}
                      </div>
                      {info && (
                        <a
                          href={info.uri}
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
                    {info?.contexto && (
                      <p className="mt-1 font-mono text-[0.7rem] text-muted-foreground">
                        {info.contexto}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <Scale className="h-4 w-4 text-primary" />
            <span>Bases Legais Estruturadas</span>
          </div>
          {v.basesLegaisLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {v.basesLegaisLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="rounded-full border border-rule bg-surface-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {lbl}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma base legal vinculada.</p>
          )}
        </section>

        <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <GitBranch className="h-4 w-4 text-primary" />
            <span>Relações Semânticas de Proxy e Derivação</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Atua como Proxy de
              </p>
              {v.proxyDe.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {v.proxyDe.map((pid) => (
                    <Link
                      key={pid}
                      to={`/variables/${encodeURIComponent(pid)}`}
                      className="rounded-md border border-rule bg-accent/50 px-2.5 py-1 font-mono text-xs font-medium text-accent-foreground hover:border-primary"
                    >
                      {byId.get(pid)?.label ?? pid}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma ligação direta mapeada.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Outras variáveis que atuam como Proxy desta
              </p>
              {reverseProxies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {reverseProxies.map((rp) => (
                    <Link
                      key={rp.id}
                      to={`/variables/${encodeURIComponent(rp.id)}`}
                      className="rounded-md border border-rule bg-surface-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground hover:border-primary"
                    >
                      {rp.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma registrada.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Derivada de (Origem de Feature)
              </p>
              {v.derivadaDe.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {v.derivadaDe.map((did) => (
                    <Link
                      key={did}
                      to={`/variables/${encodeURIComponent(did)}`}
                      className="rounded-md border border-rule bg-surface-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground hover:border-primary"
                    >
                      {byId.get(did)?.label ?? did}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Variável primária (não derivada).</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Variáveis derivadas desta
              </p>
              {derivedChildren.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {derivedChildren.map((ch) => (
                    <Link
                      key={ch.id}
                      to={`/variables/${encodeURIComponent(ch.id)}`}
                      className="rounded-md border border-rule bg-surface-muted px-2.5 py-1 font-mono text-xs font-medium text-foreground hover:border-primary"
                    >
                      {ch.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma derivada cadastrada.</p>
              )}
            </div>
          </div>
        </section>

        {DESC_FIELDS.map((field) => {
          const Icon = FIELD_ICON[field.key];
          const val = v.descricoes[field.key];
          return (
            <section
              key={field.key}
              className="rounded-xl border border-rule bg-surface p-6 shadow-xs"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Icon className="h-4 w-4 text-primary" />
                <span>{field.title}</span>
              </div>
              {val ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{val}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Não informado ainda.</p>
              )}
            </section>
          );
        })}
      </article>
    </div>
  );
}
