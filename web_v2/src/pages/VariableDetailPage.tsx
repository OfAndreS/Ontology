import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
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
import { riskBadgeClass, riskShortLabel, statusBadgeClass } from "@/lib/levels";

const FIELD_ICON = {
  origem: Tag,
  justificativa_legal: Scale,
  explicabilidade: Eye,
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
            Esta variável não existe na ontologia V2 carregada.
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
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${riskBadgeClass(
                v.nivelRiscoMaximo,
              )}`}
            >
              Risco Máximo (Derivado): {riskShortLabel(v.nivelRiscoMaximo)}
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

        {/* Autorização de Uso (Papel Autorizador na Variável) */}
        <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-[oklch(0.45_0.15_145)]" />
              <span>Autorização de Uso (`autorizadaPorBaseLegal`)</span>
            </div>
            <span className="font-mono text-[0.7rem] text-muted-foreground">
              Variável → BaseLegal
            </span>
          </div>

          {v.basesAutorizadorasLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {v.basesAutorizadorasLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="rounded-full border border-[oklch(0.82_0.08_145)] bg-[oklch(0.96_0.03_145)] px-3 py-1 text-xs font-medium text-[oklch(0.28_0.10_145)]"
                >
                  {lbl}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma base legal autorizadora vinculada diretamente.
            </p>
          )}

          {v.descricoes.justificativa_legal && (
            <div className="rounded-lg border border-rule bg-background p-3">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Justificativa Legal de Uso
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {v.descricoes.justificativa_legal}
              </p>
            </div>
          )}
        </section>

        {/* Riscos Mapeados (Nós myont:Risco desmembrados) */}
        <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span>Riscos Mapeados ({v.riscos.length})</span>
            </div>
            <span className="font-mono text-[0.7rem] text-muted-foreground">
              Variável → possuiRisco → myont:Risco
            </span>
          </div>

          {v.riscos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum nó de risco cadastrado para esta variável ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {v.riscos.map((risk, idx) => (
                <div
                  key={risk.id}
                  className="rounded-xl border border-rule bg-background p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[0.7rem] text-muted-foreground">
                        Risco #{idx + 1} · {risk.id}
                      </span>
                      <h3 className="mt-0.5 text-sm font-semibold text-foreground">
                        {risk.descricao}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${riskBadgeClass(
                        risk.nivelRisco,
                      )}`}
                    >
                      {risk.nivelLabel}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-rule bg-surface-muted/50 p-3">
                      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5 text-primary" />
                        Demanda de Governança Mitigadora
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground">
                        {risk.demandaGovernanca || "Não informada."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-rule bg-surface-muted/50 p-3">
                      <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Gavel className="h-3.5 w-3.5 text-primary" />
                        Implicação Legal
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground">
                        {risk.implicacaoLegal || "Não informada."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Scale className="h-3.5 w-3.5 text-primary" />
                      Normas / Dispositivos Acionados ou Restringidos (`acionaBaseLegal`)
                    </p>
                    {risk.basesAcionadasLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {risk.basesAcionadasLabels.map((lbl) => (
                          <span
                            key={lbl}
                            className="rounded-full border border-[oklch(0.85_0.10_30)] bg-[oklch(0.95_0.04_30)] px-2.5 py-0.5 text-xs font-medium text-[oklch(0.38_0.16_30)]"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma norma específica vinculada a este risco.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lastro Externo (Schema.org) */}
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

        {/* Relações Semânticas de Proxy e Derivação */}
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

        {/* Demais atributos descritivos da Variável */}
        {DESC_FIELDS.filter((f) => f.key !== "justificativa_legal").map((field) => {
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
