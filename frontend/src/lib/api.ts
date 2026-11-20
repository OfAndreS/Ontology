export type RoleType = "admin" | "analista";
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

export interface AuthUser {
  id: number;
  public_id: string;
  username: string;
  name: string;
  email: string;
  role: RoleType;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface UserCreatePayload {
  username: string;
  name: string;
  email: string;
  password: string;
  role: RoleType;
  is_active: boolean;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  password?: string;
  role?: RoleType;
  is_active?: boolean;
}

export interface HistoryItem {
  id: string;
  action: string;
  author_name: string;
  created_at: string;
}

export interface CategoryRecord {
  id: string;
  uri: string;
  slug: string;
  label: string;
  description: string;
  variable_count: number;
}

export interface LawDeviceRecord {
  id: string;
  uri: string;
  label: string;
  tipo_dispositivo: string;
  descricao: string;
}

export interface LawDeviceInput {
  id?: string;
  label: string;
  tipo_dispositivo: string;
  descricao: string;
}

export interface LawRecord {
  id: string;
  uri: string;
  slug: string;
  label: string;
  tipo_instrumento: string;
  descricao: string;
  url_fonte?: string | null;
  data_publicacao?: string | null;
  pdf_name?: string | null;
  pdf_url?: string | null;
  dispositivos: LawDeviceRecord[];
  linked_variables: Array<{ id: string; label: string }>;
  history: HistoryItem[];
}

export interface LawCreatePayload {
  label: string;
  tipo_instrumento: string;
  descricao: string;
  url_fonte?: string | null;
  data_publicacao?: string | null;
  dispositivos: LawDeviceInput[];
}

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
  nivel_risco: string;
  nivel_label: string;
  demanda_governanca: string;
  implicacao_legal: string;
  bases_acionadas: string[];
  bases_acionadas_labels: string[];
}

export interface RiskPayload {
  id?: string;
  descricao: string;
  nivel_risco: string;
  demanda_governanca: string;
  implicacao_legal: string;
  bases_acionadas: string[];
}

export interface VariableRecord {
  id: string;
  uri: string;
  label: string;
  categoria_id?: string | null;
  categoria_label?: string | null;
  sensivel: boolean;
  is_proxy: boolean;
  status_curadoria: string;
  status_label: string;
  nivel_risco_maximo: string;
  nivel_risco_label: string;
  bases_autorizadoras: string[];
  bases_autorizadoras_labels: string[];
  bases_restringidas: string[];
  bases_restringidas_labels: string[];
  conceitos_equivalentes: string[];
  conceitos_baseados: string[];
  proxy_de: string[];
  derivada_de: string[];
  descricoes: Record<DescKey, string>;
  riscos: RiskRecord[];
  inherited_alerts: string[];
  reverse_proxies?: Array<{ id: string; label: string }>;
  derived_children?: Array<{ id: string; label: string }>;
  history?: HistoryItem[];
}

export interface VariablePayload {
  id?: string;
  label: string;
  categoria_id?: string | null;
  sensivel: boolean;
  status_curadoria: string;
  bases_autorizadoras: string[];
  conceitos_equivalentes: string[];
  conceitos_baseados: string[];
  proxy_de: string[];
  derivada_de: string[];
  descricoes: Partial<Record<DescKey, string>>;
  riscos: RiskPayload[];
}

export interface LegalBaseVocabItem {
  id: string;
  uri: string;
  label: string;
  kind: "InstrumentoNormativo" | "DispositivoLegal";
  tipo_detalhe: string;
  instrumento_id?: string | null;
  instrumento_label?: string | null;
}

export interface Vocabularies {
  bases_legais: LegalBaseVocabItem[];
  niveis_risco: Array<{ id: string; label: string }>;
  status_curadoria: Array<{ id: string; label: string }>;
  tipos_instrumento: string[];
  tipos_dispositivo: string[];
}

export interface ReportResponse {
  markdown: string;
  selected_variables: VariableRecord[];
  summary: {
    total: number;
    vetos_or_maxima: number;
    sensiveis: number;
    proxies: number;
    pendentes: number;
    total_riscos: number;
  };
}

const TOKEN_STORAGE_KEY = "myont_access_token";

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && url !== "/api/auth/login") {
    setStoredToken(null);
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `Erro HTTP ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function downloadProtectedPdf(url: string, filename: string): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Não foi possível baixar o PDF.");
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "norma.pdf";
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export const api = {
  // Auth & Users
  login: (username: string, password: string) =>
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<AuthUser>("/api/auth/me"),
  listUsers: () => request<AuthUser[]>("/api/auth/users"),
  createUser: (payload: UserCreatePayload) =>
    request<AuthUser>("/api/auth/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (publicId: string, payload: UserUpdatePayload) =>
    request<AuthUser>(`/api/auth/users/${encodeURIComponent(publicId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteUser: (publicId: string) =>
    request<void>(`/api/auth/users/${encodeURIComponent(publicId)}`, {
      method: "DELETE",
    }),

  // Vocabularies & Concepts
  getVocabularies: () => request<Vocabularies>("/api/vocabularies"),
  getConcepts: (q = "") =>
    request<ExternalConcept[]>(`/api/concepts${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  // Categories
  getCategories: () => request<CategoryRecord[]>("/api/categories"),
  createCategory: (payload: { label: string; description: string }) =>
    request<CategoryRecord>("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (id: string, payload: { label?: string; description?: string }) =>
    request<CategoryRecord>(`/api/categories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id: string) =>
    request<void>(`/api/categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // Variables
  getVariables: () => request<VariableRecord[]>("/api/variables"),
  getVariable: (id: string) =>
    request<VariableRecord>(`/api/variables/${encodeURIComponent(id)}`),
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
  deleteVariable: (id: string) =>
    request<void>(`/api/variables/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // Laws & PDFs
  getLaws: () => request<LawRecord[]>("/api/laws"),
  getLaw: (slug: string) => request<LawRecord>(`/api/laws/${encodeURIComponent(slug)}`),
  createLaw: (payload: LawCreatePayload) =>
    request<LawRecord>("/api/laws", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLaw: (slug: string, payload: Partial<LawCreatePayload>) =>
    request<LawRecord>(`/api/laws/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteLaw: (slug: string) =>
    request<void>(`/api/laws/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    }),
  uploadLawPdf: (slug: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<LawRecord>(`/api/laws/${encodeURIComponent(slug)}/upload-pdf`, {
      method: "POST",
      body: fd,
    });
  },
  deleteLawPdf: (slug: string) =>
    request<LawRecord>(`/api/laws/${encodeURIComponent(slug)}/pdf`, {
      method: "DELETE",
    }),

  // Report
  generateReport: (variable_ids: string[], model_name: string) =>
    request<ReportResponse>("/api/report", {
      method: "POST",
      body: JSON.stringify({ variable_ids, model_name }),
    }),
};
