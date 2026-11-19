import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  DESC_FIELDS,
  type DescKey,
  type RiskPayload,
  type VariablePayload,
} from "@/lib/api";

const EMPTY_RISK = (): RiskPayload => ({
  descricao: "",
  nivelRisco: "Risco_Medio",
  demandaGovernanca: "",
  implicacaoLegal: "",
  basesAcionadas: [],
});

export function VariableFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const varsQ = useQuery({ queryKey: ["variables"], queryFn: api.getVariables });
  const conceptsQ = useQuery({ queryKey: ["concepts"], queryFn: api.getConcepts });
  const vocabQ = useQuery({ queryKey: ["vocabularies"], queryFn: api.getVocabularies });
  const detailQ = useQuery({
    queryKey: ["variable", id],
    queryFn: () => api.getVariable(id!),
    enabled: isEdit,
  });

  const [label, setLabel] = useState("");
  const [sensivel, setSensivel] = useState(false);
  const [statusCuradoria, setStatusCuradoria] = useState("Status_PendenteRevisaoJuridica");
  const [basesAutorizadoras, setBasesAutorizadoras] = useState<string[]>([]);
  const [conceitosEquivalentes, setConceitosEquivalentes] = useState<string[]>([]);
  const [conceitosBaseados, setConceitosBaseados] = useState<string[]>([]);
  const [proxyDe, setProxyDe] = useState<string[]>([]);
  const [derivadaDe, setDerivadaDe] = useState<string[]>([]);
  const [riscos, setRiscos] = useState<RiskPayload[]>([EMPTY_RISK()]);
  const [descricoes, setDescricoes] = useState<Record<DescKey, string>>({
    origem: "",
    justificativa_legal: "",
    explicabilidade: "",
    atuacao_proxy: "",
  });

  const [conceptSearch, setConceptSearch] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (isEdit && detailQ.data) {
      const v = detailQ.data;
      setLabel(v.label);
      setSensivel(v.sensivel);
      setStatusCuradoria(v.statusCuradoria);
      setBasesAutorizadoras(v.basesAutorizadoras);
      setConceitosEquivalentes(v.conceitosEquivalentes);
      setConceitosBaseados(v.conceitosBaseados);
      setProxyDe(v.proxyDe);
      setDerivadaDe(v.derivadaDe);
      setDescricoes({ ...v.descricoes });
      setRiscos(
        v.riscos.length > 0
          ? v.riscos.map((r) => ({
              id: r.id,
              descricao: r.descricao,
              nivelRisco: r.nivelRisco,
              demandaGovernanca: r.demandaGovernanca,
              implicacaoLegal: r.implicacaoLegal,
              basesAcionadas: [...r.basesAcionadas],
            }))
          : [],
      );
      setInitialized(true);
    } else if (!isEdit) {
      const preConcept = searchParams.get("concept");
      if (preConcept) {
        setConceitosBaseados([preConcept]);
        const shortName = preConcept.includes(":") ? preConcept.split(":")[1] : preConcept;
        setLabel(shortName);
      }
      setInitialized(true);
    }
  }, [isEdit, detailQ.data, initialized, searchParams]);

  const variables = varsQ.data ?? [];
  const otherVariables = useMemo(
    () => variables.filter((v) => v.id !== id),
    [variables, id],
  );
  const byId = useMemo(() => new Map(variables.map((v) => [v.id, v])), [variables]);

  const concepts = conceptsQ.data ?? [];
  const filteredConcepts = useMemo(() => {
    const q = conceptSearch.trim().toLowerCase();
    const selectedSet = new Set([...conceitosEquivalentes, ...conceitosBaseados]);
    return concepts
      .filter((c) => {
        if (selectedSet.has(c.curie)) return true;
        if (!q) return false;
        return `${c.curie} ${c.label} ${c.comment}`.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [concepts, conceptSearch, conceitosEquivalentes, conceitosBaseados]);

  const liveInheritedAlerts = useMemo(() => {
    const alerts: string[] = [];
    for (const parentId of derivadaDe) {
      const src = byId.get(parentId);
      if (!src) continue;
      if (src.sensivel) {
        alerts.push(`Derivada de ${src.label}: origem é Variável Sensível/Protegida.`);
      }
      if (src.nivelRiscoMaximo === "Risco_Veto" || src.nivelRiscoMaximo === "Risco_Maximo") {
        alerts.push(`Derivada de ${src.label}: origem possui ${src.nivelRiscoLabel}.`);
      }
      if (src.proxyDe.length > 0) {
        const targets = src.proxyDe.map((p) => byId.get(p)?.label ?? p).join(", ");
        alerts.push(`Derivada de ${src.label}: origem atua como proxy de ${targets}.`);
      }
    }
    return alerts;
  }, [derivadaDe, byId]);

  const toggleItem = (list: string[], setter: (next: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const updateRisk = (idx: number, patch: Partial<RiskPayload>) => {
    setRiscos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const toggleRiskBase = (idx: number, baseId: string) => {
    setRiscos((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const exists = r.basesAcionadas.includes(baseId);
        return {
          ...r,
          basesAcionadas: exists
            ? r.basesAcionadas.filter((b) => b !== baseId)
            : [...r.basesAcionadas, baseId],
        };
      }),
    );
  };

  const mutation = useMutation({
    mutationFn: (payload: VariablePayload) =>
      isEdit ? api.updateVariable(id!, payload) : api.createVariable(payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["variables"] });
      queryClient.invalidateQueries({ queryKey: ["variable", saved.id] });
      queryClient.invalidateQueries({ queryKey: ["ontology-overview"] });
      toast.success(
        isEdit ? "Variável atualizada na ontologia V2!" : "Variável cadastrada na ontologia V2!",
      );
      navigate(`/variables/${encodeURIComponent(saved.id)}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar variável.");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Informe o nome da variável.");
      return;
    }
    mutation.mutate({
      label: label.trim(),
      sensivel,
      statusCuradoria,
      basesAutorizadoras,
      conceitosEquivalentes,
      conceitosBaseados,
      proxyDe,
      derivadaDe,
      descricoes,
      riscos: riscos.filter((r) => r.descricao.trim().length > 0),
    });
  };

  if ((isEdit && detailQ.isLoading) || varsQ.isLoading || vocabQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allLegalBases = vocabQ.data?.basesLegais ?? [];

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to={isEdit ? `/variables/${encodeURIComponent(id!)}` : "/"}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-semibold">
            {isEdit ? `Auditar / Editar: ${detailQ.data?.label}` : "Cadastrar Nova Variável (V2)"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ancore a variável em conceitos do Schema.org, defina bases autorizadoras de uso e
            desmembre múltiplos nós <code className="font-mono text-xs">myont:Risco</code> (persistido
            em <code className="font-mono text-xs">semantic/data/variaveis_v2_custom.ttl</code>).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              1. Identificação e Classificação
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  Nome da Variável *
                </span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex.: Renda Mensal Comprovada ou DebtToIncomeRatio"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  Status de Curadoria Jurídica
                </span>
                <select
                  value={statusCuradoria}
                  onChange={(e) => setStatusCuradoria(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {(vocabQ.data?.statusCuradoria ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2.5 pt-1 text-sm">
              <input
                type="checkbox"
                checked={sensivel}
                onChange={(e) => setSensivel(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span>
                Classificar como <strong>Variável Sensível / Protegida</strong> (LGPD Art. 5º, II /
                CF Art. 3º, IV)
              </span>
            </label>
          </section>

          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              2. Lastro no Schema.org (Conceito Externo 1:N)
            </h2>

            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={conceptSearch}
                onChange={(e) => setConceptSearch(e.target.value)}
                placeholder="Digite para buscar conceitos do Schema.org (ex.: MonetaryAmount, birthDate, Loan)…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            {filteredConcepts.length > 0 ? (
              <div className="max-h-60 divide-y divide-rule overflow-y-auto rounded-lg border border-rule">
                {filteredConcepts.map((c) => {
                  const isEq = conceitosEquivalentes.includes(c.curie);
                  const isBase = conceitosBaseados.includes(c.curie);
                  return (
                    <div
                      key={c.curie}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="font-mono font-semibold text-foreground">{c.curie}</code>{" "}
                        <span className="text-muted-foreground">({c.tipo})</span>
                        <p className="truncate text-muted-foreground">{c.comment}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEq) {
                              setConceitosBaseados((prev) => prev.filter((x) => x !== c.curie));
                            }
                            toggleItem(conceitosEquivalentes, setConceitosEquivalentes, c.curie);
                          }}
                          className={`rounded px-2 py-1 font-medium ${
                            isEq
                              ? "bg-primary text-primary-foreground"
                              : "border border-rule bg-surface-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Equivalente
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isBase) {
                              setConceitosEquivalentes((prev) => prev.filter((x) => x !== c.curie));
                            }
                            toggleItem(conceitosBaseados, setConceitosBaseados, c.curie);
                          }}
                          className={`rounded px-2 py-1 font-medium ${
                            isBase
                              ? "bg-primary text-primary-foreground"
                              : "border border-rule bg-surface-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Baseada
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Digite um termo acima para pesquisar os {concepts.length} conceitos do Schema.org.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              3. Relações no Grafo & Autorização Legal de Uso
            </h2>

            {liveInheritedAlerts.length > 0 && (
              <div className="rounded-lg border border-[oklch(0.85_0.12_45)] bg-accent/40 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-foreground">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Alertas Preventivos Herdados da Derivação
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-foreground">
                  {liveInheritedAlerts.map((al, i) => (
                    <li key={i}>{al}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Derivada de (Feature Engineering)
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-rule p-2.5">
                  {otherVariables.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={derivadaDe.includes(v.id)}
                        onChange={() => toggleItem(derivadaDe, setDerivadaDe, v.id)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="truncate">{v.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Atua como Proxy de
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-rule p-2.5">
                  {otherVariables.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={proxyDe.includes(v.id)}
                        onChange={() => toggleItem(proxyDe, setProxyDe, v.id)}
                        className="accent-[var(--primary)]"
                      />
                      <span className="truncate">
                        {v.label} {v.sensivel ? "⚠️" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bases Legais Autorizadoras de Uso (`autorizadaPorBaseLegal`)
              </p>
              <p className="mb-2.5 text-xs text-muted-foreground">
                Selecione instrumentos ou dispositivos que legitimam a coleta/uso desta variável.
                (Normas restritivas ou violadas devem ser vinculadas dentro de cada Risco abaixo.)
              </p>
              <div className="flex flex-wrap gap-2">
                {allLegalBases.map((b) => {
                  const active = basesAutorizadoras.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        toggleItem(basesAutorizadoras, setBasesAutorizadoras, b.id)
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-rule bg-surface-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Justificativa Legal de Uso (Texto Geral)
              </span>
              <textarea
                rows={2}
                value={descricoes.justificativa_legal}
                onChange={(e) =>
                  setDescricoes((prev) => ({ ...prev, justificativa_legal: e.target.value }))
                }
                placeholder="Ex.: LGPD Art. 7º, X (Proteção ao Crédito) ou apenas identificação cadastral..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </section>

          {/* Seção 4: Nós de Risco Desmembrados */}
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  4. Riscos Mapeados (`myont:Risco` — N:M)
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cada risco possui seu próprio nível, demanda de governança, implicação legal e
                  normas restringidas/acionadas. O nível máximo da variável será calculado
                  automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRiscos((prev) => [...prev, EMPTY_RISK()])}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar Risco
              </button>
            </div>

            {riscos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-rule bg-background p-6 text-center text-xs text-muted-foreground">
                Nenhum risco adicionado ainda (adequado se o cientista estiver propondo a variável
                para futura auditoria jurídica).
              </div>
            ) : (
              <div className="space-y-4">
                {riscos.map((risk, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-rule bg-background p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">
                        Risco #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRiscos((prev) => prev.filter((_, i) => i !== idx))}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-muted-foreground">
                          Descrição do Risco / Viés
                        </span>
                        <input
                          value={risk.descricao}
                          onChange={(e) => updateRisk(idx, { descricao: e.target.value })}
                          placeholder="Ex.: Discriminação contra idosos ou exclusão de renda informal..."
                          className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-muted-foreground">
                          Nível do Risco (`NivelRisco`)
                        </span>
                        <select
                          value={risk.nivelRisco}
                          onChange={(e) => updateRisk(idx, { nivelRisco: e.target.value })}
                          className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          {(vocabQ.data?.niveisRisco ?? []).map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-muted-foreground">
                          Demanda de Governança Mitigadora
                        </span>
                        <textarea
                          rows={2}
                          value={risk.demandaGovernanca}
                          onChange={(e) => updateRisk(idx, { demandaGovernanca: e.target.value })}
                          placeholder="Controle ou monitoramento exigido para mitigar este risco..."
                          className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs outline-none focus:border-primary"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="block text-xs font-medium text-muted-foreground">
                          Implicação Legal
                        </span>
                        <textarea
                          rows={2}
                          value={risk.implicacaoLegal}
                          onChange={(e) => updateRisk(idx, { implicacaoLegal: e.target.value })}
                          placeholder="Consequência jurídica redigida pelo especialista jurídico..."
                          className="w-full rounded-md border border-input bg-surface px-3 py-2 text-xs outline-none focus:border-primary"
                        />
                      </label>
                    </div>

                    <div>
                      <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        Normas / Dispositivos Acionados ou Restringidos (`acionaBaseLegal`)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allLegalBases.map((b) => {
                          const active = risk.basesAcionadas.includes(b.id);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => toggleRiskBase(idx, b.id)}
                              className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium transition-colors ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-rule bg-surface text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {b.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              5. Demais Propriedades Textuais da Variável
            </h2>

            {DESC_FIELDS.filter((f) => f.key !== "justificativa_legal").map((field) => (
              <label key={field.key} className="block space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">
                  {field.title}
                </span>
                <textarea
                  rows={2}
                  value={descricoes[field.key]}
                  onChange={(e) =>
                    setDescricoes((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            ))}
          </section>

          <div className="flex items-center justify-end gap-3">
            <Link
              to={isEdit ? `/variables/${encodeURIComponent(id!)}` : "/"}
              className="rounded-md border border-rule bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isEdit ? "Salvar Alterações" : "Salvar na Ontologia V2"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
