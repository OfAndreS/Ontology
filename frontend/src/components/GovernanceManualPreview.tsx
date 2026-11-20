import { useMemo } from "react";
import type { CategoryRecord, ReportResponse, VariableRecord } from "@/lib/api";

const DEFAULT_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Institucional e Financeiro":
    "O núcleo do modelo de risco: variáveis com nexo causal direto e comprovado com a capacidade de pagamento.",
  "Financeiro Corporativo (PJ)":
    "Indicadores contábeis e financeiros corporativos voltados à avaliação de solvência de pessoa jurídica.",
  Socioeconômico:
    "Variáveis legítimas em tese, mas que exigem cautela para evitar reconstrução indireta de classe ou renda informal.",
  Demográfico:
    "Atributos pessoais e territoriais com alto potencial de atuar como proxy de grupos protegidos.",
  Educacional:
    "Indicadores de escolaridade e formação acadêmica que demandam calibração contra viés socioeconômico.",
  "Valores, Atitudes e Comportamento":
    "Dados derivados de hábitos e comportamento financeiro: úteis estatisticamente, mas com nexo causal sensível.",
  Situacional:
    "Eventos de vida e contextos temporários que exigem revisão humana e proteção contra penalização crônica.",
  Personalidade:
    "Atributos psicométricos e comportamentais com elevado risco de medicalização ou discriminação indireta.",
  Saúde:
    "Dados clínicos e de saúde física ou mental protegidos por vedação legal estrita contra discriminação.",
  "Dados Alternativos":
    "Pegada digital, redes sociais e metadados de dispositivo com forte risco de redlining digital.",
  Macroeconômico:
    "Variáveis conjunturais e setoriais externas ao indivíduo para ajuste de cenário econômico.",
};

const DEFAULT_CONFORMITY_GOALS: Array<{ tab: string; body: string }> = [
  {
    tab: "ART. 20 · LGPD",
    body: "Explicar substitui recusar sem explicação. Toda negativa ou revisão de crédito precisa fazer sentido para o titular e permitir contestação.",
  },
  {
    tab: "RES. BCB 303 · CMN 4.966",
    body: "Se a auditoria e o Banco Central não conseguem rastrear e auditar a variável, ela não entra no núcleo decisório do modelo.",
  },
  {
    tab: "CDC 54-D · LEI 14.181",
    body: "Avaliar capacidade de pagamento de forma responsável é dever legal. Prevenir o superendividamento faz parte da governança do modelo.",
  },
  {
    tab: "ART. 6, IX · LGPD",
    body: "Proxy também é discriminação: variável neutra na forma, mas discriminatória no efeito estatístico, exige mitigação ou veto.",
  },
];

type VariableStatus = "APROVADO" | "RESTRITO" | "ADAPTADO" | "VETADO";

function classifyStatus(v: VariableRecord): VariableStatus {
  if (v.nivel_risco_maximo === "Risco_Veto") return "VETADO";
  if (
    v.derivada_de.length > 0 &&
    (v.nivel_risco_maximo === "Risco_Baixo" || v.nivel_risco_maximo === "Risco_Medio")
  ) {
    return "ADAPTADO";
  }
  if (
    v.nivel_risco_maximo === "Risco_Maximo" ||
    v.nivel_risco_maximo === "Risco_Alto" ||
    v.nivel_risco_maximo === "Risco_Medio" ||
    v.sensivel ||
    v.is_proxy
  ) {
    return "RESTRITO";
  }
  return "APROVADO";
}

function statusPillClasses(status: VariableStatus): string {
  switch (status) {
    case "APROVADO":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "VETADO":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "ADAPTADO":
    case "RESTRITO":
    default:
      return "bg-[#FEF3C7] text-[#92400E]";
  }
}

function formatLegalBasis(v: VariableRecord): string {
  const bases = Array.from(
    new Set([...v.bases_autorizadoras_labels, ...v.bases_restringidas_labels].filter(Boolean)),
  );
  if (bases.length > 0) return bases.slice(0, 4).join("; ");
  if (v.descricoes.justificativa_legal) return v.descricoes.justificativa_legal;
  return "Análise jurídica pendente";
}

function formatProxyAndRisk(v: VariableRecord, labelsById: Map<string, string>): string {
  const parts: string[] = [];
  if (v.proxy_de.length > 0) {
    const targets = v.proxy_de.map((id) => labelsById.get(id) ?? id).join(", ");
    parts.push(`Proxy de: ${targets}.`);
  }
  if (v.descricoes.atuacao_proxy) {
    parts.push(v.descricoes.atuacao_proxy.trim());
  }
  if (v.riscos.length > 0) {
    for (const r of v.riscos.slice(0, 2)) {
      const desc = r.descricao.trim().replace(/\.$/, "");
      if (r.demanda_governanca) {
        const dem = r.demanda_governanca.trim().replace(/\.$/, "");
        parts.push(`${desc} (${dem}).`);
      } else {
        parts.push(`${desc}.`);
      }
    }
  } else if (v.descricoes.justificativa_legal && parts.length === 0) {
    parts.push(v.descricoes.justificativa_legal.trim());
  }
  if (v.inherited_alerts.length > 0) {
    parts.push(v.inherited_alerts[0]);
  }
  return (
    parts.join(" ").trim() ||
    "Baixo risco identificado; uso permitido conforme governança padrão."
  );
}

function PageHeader({ modelName }: { modelName: string }) {
  return (
    <div className="flex items-center justify-between pb-6">
      <span className="inline-flex items-center rounded-full bg-[#EF6B10] px-3 py-0.5 text-[0.68rem] font-bold text-white">
        ICTi
      </span>
      <span className="text-[0.65rem] font-bold tracking-[0.12em] text-zinc-400 uppercase">
        DOCUMENTO INTERNO · GOVERNANÇA DE IA ({modelName})
      </span>
    </div>
  );
}

function PageFooter({
  page,
  total,
  modelName,
}: {
  page: number;
  total: number;
  modelName: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-3 text-[0.68rem] text-zinc-500">
      <span>Manual de Processos e Métricas de Governança de IA em Crédito · {modelName}</span>
      <span>
        Página {page} de {total}
      </span>
    </div>
  );
}

export function GovernanceManualPreview({
  report,
  modelName,
  categories,
  allVariables,
}: {
  report: ReportResponse;
  modelName: string;
  categories: CategoryRecord[];
  allVariables: VariableRecord[];
}) {
  const title = modelName.trim() || "Modelo de Risco de Crédito V2";

  const labelsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVariables) map.set(v.id, v.label);
    for (const v of report.selected_variables) map.set(v.id, v.label);
    return map;
  }, [allVariables, report.selected_variables]);

  const catDescriptions = useMemo(() => {
    const map = new Map<string, string>(Object.entries(DEFAULT_CATEGORY_DESCRIPTIONS));
    for (const c of categories) {
      if (c.description) map.set(c.label, c.description);
    }
    return map;
  }, [categories]);

  const groupedCategories = useMemo(() => {
    const map = new Map<string, VariableRecord[]>();
    for (const v of report.selected_variables) {
      const cat = v.categoria_label || "Outras Variáveis";
      const list = map.get(cat) ?? [];
      list.push(v);
      map.set(cat, list);
    }
    return Array.from(map.entries()).map(([catLabel, vars], idx) => ({
      sectionNum: idx + 1,
      catLabel,
      catDesc:
        catDescriptions.get(catLabel) ??
        "Variáveis avaliadas quanto ao nexo causal, base legal autorizadora e risco de atuação como proxy.",
      vars,
      pageNum: 4 + idx,
    }));
  }, [report.selected_variables, catDescriptions]);

  const conformityGoals = useMemo(() => {
    const goals: Array<{ tab: string; body: string }> = [];
    const seen = new Set<string>();
    for (const v of report.selected_variables) {
      for (const r of v.riscos) {
        const base =
          r.bases_acionadas_labels[0] || v.bases_autorizadoras_labels[0] || v.label;
        const tab = base.toUpperCase().slice(0, 28);
        const body = (r.demanda_governanca || r.implicacao_legal || r.descricao).trim();
        if (body && !seen.has(tab)) {
          seen.add(tab);
          goals.push({ tab, body: `${v.label}: ${body}` });
        }
        if (goals.length >= 4) break;
      }
      if (goals.length >= 4) break;
    }
    for (const g of DEFAULT_CONFORMITY_GOALS) {
      if (goals.length >= 4) break;
      if (!seen.has(g.tab)) goals.push(g);
    }
    return goals.slice(0, 4);
  }, [report.selected_variables]);

  const part2DividerPage = 4 + groupedCategories.length;
  const conformityPage = part2DividerPage + 1;
  const mitigationPage = part2DividerPage + 2;
  const totalPages = mitigationPage;

  const secConformity = groupedCategories.length + 1;
  const secEquity = groupedCategories.length + 2;
  const secMitigation = groupedCategories.length + 3;

  return (
    <div className="max-h-[42rem] space-y-6 overflow-y-auto rounded-xl border border-rule bg-surface-muted/70 p-4">
      {/* PÁGINA 1 — CAPA */}
      <div className="relative overflow-hidden rounded-xl bg-[#061138] px-8 py-12 text-white shadow-sm">
        {/* Elementos geométricos decorativos da capa */}
        <div className="pointer-events-none absolute top-14 -left-12 h-28 w-28 rounded-full bg-[#EF6B10]" />
        <div className="pointer-events-none absolute top-4 -right-6 h-5 w-24 rounded-full bg-[#EF6B10]" />
        <div className="pointer-events-none absolute top-16 -right-8 h-20 w-20 rounded-full bg-[#0018A8]" />
        <div className="pointer-events-none absolute right-10 bottom-20 h-5 w-16 rounded-full bg-[#EF6B10]" />
        <div className="pointer-events-none absolute right-10 bottom-7 h-12 w-12 rounded-full bg-[#DCA000]" />

        <div className="relative z-10 max-w-lg pl-6">
          <p className="text-[0.68rem] font-bold tracking-[0.25em] text-white/90 uppercase">
            Governança & Auditoria Algorítmica
          </p>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight">
            Matriz de Variáveis, Proxies e Base Legal em Crédito
          </h2>
          <p className="mt-3 text-sm text-indigo-100/90">
            Como decidimos quais dados entram e quais nunca entram nos modelos de crédito.
          </p>

          <div className="my-6 h-px w-4/5 bg-indigo-300/30" />

          <p className="text-xs leading-relaxed font-semibold text-white/95">
            Guia de referência sobre variáveis, proxies de discriminação indireta e a legislação
            que rege seu uso em modelos de risco de crédito.
          </p>

          <div className="mt-6 rounded-lg border border-white/10 bg-[#0D1D56] p-4 text-xs">
            <p className="font-bold tracking-wider text-[#EF6B10] uppercase">
              Modelo avaliado: {title}
            </p>
            <p className="mt-1 text-white/90">
              {report.summary.total} variáveis selecionadas · {report.summary.total_riscos} riscos
              mapeados · {report.summary.vetos_or_maxima} veto/máximo
            </p>
          </div>

          <div className="mt-10">
            <span className="inline-flex items-center rounded-full bg-white px-4 py-1 text-xs font-extrabold text-[#061138]">
              ICTi
            </span>
          </div>
        </div>
      </div>

      {/* PÁGINA 2 — SUMÁRIO */}
      <div className="rounded-xl border border-zinc-200 bg-white p-7 text-zinc-900 shadow-xs">
        <PageHeader modelName={title} />
        <p className="mt-2 text-[0.7rem] font-extrabold tracking-[0.22em] text-[#EF6B10] uppercase">
          Sumário
        </p>
        <h3 className="mt-1 text-2xl font-extrabold text-[#061138]">
          O que você vai encontrar aqui
        </h3>

        <p className="mt-6 text-[0.68rem] font-bold tracking-[0.16em] text-zinc-400 uppercase">
          Parte I · A Matriz, Variável a Variável
        </p>
        <div className="mt-3 divide-y divide-zinc-100">
          {groupedCategories.map((g) => (
            <div key={g.catLabel} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EF6B10] text-xs font-bold text-white">
                  {g.sectionNum}
                </span>
                <span className="text-sm font-bold text-zinc-900">{g.catLabel}</span>
              </div>
              <span className="font-mono text-xs font-bold text-zinc-400">
                {String(g.pageNum).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[0.68rem] font-bold tracking-[0.16em] text-zinc-400 uppercase">
          Parte II · Fundamentação Legal e Auditoria Técnica
        </p>
        <div className="mt-3 divide-y divide-zinc-100">
          {[
            { num: secConformity, label: "Metas de Conformidade Regulatória", pg: conformityPage },
            { num: secEquity, label: "Métricas de Auditoria de Equidade", pg: conformityPage },
            { num: secMitigation, label: "Mitigação de Viés no Pipeline", pg: mitigationPage },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0E6B22] text-xs font-bold text-white">
                  {item.num}
                </span>
                <span className="text-sm font-bold text-zinc-900">{item.label}</span>
              </div>
              <span className="font-mono text-xs font-bold text-zinc-400">
                {String(item.pg).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>

        <PageFooter page={2} total={totalPages} modelName={title} />
      </div>

      {/* PÁGINA 3 — DIVISOR PARTE I */}
      <div className="relative overflow-hidden rounded-xl bg-[#EF6B10] px-8 py-14 text-white shadow-xs">
        <div className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-extrabold">
          I
        </div>
        <p className="text-[0.7rem] font-bold tracking-[0.24em] uppercase">Parte I</p>
        <h3 className="mt-3 text-3xl leading-tight font-extrabold">
          A matriz,
          <br />
          variável a variável
        </h3>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-white/90">
          CEP pode ser proxy de raça. GPA pode ser proxy de elite. Aqui está, grupo a grupo, por
          que cada variável entra ou fica de fora, com a base legal exata.
        </p>
        <div className="mt-10 h-9 w-9 rounded-full bg-[#061138]" />
      </div>

      {/* PÁGINAS 4..K — TABELAS POR CATEGORIA */}
      {groupedCategories.map((g) => (
        <div
          key={g.catLabel}
          className="rounded-xl border border-zinc-200 bg-white p-7 text-zinc-900 shadow-xs"
        >
          <PageHeader modelName={title} />

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#061138] text-xs font-bold text-white">
              {g.sectionNum}
            </span>
            <div>
              <h4 className="text-lg font-extrabold text-[#061138]">{g.catLabel}</h4>
              <p className="mt-0.5 text-xs text-zinc-500">{g.catDesc}</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#061138] text-[0.65rem] font-bold tracking-wider text-white uppercase">
                  <th className="px-3 py-2.5">Variável</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Base Legal</th>
                  <th className="px-3 py-2.5">Atuação como Proxy / Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70">
                {g.vars.map((v, idx) => {
                  const st = classifyStatus(v);
                  return (
                    <tr key={v.id} className={idx % 2 === 1 ? "bg-[#F4F4F6]" : "bg-white"}>
                      <td className="px-3 py-3 align-top font-medium text-zinc-900">{v.label}</td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-extrabold ${statusPillClasses(
                            st,
                          )}`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-zinc-800">{formatLegalBasis(v)}</td>
                      <td className="px-3 py-3 align-top leading-relaxed text-zinc-700">
                        {formatProxyAndRisk(v, labelsById)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PageFooter page={g.pageNum} total={totalPages} modelName={title} />
        </div>
      ))}

      {/* PÁGINA K+1 — DIVISOR PARTE II */}
      <div className="relative overflow-hidden rounded-xl bg-[#0B531C] px-8 py-14 text-white shadow-xs">
        <div className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-extrabold">
          II
        </div>
        <p className="text-[0.7rem] font-bold tracking-[0.24em] uppercase">Parte II</p>
        <h3 className="mt-3 text-3xl leading-tight font-extrabold">
          Fundamentação legal
          <br />e auditoria técnica
        </h3>
        <p className="mt-3 max-w-md text-xs leading-relaxed text-white/90">
          Aqui a conformidade regulatória vira meta mensurável, métrica recalculada e técnica de
          correção quando o resultado foge do esperado.
        </p>
        <div className="mt-10 ml-auto h-10 w-10 rounded-full bg-[#DCA000]" />
      </div>

      {/* PÁGINA K+2 — METAS DE CONFORMIDADE & MÉTRICAS DE EQUIDADE */}
      <div className="rounded-xl border border-zinc-200 bg-white p-7 text-zinc-900 shadow-xs">
        <PageHeader modelName={title} />

        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#061138] text-xs font-bold text-white">
            {secConformity}
          </span>
          <h4 className="text-lg font-extrabold text-[#061138]">
            Metas de Conformidade Regulatória
          </h4>
        </div>

        <div className="mt-4 space-y-3 pl-6">
          {conformityGoals.map((g) => (
            <div key={g.tab}>
              <span className="inline-block rounded-t-md bg-[#EF6B10] px-3 py-1 text-[0.65rem] font-extrabold text-white uppercase">
                {g.tab}
              </span>
              <div className="rounded-r-lg rounded-bl-lg bg-[#061138] px-4 py-3 text-xs leading-relaxed text-white">
                {g.body}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-[#061138] text-xs font-bold text-white">
            {secEquity}
          </span>
          <div>
            <h4 className="text-lg font-extrabold text-[#061138]">
              Métricas de Auditoria de Equidade
            </h4>
            <p className="text-xs text-zinc-500">
              Recalculadas a cada re-treinamento e, no mínimo, a cada trimestre.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 pl-6 sm:grid-cols-2">
          {[
            {
              title: "Statistical Parity",
              desc: "Aprovação equivalente entre grupo protegido e não protegido.",
            },
            {
              title: "Equalized Odds",
              desc: "Acerto e erro equivalentes entre os grupos analisados.",
            },
            {
              title: "Equal Opportunity",
              desc: "Entre bons pagadores, aprovação equivalente entre grupos.",
            },
            {
              title: "Counterfactual Fairness",
              desc: "Decisão estável ao simular outro grupo protegido.",
            },
          ].map((m) => (
            <div key={m.title} className="rounded-lg bg-[#EEF2FB] p-3.5">
              <p className="text-xs font-extrabold text-[#061138]">{m.title}</p>
              <p className="mt-1 text-[0.72rem] leading-snug text-zinc-700">{m.desc}</p>
            </div>
          ))}
        </div>

        <PageFooter page={conformityPage} total={totalPages} modelName={title} />
      </div>

      {/* PÁGINA K+3 — MITIGAÇÃO DE VIÉS NO PIPELINE */}
      <div className="rounded-xl border border-zinc-200 bg-white p-7 text-zinc-900 shadow-xs">
        <PageHeader modelName={title} />

        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-[#061138] text-xs font-bold text-white">
            {secMitigation}
          </span>
          <div>
            <h4 className="text-lg font-extrabold text-[#061138]">Mitigação de Viés no Pipeline</h4>
            <p className="text-xs text-zinc-500">
              Disparidade acima do limiar aciona uma destas técnicas, conforme a fase do modelo:
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 pl-6 sm:grid-cols-3">
          {[
            {
              title: "Pré-processamento",
              bg: "bg-[#0018A8]",
              items: ["Reweighing", "Fair Representation"],
            },
            {
              title: "In-processing",
              bg: "bg-[#061138]",
              items: ["Constraint Optimization", "Regularization"],
            },
            {
              title: "Pós-processamento",
              bg: "bg-[#9E6B00]",
              items: ["Calibration", "Thresholding"],
            },
          ].map((stage) => (
            <div key={stage.title} className="text-center">
              <div
                className={`rounded-lg ${stage.bg} px-3 py-2 text-xs font-bold text-white`}
              >
                {stage.title}
              </div>
              <ul className="mt-2.5 space-y-1.5 text-xs text-zinc-700">
                {stage.items.map((tech) => (
                  <li key={tech}>{tech}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-zinc-200 pt-4 text-[0.72rem] leading-relaxed text-zinc-500">
          <strong className="text-zinc-800">Revisão desta matriz:</strong> a cada mudança
          regulatória relevante do Banco Central ou da ANPD, ou nova variável submetida à análise
          jurídica. · Governança e Auditoria de Vieses em Modelos de Risco de Crédito, Instituto de
          Ciência e Tecnologia Itaú (ICTi) / UFRN.
        </div>

        <PageFooter page={mitigationPage} total={totalPages} modelName={title} />
      </div>
    </div>
  );
}
