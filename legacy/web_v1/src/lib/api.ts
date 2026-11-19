export type DescKey =
  | "origem"
  | "justificativa_legal"
  | "risco_etico"
  | "demanda_governanca"
  | "explicabilidade"
  | "implicacao_legal"
  | "atuacao_proxy";

export const DESC_FIELDS: Array<{ key: DescKey; title: string; placeholder: string }> = [
  { key: "origem", title: "Origem Sugerida", placeholder: "Ex.: Titular / SCR / Bureaus / Open Finance" },
  {
    key: "justificativa_legal",
    title: "Justificativa Legal",
    placeholder: "Ex.: LGPD Art. 7º, X (Proteção ao Crédito), Execução de Contrato...",
  },
  {
    key: "risco_etico",
    title: "Possíveis Viéses / Riscos Éticos",
    placeholder: "Descreva possíveis exclusões ou discriminações indiretas...",
  },
  {
    key: "demanda_governanca",
    title: "Demanda de Governança (Estabilidade / Controle)",
    placeholder: "Ex.: Alta: Monitorar consistência entre renda declarada e movimentada...",
  },
  {
    key: "explicabilidade",
    title: "Explicabilidade Necessária",
    placeholder: "Como justificar o impacto dessa feature na decisão ao cliente/auditor...",
  },
  {
    key: "implicacao_legal",
    title: "Implicações Legais",
    placeholder: "Impactos jurídicos, constitucionais ou regulatórios...",
  },
  {
    key: "atuacao_proxy",
    title: "Atuação como Proxy",
    placeholder: "Explique de quais atributos sensíveis ou protegidos pode atuar como proxy...",
  },
];

export interface ExternalConcept {
  uri: string;
  curie: string;
  label: string;
  comment: string;
  ontologia: string;
  tipo: string;
  contexto: string;
}

export interface VariableRecord {
  id: string;
  uri: string;
  label: string;
  sensivel: boolean;
  isProxy: boolean;
  statusCuradoria: string;
  statusLabel: string;
  nivelGovernanca: string;
  nivelLabel: string;
  basesLegais: string[];
  basesLegaisLabels: string[];
  conceitosEquivalentes: string[];
  conceitosBaseados: string[];
  proxyDe: string[];
  derivadaDe: string[];
  descricoes: Record<DescKey, string>;
  inheritedAlerts: string[];
  reverseProxies?: Array<{ id: string; label: string }>;
  derivedChildren?: Array<{ id: string; label: string }>;
}

export interface Vocabularies {
  basesLegais: Array<{ id: string; label: string }>;
  niveisGovernanca: Array<{ id: string; label: string }>;
  statusCuradoria: Array<{ id: string; label: string }>;
}

export interface VariablePayload {
  id?: string;
  label: string;
  sensivel: boolean;
  statusCuradoria: string;
  nivelGovernanca: string;
  basesLegais: string[];
  conceitosEquivalentes: string[];
  conceitosBaseados: string[];
  proxyDe: string[];
  derivadaDe: string[];
  descricoes: Partial<Record<DescKey, string>>;
}

export interface ReportResponse {
  markdown: string;
  selectedVariables: VariableRecord[];
  summary: {
    total: number;
    vetosOrMaxima: number;
    sensiveis: number;
    proxies: number;
    pendentes: number;
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getVocabularies: () => request<Vocabularies>("/api/vocabularies"),
  getConcepts: () => request<ExternalConcept[]>("/api/concepts"),
  getVariables: () => request<VariableRecord[]>("/api/variables"),
  getVariable: (id: string) => request<VariableRecord>(`/api/variables/${encodeURIComponent(id)}`),
  createVariable: (payload: VariablePayload) =>
    request<VariableRecord>("/api/variables", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVariable: (id: string, payload: VariablePayload) =>
    request<VariableRecord>(`/api/variables/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  generateReport: (variableIds: string[], modelName: string) =>
    request<ReportResponse>("/api/report", {
      method: "POST",
      body: JSON.stringify({ variableIds, modelName }),
    }),
};
