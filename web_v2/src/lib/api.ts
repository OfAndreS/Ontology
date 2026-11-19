export type DescKey = "origem" | "justificativa_legal" | "explicabilidade" | "atuacao_proxy";

export const DESC_FIELDS: Array<{ key: DescKey; title: string; placeholder: string }> = [
  { key: "origem", title: "Origem Sugerida", placeholder: "Ex.: Titular / SCR / Bureaus / Open Finance" },
  {
    key: "justificativa_legal",
    title: "Justificativa Legal de Uso",
    placeholder: "Ex.: LGPD Art. 7º, X (Proteção ao Crédito), Execução de Contrato...",
  },
  {
    key: "explicabilidade",
    title: "Explicabilidade Necessária",
    placeholder: "Como justificar o impacto dessa feature na decisão ao cliente/auditor...",
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

export interface RiskRecord {
  id: string;
  uri: string;
  descricao: string;
  nivelRisco: string;
  nivelLabel: string;
  demandaGovernanca: string;
  implicacaoLegal: string;
  basesAcionadas: string[];
  basesAcionadasLabels: string[];
}

export interface RiskPayload {
  id?: string;
  descricao: string;
  nivelRisco: string;
  demandaGovernanca: string;
  implicacaoLegal: string;
  basesAcionadas: string[];
}

export interface VariableRecord {
  id: string;
  uri: string;
  label: string;
  sensivel: boolean;
  isProxy: boolean;
  statusCuradoria: string;
  statusLabel: string;
  nivelRiscoMaximo: string;
  nivelRiscoLabel: string;
  basesAutorizadoras: string[];
  basesAutorizadorasLabels: string[];
  basesRestringidas: string[];
  basesRestringidasLabels: string[];
  conceitosEquivalentes: string[];
  conceitosBaseados: string[];
  proxyDe: string[];
  derivadaDe: string[];
  descricoes: Record<DescKey, string>;
  riscos: RiskRecord[];
  inheritedAlerts: string[];
  reverseProxies?: Array<{ id: string; label: string }>;
  derivedChildren?: Array<{ id: string; label: string }>;
}

export interface LegalBaseVocabItem {
  id: string;
  label: string;
  kind: "InstrumentoNormativo" | "DispositivoLegal";
  tipoDetalhe: string;
  instrumentoId?: string;
  instrumentoLabel?: string;
}

export interface Vocabularies {
  basesLegais: LegalBaseVocabItem[];
  niveisRisco: Array<{ id: string; label: string }>;
  statusCuradoria: Array<{ id: string; label: string }>;
}

export interface VariablePayload {
  id?: string;
  label: string;
  sensivel: boolean;
  statusCuradoria: string;
  basesAutorizadoras: string[];
  conceitosEquivalentes: string[];
  conceitosBaseados: string[];
  proxyDe: string[];
  derivadaDe: string[];
  descricoes: Partial<Record<DescKey, string>>;
  riscos: RiskPayload[];
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
    totalRiscos: number;
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
