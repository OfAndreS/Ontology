import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { LegalBasePicker } from "@/components/LegalBasePicker";
import { VariableMultiPicker } from "@/components/VariableMultiPicker";
import {
  api,
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

const EMPTY_DESC: Record<DescKey, string> = {
  origem: "",
  justificativa_legal: "",
  explicabilidade: "",
  atuacao_proxy: "",
};

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
  const [riscos, setRiscos] = useState<RiskPayload[]>([]);
  const [descricoes, setDescricoes] = useState<Record<DescKey, string>>({ ...EMPTY_DESC });

  const [conceptSearch, setConceptSearch] = useState("");
  const [loadedRouteKey, setLoadedRouteKey] = useState<string | null>(null);

  const routeKey = isEdit ? `edit:${id}` : `new:${searchParams.get("concept") ?? ""}`;

  // Reseta o estado ao navegar entre /variables/new e /variables/:id/edit
  useEffect(() => {
    if (loadedRouteKey === routeKey) return;

    if (isEdit) {
      if (!detailQ.data || detailQ.data.id !== id) return;
      const v = detailQ.data;
      setLabel(v.label);
      setSensivel(v.sensivel);
      setStatusCuradoria(v.statusCuradoria);
      setBasesAutorizadoras(v.basesAutorizadoras);
      setConceitosEquivalentes(v.conceitosEquivalentes);
      setConceitosBaseados(v.conceitosBaseados);
      setProxyDe(v.proxyDe);
      setDerivadaDe(v.derivadaDe);
      setDescricoes({ ...EMPTY_DESC, ...v.descricoes });
      setRiscos(
        v.riscos.map((r) => ({
          id: r.id,
          descricao: r.descricao,
          nivelRisco: r.nivelRisco,
          demandaGovernanca: r.demandaGovernanca,
          implicacaoLegal: r.implicacaoLegal,
          basesAcionadas: [...r.basesAcionadas],
        })),
      );
      setConceptSearch("");
      setLoadedRouteKey(routeKey);
    } else {
      const preConcept = searchParams.get("concept");
      const shortName = preConcept
        ? preConcept.includes(":")
          ? preConcept.split(":")[1]
          : preConcept
        : "";
      setLabel(shortName);
      setSensivel(false);
      setStatusCuradoria("Status_PendenteRevisaoJuridica");
      setBasesAutorizadoras([]);
      setConceitosEquivalentes([]);
      setConceitosBaseados(preConcept ? [preConcept] : []);
      setProxyDe([]);
      setDerivadaDe([]);
      setRiscos([]);
      setDescricoes({ ...EMPTY_DESC });
      setConceptSearch("");
      setLoadedRouteKey(routeKey);
    }
  }, [routeKey, loadedRouteKey, isEdit, id, detailQ.data, searchParams]);

  const variables = varsQ.data ?? [];
  const otherVariables = useMemo(
    () => variables.filter((v) => v.id !== id),
    [variables, id],
  );
  const byId = useMemo(() => new Map(variables.map((v) => [v.id, v])), [variables]);

  const concepts = conceptsQ.data ?? [];
  const filteredConcepts = useMemo(() => {
    const q = conceptSearch.trim().toLowerCase();
    if (!q) return [];
    return concepts
      .filter((c) => `${c.curie} ${c.label} ${c.comment}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [concepts, conceptSearch]);

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

  const mutation = useMutation({
    mutationFn: (payload: VariablePayload) =>
      isEdit ? api.updateVariable(id!, payload) : api.createVariable(payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["variables"] });
      queryClient.invalidateQueries({ queryKey: ["variable", saved.id] });
      toast.success(isEdit ? "Variável atualizada!" : "Variável cadastrada!");
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

    for (let i = 0; i < riscos.length; i++) {
      const r = riscos[i];
      const hasAnyDetail =
        r.demandaGovernanca.trim() !== "" ||
        r.implicacaoLegal.trim() !== "" ||
        r.basesAcionadas.length > 0;
      if (hasAnyDetail && !r.descricao.trim()) {
        toast.error(`Preencha a descrição do Risco ${i + 1} ou remova o card antes de salvar.`);
        return;
      }
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
            {isEdit ? `Auditar / Editar: ${detailQ.data?.label}` : "Cadastrar Nova Variável"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha a identificação técnica da variável e, se já avaliado pelo jurídico, vincule
            bases autorizadoras e riscos mapeados.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* 1. Identificação e Atributos Básicos */}
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              1. Identificação e Atributos da Variável
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

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Origem Sugerida
              </span>
              <textarea
                rows={4}
                value={descricoes.origem}
                onChange={(e) =>
                  setDescricoes((prev) => ({ ...prev, origem: e.target.value }))
                }
                placeholder="Ex.: Titular / SCR / Bureaus / Open Finance"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Explicabilidade Necessária
              </span>
              <textarea
                rows={4}
                value={descricoes.explicabilidade}
                onChange={(e) =>
                  setDescricoes((prev) => ({ ...prev, explicabilidade: e.target.value }))
                }
                placeholder="Como justificar o impacto dessa variável na decisão..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>

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

          {/* 2. Referência no Schema.org */}
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                2. Referência Conceitual (Schema.org)
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pesquise termos para ancorar a variável como <strong>Equivalente</strong> (mesmo
                conceito) ou <strong>Baseada</strong> (adaptação de negócio).
              </p>
            </div>

            {(conceitosEquivalentes.length > 0 || conceitosBaseados.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {conceitosEquivalentes.map((curie) => (
                  <span
                    key={`eq-${curie}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    <span className="text-[0.65rem] font-bold uppercase text-primary">
                      Equivalente
                    </span>
                    <code className="font-mono">{curie}</code>
                    <button
                      type="button"
                      onClick={() =>
                        toggleItem(conceitosEquivalentes, setConceitosEquivalentes, curie)
                      }
                      className="rounded-full p-0.5 opacity-70 hover:opacity-100"
                      aria-label={`Remover ${curie}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {conceitosBaseados.map((curie) => (
                  <span
                    key={`base-${curie}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    <span className="text-[0.65rem] font-bold uppercase text-muted-foreground">
                      Baseada
                    </span>
                    <code className="font-mono">{curie}</code>
                    <button
                      type="button"
                      onClick={() => toggleItem(conceitosBaseados, setConceitosBaseados, curie)}
                      className="rounded-full p-0.5 opacity-70 hover:opacity-100"
                      aria-label={`Remover ${curie}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={conceptSearch}
                onChange={(e) => setConceptSearch(e.target.value)}
                placeholder={`Pesquisar entre ${concepts.length} conceitos do Schema.org (ex.: MonetaryAmount, birthDate, Loan)…`}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {conceptSearch && (
                <button
                  type="button"
                  onClick={() => setConceptSearch("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {conceptSearch.trim() !== "" &&
              (filteredConcepts.length > 0 ? (
                <div className="max-h-56 divide-y divide-rule overflow-y-auto rounded-lg border border-rule bg-background">
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
                                setConceitosEquivalentes((prev) =>
                                  prev.filter((x) => x !== c.curie),
                                );
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
                  Nenhum conceito encontrado para "{conceptSearch}".
                </p>
              ))}
          </section>

          {/* 3. Linhagem (Derivada de) */}
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                3. Linhagem (Derivada de)
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Para variáveis criadas por engenharia de atributos, pesquise e vincule as
                variáveis de origem para herdar alertas preventivos.
              </p>
            </div>

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

            <VariableMultiPicker
              variables={otherVariables}
              selectedIds={derivadaDe}
              onChange={setDerivadaDe}
              placeholder={`Pesquisar entre ${otherVariables.length} variáveis de origem (ex.: Income, NumberOfDebts)…`}
              actionLabel="Vincular origem"
            />
          </section>

          {/* 4. Relações de Proxy */}
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                4. Relações de Proxy
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pesquise e vincule atributos sensíveis ou protegidos que esta variável pode
                representar indiretamente.
              </p>
            </div>

            <VariableMultiPicker
              variables={otherVariables}
              selectedIds={proxyDe}
              onChange={setProxyDe}
              placeholder={`Pesquisar entre ${otherVariables.length} variáveis (ex.: Gender, Ethnicity, Age)…`}
              actionLabel="Atua como proxy"
            />

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                Atuação como Proxy (Descrição)
              </span>
              <textarea
                rows={2}
                value={descricoes.atuacao_proxy}
                onChange={(e) =>
                  setDescricoes((prev) => ({ ...prev, atuacao_proxy: e.target.value }))
                }
                placeholder="Explique de quais atributos sensíveis ou protegidos esta variável pode atuar como proxy..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </section>

          {/* 5. Autorização Legal e Riscos Mapeados */}
          <section className="rounded-xl border border-rule bg-surface p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                5. Avaliação Jurídica e Riscos
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Opcional quando a variável estiver sendo proposta como pendente de revisão jurídica.
              </p>
            </div>

            <div className="space-y-3 border-b border-rule pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bases Legais Autorizadoras de Uso
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Normas ou dispositivos que legitimam a coleta/uso desta variável.
                </p>
              </div>
              <LegalBasePicker
                options={allLegalBases}
                selectedIds={basesAutorizadoras}
                onChange={setBasesAutorizadoras}
                placeholder="+ Adicionar base legal autorizadora..."
                chipTone="auth"
              />
              <label className="block space-y-1.5 pt-1">
                <span className="block text-xs font-medium text-muted-foreground">
                  Justificativa Legal de Uso
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
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Riscos e Controles Mapeados ({riscos.length})
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    O nível máximo da variável será calculado automaticamente a partir dos riscos.
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
                <div className="rounded-lg border border-dashed border-rule bg-surface-muted/40 p-5 text-center text-xs text-muted-foreground">
                  Nenhum risco adicionado ainda. Clique em <strong>Adicionar Risco</strong> para
                  registrar um risco ético, discriminatório ou regulatório.
                </div>
              ) : (
                <div className="space-y-4">
                  {riscos.map((risk, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-rule bg-surface-muted/40 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          Risco {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRiscos((prev) => prev.filter((_, i) => i !== idx))}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                        <label className="space-y-1">
                          <span className="block text-xs font-medium text-muted-foreground">
                            Descrição do Risco / Viés *
                          </span>
                          <input
                            value={risk.descricao}
                            onChange={(e) => updateRisk(idx, { descricao: e.target.value })}
                            placeholder="Ex.: Discriminação contra idosos ou exclusão de renda informal..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="block text-xs font-medium text-muted-foreground">
                            Nível do Risco
                          </span>
                          <select
                            value={risk.nivelRisco}
                            onChange={(e) => updateRisk(idx, { nivelRisco: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
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
                            onChange={(e) =>
                              updateRisk(idx, { demandaGovernanca: e.target.value })
                            }
                            placeholder="Controle ou monitoramento exigido para mitigar este risco..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="block text-xs font-medium text-muted-foreground">
                            Implicação Legal
                          </span>
                          <textarea
                            rows={2}
                            value={risk.implicacaoLegal}
                            onChange={(e) =>
                              updateRisk(idx, { implicacaoLegal: e.target.value })
                            }
                            placeholder="Consequência jurídica redigida pelo especialista..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </label>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Normas / Dispositivos Restritivos ou Acionados
                        </p>
                        <LegalBasePicker
                          options={allLegalBases}
                          selectedIds={risk.basesAcionadas}
                          onChange={(nextIds) => updateRisk(idx, { basesAcionadas: nextIds })}
                          placeholder="+ Vincular norma ou dispositivo acionado por este risco..."
                          chipTone="risk"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              {isEdit ? "Salvar Alterações" : "Salvar Variável"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
