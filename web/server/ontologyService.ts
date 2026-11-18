import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataFactory, Parser, Store, Writer, type Quad } from "n3";

const { namedNode, literal } = DataFactory;

export const MYONT_NS = "https://ontologia.governanca.credito/myont#";
export const SCHEMA_NS = "https://schema.org/";
export const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
export const OWL_NS = "http://www.w3.org/2002/07/owl#";
export const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

const RDF_TYPE = namedNode(`${RDF_NS}type`);
const RDFS_LABEL = namedNode(`${RDFS_NS}label`);
const RDFS_COMMENT = namedNode(`${RDFS_NS}comment`);
const OWL_NAMED_INDIVIDUAL = namedNode(`${OWL_NS}NamedIndividual`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "../..");

export const SCHEMA_TTL = path.join(REPO_ROOT, "ontology", "myont_v1.ttl");
export const CONCEPTS_TTL = path.join(REPO_ROOT, "data", "conceitos_schemaorg.ttl");
export const VARS_V1_TTL = path.join(REPO_ROOT, "data", "variaveis_schemaorg_v1.ttl");
export const CUSTOM_VARS_TTL = path.join(REPO_ROOT, "data", "variaveis_custom.ttl");

export const DESC_FIELDS = [
  { key: "origem", predicate: `${MYONT_NS}descricaoOrigem`, title: "Origem Sugerida" },
  {
    key: "justificativa_legal",
    predicate: `${MYONT_NS}descricaoJustificativaLegal`,
    title: "Justificativa Legal",
  },
  {
    key: "risco_etico",
    predicate: `${MYONT_NS}descricaoRiscoEtico`,
    title: "Possíveis Viéses / Riscos Éticos",
  },
  {
    key: "demanda_governanca",
    predicate: `${MYONT_NS}descricaoDemandaGovernanca`,
    title: "Demanda de Governança",
  },
  {
    key: "explicabilidade",
    predicate: `${MYONT_NS}descricaoExplicabilidade`,
    title: "Explicabilidade Necessária",
  },
  {
    key: "implicacao_legal",
    predicate: `${MYONT_NS}descricaoImplicacaoLegal`,
    title: "Implicações Legais",
  },
  {
    key: "atuacao_proxy",
    predicate: `${MYONT_NS}descricaoAtuacaoProxy`,
    title: "Atuação como Proxy",
  },
] as const;

export type DescKey = (typeof DESC_FIELDS)[number]["key"];

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

export interface VocabItem {
  id: string;
  label: string;
}

function localName(uri: string): string {
  if (uri.includes("#")) return uri.split("#")[1];
  const clean = uri.replace(/\/+$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1);
}

function toCurie(uri: string): string {
  if (uri.startsWith(SCHEMA_NS)) return `schema:${uri.slice(SCHEMA_NS.length)}`;
  if (uri.startsWith(MYONT_NS)) return `myont:${uri.slice(MYONT_NS.length)}`;
  return uri;
}

function resolveCurie(curieOrUri: string): string {
  if (curieOrUri.startsWith("schema:")) return `${SCHEMA_NS}${curieOrUri.slice(7)}`;
  if (curieOrUri.startsWith("myont:")) return `${MYONT_NS}${curieOrUri.slice(6)}`;
  return curieOrUri;
}

export function sanitizeIdentifier(name: string): string {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = ascii.match(/[A-Za-z0-9]+/g) ?? [];
  if (tokens.length === 0) return "NovaVariavel";
  let result = tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("");
  if (/^\d/.test(result)) result = `Var${result}`;
  return result;
}

function parseTurtleFile(filePath: string): Quad[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return new Parser({ format: "Turtle" }).parse(raw);
}

export class OntologyService {
  private store = new Store();

  constructor() {
    this.reload();
  }

  reload(): void {
    const nextStore = new Store();
    nextStore.addQuads(parseTurtleFile(SCHEMA_TTL));
    nextStore.addQuads(parseTurtleFile(CONCEPTS_TTL));

    const customQuads = parseTurtleFile(CUSTOM_VARS_TTL);
    const overriddenSubjects = new Set(
      customQuads.filter((q) => q.subject.termType === "NamedNode").map((q) => q.subject.value),
    );

    const v1Quads = parseTurtleFile(VARS_V1_TTL).filter(
      (q) => !overriddenSubjects.has(q.subject.value),
    );

    nextStore.addQuads(v1Quads);
    nextStore.addQuads(customQuads);
    this.store = nextStore;
  }

  private labelOf(uri: string): string {
    const objs = this.store.getObjects(namedNode(uri), RDFS_LABEL, null);
    if (objs.length > 0) return objs[0].value;
    return localName(uri);
  }

  private singleLiteral(subjectUri: string, predicateUri: string): string {
    const objs = this.store.getObjects(namedNode(subjectUri), namedNode(predicateUri), null);
    return objs.length > 0 ? objs[0].value : "";
  }

  getVocabularies(): {
    basesLegais: VocabItem[];
    niveisGovernanca: VocabItem[];
    statusCuradoria: VocabItem[];
  } {
    const readVocab = (classUri: string): VocabItem[] => {
      const subjs = this.store.getSubjects(RDF_TYPE, namedNode(classUri), null);
      return subjs
        .filter((s) => s.termType === "NamedNode")
        .map((s) => ({ id: localName(s.value), label: this.labelOf(s.value) }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    };

    return {
      basesLegais: readVocab(`${MYONT_NS}BaseLegal`),
      niveisGovernanca: readVocab(`${MYONT_NS}NivelDemandaGovernanca`),
      statusCuradoria: readVocab(`${MYONT_NS}StatusCuradoria`),
    };
  }

  listExternalConcepts(): ExternalConcept[] {
    const subjs = this.store.getSubjects(RDF_TYPE, namedNode(`${MYONT_NS}ConceitoExterno`), null);
    return subjs
      .filter((s) => s.termType === "NamedNode")
      .map((s) => {
        const uri = s.value;
        return {
          uri,
          curie: toCurie(uri),
          label: this.labelOf(uri),
          comment: this.singleLiteral(uri, `${RDFS_NS}comment`),
          ontologia: this.singleLiteral(uri, `${MYONT_NS}ontologiaOrigem`),
          tipo: this.singleLiteral(uri, `${MYONT_NS}tipoTermoExterno`),
          contexto: this.singleLiteral(uri, `${MYONT_NS}contextoExterno`),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "en"));
  }

  listVariables(): VariableRecord[] {
    const nodeUris = new Set<string>();
    for (const cls of [`${MYONT_NS}Variavel`, `${MYONT_NS}VariavelSensivel`]) {
      for (const s of this.store.getSubjects(RDF_TYPE, namedNode(cls), null)) {
        if (s.termType === "NamedNode") nodeUris.add(s.value);
      }
    }

    const baseRecords: VariableRecord[] = [];
    for (const uri of nodeUris) {
      const sNode = namedNode(uri);
      const id = localName(uri);
      const sensivel =
        this.store.getQuads(sNode, RDF_TYPE, namedNode(`${MYONT_NS}VariavelSensivel`), null).length >
        0;

      const proxyDe = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}atuaComoProxyDe`), null)
        .filter((o) => o.termType === "NamedNode")
        .map((o) => localName(o.value))
        .sort();

      const derivadaDe = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}derivadaDe`), null)
        .filter((o) => o.termType === "NamedNode")
        .map((o) => localName(o.value))
        .sort();

      const statusObj = this.store.getObjects(
        sNode,
        namedNode(`${MYONT_NS}temStatusCuradoria`),
        null,
      )[0];
      const statusCuradoria =
        statusObj?.termType === "NamedNode"
          ? localName(statusObj.value)
          : "Status_PendenteRevisaoJuridica";
      const statusLabel =
        statusObj?.termType === "NamedNode"
          ? this.labelOf(statusObj.value)
          : "Pendente de Revisão Jurídica";

      const govObj = this.store.getObjects(
        sNode,
        namedNode(`${MYONT_NS}temNivelGovernanca`),
        null,
      )[0];
      const nivelGovernanca =
        govObj?.termType === "NamedNode" ? localName(govObj.value) : "Governanca_Media";
      const nivelLabel =
        govObj?.termType === "NamedNode"
          ? this.labelOf(govObj.value)
          : "Demanda de Governança Média";

      const baseNodes = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}temBaseLegal`), null)
        .filter((o) => o.termType === "NamedNode");
      const basesLegais = baseNodes.map((b) => localName(b.value)).sort();
      const basesLegaisLabels = baseNodes.map((b) => this.labelOf(b.value)).sort();

      const conceitosEquivalentes = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}equivalenteAConceitoExterno`), null)
        .filter((o) => o.termType === "NamedNode")
        .map((o) => toCurie(o.value))
        .sort();

      const conceitosBaseados = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}baseadaEmConceitoExterno`), null)
        .filter((o) => o.termType === "NamedNode")
        .map((o) => toCurie(o.value))
        .sort();

      for (const o of this.store.getObjects(
        sNode,
        namedNode(`${MYONT_NS}mapeadaParaConceitoExterno`),
        null,
      )) {
        if (o.termType === "NamedNode") {
          const curie = toCurie(o.value);
          if (!conceitosEquivalentes.includes(curie) && !conceitosBaseados.includes(curie)) {
            conceitosBaseados.push(curie);
          }
        }
      }

      const descricoes = {} as Record<DescKey, string>;
      for (const f of DESC_FIELDS) {
        descricoes[f.key] = this.singleLiteral(uri, f.predicate);
      }

      baseRecords.push({
        id,
        uri,
        label: this.labelOf(uri),
        sensivel,
        isProxy: proxyDe.length > 0,
        statusCuradoria,
        statusLabel,
        nivelGovernanca,
        nivelLabel,
        basesLegais,
        basesLegaisLabels,
        conceitosEquivalentes,
        conceitosBaseados,
        proxyDe,
        derivadaDe,
        descricoes,
        inheritedAlerts: [],
      });
    }

    const byId = new Map(baseRecords.map((r) => [r.id, r]));
    for (const rec of baseRecords) {
      rec.inheritedAlerts = this.traceInheritedAlerts(rec.id, byId);
    }

    return baseRecords.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  traceInheritedAlerts(varId: string, byId: Map<string, VariableRecord>): string[] {
    const start = byId.get(varId);
    if (!start) return [];
    const alerts: string[] = [];
    const visited = new Set<string>([varId]);
    const queue: Array<{ id: string; depth: number }> = start.derivadaDe
      .filter((d) => byId.has(d))
      .map((d) => ({ id: d, depth: 1 }));

    while (queue.length > 0) {
      const next = queue.shift()!;
      if (visited.has(next.id)) continue;
      visited.add(next.id);

      const src = byId.get(next.id)!;
      const prefix = `Derivada de ${src.label} (nível ${next.depth})`;

      if (src.sensivel) {
        alerts.push(`${prefix}: origem é Variável Sensível/Protegida.`);
      }
      if (src.nivelGovernanca === "Governanca_Veto" || src.nivelGovernanca === "Governanca_Maxima") {
        alerts.push(`${prefix}: origem possui nível ${src.nivelLabel}.`);
      }
      if (src.proxyDe.length > 0) {
        const targets = src.proxyDe.map((p) => byId.get(p)?.label ?? p).join(", ");
        alerts.push(`${prefix}: origem atua como proxy de ${targets}.`);
      }

      for (const parent of src.derivadaDe) {
        if (byId.has(parent) && !visited.has(parent)) {
          queue.push({ id: parent, depth: next.depth + 1 });
        }
      }
    }

    return alerts;
  }

  saveCustomVariable(targetId: string, payload: VariablePayload): VariableRecord {
    const customStore = new Store(parseTurtleFile(CUSTOM_VARS_TTL));
    const subj = namedNode(`${MYONT_NS}${targetId}`);

    customStore.removeQuads(customStore.getQuads(subj, null, null, null));

    const quads: Quad[] = [];
    const add = (pred: string, obj: ReturnType<typeof namedNode> | ReturnType<typeof literal>) => {
      quads.push(DataFactory.quad(subj, namedNode(pred), obj));
    };

    add(`${RDF_NS}type`, OWL_NAMED_INDIVIDUAL);
    add(`${RDF_NS}type`, namedNode(`${MYONT_NS}Variavel`));
    if (payload.sensivel) {
      add(`${RDF_NS}type`, namedNode(`${MYONT_NS}VariavelSensivel`));
    }

    add(`${RDFS_NS}label`, literal(payload.label.trim(), "pt-br"));
    add(
      `${MYONT_NS}temStatusCuradoria`,
      namedNode(`${MYONT_NS}${payload.statusCuradoria || "Status_PendenteRevisaoJuridica"}`),
    );
    add(
      `${MYONT_NS}temNivelGovernanca`,
      namedNode(`${MYONT_NS}${payload.nivelGovernanca || "Governanca_Media"}`),
    );

    for (const bId of payload.basesLegais ?? []) {
      add(`${MYONT_NS}temBaseLegal`, namedNode(`${MYONT_NS}${bId}`));
    }
    for (const curie of payload.conceitosEquivalentes ?? []) {
      add(`${MYONT_NS}equivalenteAConceitoExterno`, namedNode(resolveCurie(curie)));
    }
    for (const curie of payload.conceitosBaseados ?? []) {
      add(`${MYONT_NS}baseadaEmConceitoExterno`, namedNode(resolveCurie(curie)));
    }
    for (const pId of payload.proxyDe ?? []) {
      if (pId !== targetId) {
        add(`${MYONT_NS}atuaComoProxyDe`, namedNode(`${MYONT_NS}${pId}`));
      }
    }
    for (const dId of payload.derivadaDe ?? []) {
      if (dId !== targetId) {
        add(`${MYONT_NS}derivadaDe`, namedNode(`${MYONT_NS}${dId}`));
      }
    }

    for (const field of DESC_FIELDS) {
      const val = (payload.descricoes?.[field.key] ?? "").trim();
      if (val) {
        add(field.predicate, literal(val, namedNode(`${XSD_NS}string`)));
      }
    }

    customStore.addQuads(quads);

    const writer = new Writer({
      prefixes: {
        myont: MYONT_NS,
        schema: SCHEMA_NS,
        owl: OWL_NS,
        rdf: RDF_NS,
        rdfs: RDFS_NS,
        xsd: XSD_NS,
      },
    });
    writer.addQuads(customStore.getQuads(null, null, null, null));
    let serialized = "";
    writer.end((err, result) => {
      if (err) throw err;
      serialized = result;
    });

    fs.mkdirSync(path.dirname(CUSTOM_VARS_TTL), { recursive: true });
    fs.writeFileSync(CUSTOM_VARS_TTL, serialized, "utf-8");

    this.reload();
    const updated = this.listVariables().find((v) => v.id === targetId);
    if (!updated) throw new Error(`Falha ao recarregar variável ${targetId}`);
    return updated;
  }

  buildMarkdownReport(variableIds: string[], modelName: string): {
    markdown: string;
    selectedVariables: VariableRecord[];
    summary: {
      total: number;
      vetosOrMaxima: number;
      sensiveis: number;
      proxies: number;
      pendentes: number;
    };
  } {
    const all = this.listVariables();
    const byId = new Map(all.map((v) => [v.id, v]));
    const selected = variableIds.map((id) => byId.get(id)).filter((v): v is VariableRecord => Boolean(v));

    const vetosOrMaxima = selected.filter(
      (v) => v.nivelGovernanca === "Governanca_Veto" || v.nivelGovernanca === "Governanca_Maxima",
    ).length;
    const sensiveis = selected.filter((v) => v.sensivel).length;
    const proxies = selected.filter((v) => v.isProxy).length;
    const pendentes = selected.filter((v) => v.statusCuradoria !== "Status_Auditada").length;

    const now = new Date().toLocaleString("pt-BR");
    const lines: string[] = [
      `# Relatório Preventivo de Governança Algorítmica (V1) — ${modelName || "Modelo de Crédito"}`,
      `**Gerado em:** ${now}  `,
      `**Variáveis auditadas selecionadas:** ${selected.length}  `,
      "",
      "## 1. Resumo Executivo de Riscos",
      `- **Nível Veto / Governança Máxima:** ${vetosOrMaxima}`,
      `- **Variáveis Sensíveis / Protegidas:** ${sensiveis}`,
      `- **Variáveis com Atuação como Proxy:** ${proxies}`,
      `- **Pendentes de Revisão Jurídica:** ${pendentes}`,
      "",
      "## 2. Detalhamento Jurídico e Semântico por Variável",
    ];

    for (const v of selected) {
      const conceitos = [
        ...v.conceitosEquivalentes.map((c) => `${c} (Equivalente)`),
        ...v.conceitosBaseados.map((c) => `${c} (Baseada)`),
      ];
      const proxiesLbl = v.proxyDe.map((p) => byId.get(p)?.label ?? p);
      const derivLbl = v.derivadaDe.map((d) => byId.get(d)?.label ?? d);

      lines.push(
        "",
        `### ${v.label} (\`${v.id}\`)`,
        `- **Nível de Governança:** ${v.nivelLabel}`,
        `- **Status de Curadoria:** ${v.statusLabel}`,
        `- **Variável Sensível:** ${v.sensivel ? "Sim" : "Não"}`,
        `- **Atua como Proxy de:** ${proxiesLbl.length > 0 ? proxiesLbl.join(", ") : "Nenhuma ligação direta mapeada"}`,
        `- **Derivada de:** ${derivLbl.length > 0 ? derivLbl.join(", ") : "—"}`,
        `- **Lastro Externo (Schema.org):** ${conceitos.length > 0 ? conceitos.join(", ") : "Sem vínculo externo"}`,
        `- **Bases Legais:** ${v.basesLegaisLabels.length > 0 ? v.basesLegaisLabels.join(", ") : "Não informada"}`,
      );

      if (v.inheritedAlerts.length > 0) {
        lines.push("- **Alertas Propagados por Derivação:**");
        for (const alert of v.inheritedAlerts) {
          lines.push(`  - ${alert}`);
        }
      }

      for (const f of DESC_FIELDS) {
        const val = v.descricoes[f.key];
        if (val) lines.push(`- **${f.title}:** ${val}`);
      }
    }

    return {
      markdown: lines.join("\n"),
      selectedVariables: selected,
      summary: {
        total: selected.length,
        vetosOrMaxima,
        sensiveis,
        proxies,
        pendentes,
      },
    };
  }
}
