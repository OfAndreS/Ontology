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
const RDFS_SUBCLASS_OF = namedNode(`${RDFS_NS}subClassOf`);
const RDFS_DOMAIN = namedNode(`${RDFS_NS}domain`);
const RDFS_RANGE = namedNode(`${RDFS_NS}range`);
const OWL_NAMED_INDIVIDUAL = namedNode(`${OWL_NS}NamedIndividual`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, "../..");

export const SCHEMA_TTL = path.join(REPO_ROOT, "semantic", "ontologies", "myont_v2.ttl");
export const CONCEPTS_TTL = path.join(
  REPO_ROOT,
  "semantic",
  "data",
  "conceitos_externos_schemaorg.ttl",
);
export const VARS_V2_TTL = path.join(REPO_ROOT, "semantic", "data", "variaveis_v2.ttl");
export const CUSTOM_VARS_TTL = path.join(REPO_ROOT, "semantic", "data", "variaveis_v2_custom.ttl");

export const DESC_FIELDS = [
  { key: "origem", predicate: `${MYONT_NS}descricaoOrigem`, title: "Origem Sugerida" },
  {
    key: "justificativa_legal",
    predicate: `${MYONT_NS}descricaoJustificativaLegal`,
    title: "Justificativa Legal de Uso",
  },
  {
    key: "explicabilidade",
    predicate: `${MYONT_NS}descricaoExplicabilidade`,
    title: "Explicabilidade Necessária",
  },
  {
    key: "atuacao_proxy",
    predicate: `${MYONT_NS}descricaoAtuacaoProxy`,
    title: "Atuação como Proxy",
  },
] as const;

export type DescKey = (typeof DESC_FIELDS)[number]["key"];

export const RISK_SEVERITY_ORDER: Record<string, number> = {
  Risco_Baixo: 1,
  Risco_Medio: 2,
  Risco_Alto: 3,
  Risco_Maximo: 4,
  Risco_Veto: 5,
};

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

export interface VocabItem {
  id: string;
  label: string;
}

export interface LegalBaseVocabItem extends VocabItem {
  kind: "InstrumentoNormativo" | "DispositivoLegal";
  tipoDetalhe: string;
  instrumentoId?: string;
  instrumentoLabel?: string;
}

export interface OntologyOverview {
  version: string;
  label: string;
  comment: string;
  stats: {
    classes: number;
    objectProperties: number;
    datatypeProperties: number;
    variaveis: number;
    riscos: number;
    instrumentos: number;
    dispositivos: number;
    conceitosExternos: number;
  };
  classes: Array<{ id: string; label: string; comment: string; parent: string }>;
  objectProperties: Array<{ id: string; label: string; domain: string; range: string; comment: string }>;
  datatypeProperties: Array<{ id: string; label: string; domain: string; range: string }>;
  instrumentos: Array<{
    id: string;
    label: string;
    tipo: string;
    dispositivos: Array<{ id: string; label: string; tipo: string }>;
  }>;
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

    const v2RawQuads = parseTurtleFile(VARS_V2_TTL);
    // Remove também nós de Risco ligados a variáveis sobrescritas no custom TTL
    const overriddenRiskSubjects = new Set<string>();
    for (const q of v2RawQuads) {
      if (
        q.subject.termType === "NamedNode" &&
        overriddenSubjects.has(q.subject.value) &&
        q.predicate.value === `${MYONT_NS}possuiRisco` &&
        q.object.termType === "NamedNode"
      ) {
        overriddenRiskSubjects.add(q.object.value);
      }
    }

    const v2Quads = v2RawQuads.filter(
      (q) =>
        !overriddenSubjects.has(q.subject.value) &&
        !overriddenRiskSubjects.has(q.subject.value),
    );

    nextStore.addQuads(v2Quads);
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
    basesLegais: LegalBaseVocabItem[];
    niveisRisco: VocabItem[];
    statusCuradoria: VocabItem[];
  } {
    const readVocab = (classUri: string): VocabItem[] => {
      const subjs = this.store.getSubjects(RDF_TYPE, namedNode(classUri), null);
      return subjs
        .filter((s) => s.termType === "NamedNode")
        .map((s) => ({ id: localName(s.value), label: this.labelOf(s.value) }));
    };

    const niveisRisco = readVocab(`${MYONT_NS}NivelRisco`).sort(
      (a, b) => (RISK_SEVERITY_ORDER[a.id] ?? 99) - (RISK_SEVERITY_ORDER[b.id] ?? 99),
    );

    const statusCuradoria = readVocab(`${MYONT_NS}StatusCuradoria`).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );

    const instruments = this.store
      .getSubjects(RDF_TYPE, namedNode(`${MYONT_NS}InstrumentoNormativo`), null)
      .filter((s) => s.termType === "NamedNode")
      .map((s) => ({
        id: localName(s.value),
        label: this.labelOf(s.value),
        kind: "InstrumentoNormativo" as const,
        tipoDetalhe: this.singleLiteral(s.value, `${MYONT_NS}tipoInstrumento`) || "Instrumento",
      }));

    const devices = this.store
      .getSubjects(RDF_TYPE, namedNode(`${MYONT_NS}DispositivoLegal`), null)
      .filter((s) => s.termType === "NamedNode")
      .map((s) => {
        const parentNode = this.store.getObjects(
          s,
          namedNode(`${MYONT_NS}pertenceAInstrumento`),
          null,
        )[0];
        const instrumentoId = parentNode?.termType === "NamedNode" ? localName(parentNode.value) : undefined;
        const instrumentoLabel =
          parentNode?.termType === "NamedNode" ? this.labelOf(parentNode.value) : undefined;
        return {
          id: localName(s.value),
          label: this.labelOf(s.value),
          kind: "DispositivoLegal" as const,
          tipoDetalhe: this.singleLiteral(s.value, `${MYONT_NS}tipoDispositivo`) || "Dispositivo",
          instrumentoId,
          instrumentoLabel,
        };
      });

    const basesLegais: LegalBaseVocabItem[] = [...instruments, ...devices].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );

    return {
      basesLegais,
      niveisRisco,
      statusCuradoria,
    };
  }

  getOntologyOverview(): OntologyOverview {
    const ontologyUri = "https://ontologia.governanca.credito/myont";
    const version = this.singleLiteral(ontologyUri, `${OWL_NS}versionInfo`) || "2.0.0";
    const label = this.labelOf(ontologyUri);
    const comment = this.singleLiteral(ontologyUri, `${RDFS_NS}comment`);

    const classes = this.store
      .getSubjects(RDF_TYPE, namedNode(`${OWL_NS}Class`), null)
      .filter((s) => s.termType === "NamedNode" && s.value.startsWith(MYONT_NS))
      .map((s) => {
        const parent = this.store
          .getObjects(s, RDFS_SUBCLASS_OF, null)
          .filter((o) => o.termType === "NamedNode")
          .map((o) => toCurie(o.value))
          .join(", ");
        return {
          id: localName(s.value),
          label: this.labelOf(s.value),
          comment: this.singleLiteral(s.value, `${RDFS_NS}comment`),
          parent: parent || "owl:Thing",
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));

    const objectProperties = this.store
      .getSubjects(RDF_TYPE, namedNode(`${OWL_NS}ObjectProperty`), null)
      .filter((s) => s.termType === "NamedNode" && s.value.startsWith(MYONT_NS))
      .map((s) => {
        const domain = this.store
          .getObjects(s, RDFS_DOMAIN, null)
          .filter((o) => o.termType === "NamedNode")
          .map((o) => localName(o.value))
          .join(", ");
        const range = this.store
          .getObjects(s, RDFS_RANGE, null)
          .filter((o) => o.termType === "NamedNode")
          .map((o) => localName(o.value))
          .join(", ");
        return {
          id: localName(s.value),
          label: this.labelOf(s.value),
          domain: domain || "—",
          range: range || "—",
          comment: this.singleLiteral(s.value, `${RDFS_NS}comment`),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));

    const datatypeProperties = this.store
      .getSubjects(RDF_TYPE, namedNode(`${OWL_NS}DatatypeProperty`), null)
      .filter((s) => s.termType === "NamedNode" && s.value.startsWith(MYONT_NS))
      .map((s) => {
        const domain = this.store
          .getObjects(s, RDFS_DOMAIN, null)
          .filter((o) => o.termType === "NamedNode")
          .map((o) => localName(o.value))
          .join(", ");
        const range = this.store
          .getObjects(s, RDFS_RANGE, null)
          .filter((o) => o.termType === "NamedNode")
          .map((o) => localName(o.value))
          .join(", ");
        return {
          id: localName(s.value),
          label: this.labelOf(s.value),
          domain: domain || "—",
          range: range || "xsd:string",
        };
      })
      .sort((a, b) => a.domain.localeCompare(b.domain, "pt-BR") || a.id.localeCompare(b.id, "pt-BR"));

    const vocab = this.getVocabularies();
    const instMap = new Map<
      string,
      { id: string; label: string; tipo: string; dispositivos: Array<{ id: string; label: string; tipo: string }> }
    >();

    for (const item of vocab.basesLegais) {
      if (item.kind === "InstrumentoNormativo") {
        instMap.set(item.id, {
          id: item.id,
          label: item.label,
          tipo: item.tipoDetalhe,
          dispositivos: [],
        });
      }
    }
    for (const item of vocab.basesLegais) {
      if (item.kind === "DispositivoLegal" && item.instrumentoId) {
        const parent = instMap.get(item.instrumentoId);
        if (parent) {
          parent.dispositivos.push({
            id: item.id,
            label: item.label,
            tipo: item.tipoDetalhe,
          });
        }
      }
    }

    const varsCount = this.listVariables().length;
    const risksCount = this.store.getSubjects(RDF_TYPE, namedNode(`${MYONT_NS}Risco`), null).length;
    const conceptsCount = this.store.getSubjects(
      RDF_TYPE,
      namedNode(`${MYONT_NS}ConceitoExterno`),
      null,
    ).length;

    return {
      version,
      label,
      comment,
      stats: {
        classes: classes.length,
        objectProperties: objectProperties.length,
        datatypeProperties: datatypeProperties.length,
        variaveis: varsCount,
        riscos: risksCount,
        instrumentos: instMap.size,
        dispositivos: vocab.basesLegais.filter((b) => b.kind === "DispositivoLegal").length,
        conceitosExternos: conceptsCount,
      },
      classes,
      objectProperties,
      datatypeProperties,
      instrumentos: Array.from(instMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR"),
      ),
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

  private readRiskNode(riskUri: string): RiskRecord {
    const rNode = namedNode(riskUri);
    const id = localName(riskUri);
    const descricao =
      this.singleLiteral(riskUri, `${MYONT_NS}descricaoRisco`) || this.labelOf(riskUri);

    const nivelObj = this.store.getObjects(
      rNode,
      namedNode(`${MYONT_NS}temNivelRisco`),
      null,
    )[0];
    const nivelRisco =
      nivelObj?.termType === "NamedNode" ? localName(nivelObj.value) : "Risco_Medio";
    const nivelLabel =
      nivelObj?.termType === "NamedNode" ? this.labelOf(nivelObj.value) : "Risco Médio";

    const demandaGovernanca = this.singleLiteral(riskUri, `${MYONT_NS}descricaoDemandaGovernanca`);
    const implicacaoLegal = this.singleLiteral(riskUri, `${MYONT_NS}descricaoImplicacaoLegal`);

    const baseNodes = this.store
      .getObjects(rNode, namedNode(`${MYONT_NS}acionaBaseLegal`), null)
      .filter((o) => o.termType === "NamedNode");
    const basesAcionadas = baseNodes.map((b) => localName(b.value)).sort();
    const basesAcionadasLabels = baseNodes.map((b) => this.labelOf(b.value)).sort();

    return {
      id,
      uri: riskUri,
      descricao,
      nivelRisco,
      nivelLabel,
      demandaGovernanca,
      implicacaoLegal,
      basesAcionadas,
      basesAcionadasLabels,
    };
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

      const authBaseNodes = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}autorizadaPorBaseLegal`), null)
        .filter((o) => o.termType === "NamedNode");
      const basesAutorizadoras = authBaseNodes.map((b) => localName(b.value)).sort();
      const basesAutorizadorasLabels = authBaseNodes.map((b) => this.labelOf(b.value)).sort();

      const riskUris = this.store
        .getObjects(sNode, namedNode(`${MYONT_NS}possuiRisco`), null)
        .filter((o) => o.termType === "NamedNode")
        .map((o) => o.value);
      const riscos = riskUris
        .map((rUri) => this.readRiskNode(rUri))
        .sort((a, b) => (RISK_SEVERITY_ORDER[b.nivelRisco] ?? 0) - (RISK_SEVERITY_ORDER[a.nivelRisco] ?? 0));

      let nivelRiscoMaximo = "";
      let nivelRiscoLabel = "Não avaliado";
      if (riscos.length > 0) {
        const top = riscos[0];
        nivelRiscoMaximo = top.nivelRisco;
        nivelRiscoLabel = top.nivelLabel;
      }

      const restrictedIdSet = new Set<string>();
      const restrictedLblSet = new Set<string>();
      for (const r of riscos) {
        r.basesAcionadas.forEach((b) => restrictedIdSet.add(b));
        r.basesAcionadasLabels.forEach((lbl) => restrictedLblSet.add(lbl));
      }

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
        nivelRiscoMaximo,
        nivelRiscoLabel,
        basesAutorizadoras,
        basesAutorizadorasLabels,
        basesRestringidas: Array.from(restrictedIdSet).sort(),
        basesRestringidasLabels: Array.from(restrictedLblSet).sort(),
        conceitosEquivalentes,
        conceitosBaseados,
        proxyDe,
        derivadaDe,
        descricoes,
        riscos,
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
      if (src.nivelRiscoMaximo === "Risco_Veto" || src.nivelRiscoMaximo === "Risco_Maximo") {
        alerts.push(`${prefix}: origem possui ${src.nivelRiscoLabel}.`);
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

    // Remove nós de Risco antigos da variável personalizada no customStore
    const oldRisks = customStore.getObjects(subj, namedNode(`${MYONT_NS}possuiRisco`), null);
    for (const rObj of oldRisks) {
      if (rObj.termType === "NamedNode") {
        customStore.removeQuads(customStore.getQuads(rObj, null, null, null));
      }
    }
    customStore.removeQuads(customStore.getQuads(subj, null, null, null));

    const quads: Quad[] = [];
    const add = (
      subject: ReturnType<typeof namedNode>,
      pred: string,
      obj: ReturnType<typeof namedNode> | ReturnType<typeof literal>,
    ) => {
      quads.push(DataFactory.quad(subject, namedNode(pred), obj));
    };

    add(subj, `${RDF_NS}type`, OWL_NAMED_INDIVIDUAL);
    add(subj, `${RDF_NS}type`, namedNode(`${MYONT_NS}Variavel`));
    if (payload.sensivel) {
      add(subj, `${RDF_NS}type`, namedNode(`${MYONT_NS}VariavelSensivel`));
    }

    add(subj, `${RDFS_NS}label`, literal(payload.label.trim(), "pt-br"));
    add(
      subj,
      `${MYONT_NS}temStatusCuradoria`,
      namedNode(`${MYONT_NS}${payload.statusCuradoria || "Status_PendenteRevisaoJuridica"}`),
    );

    for (const bId of payload.basesAutorizadoras ?? []) {
      add(subj, `${MYONT_NS}autorizadaPorBaseLegal`, namedNode(`${MYONT_NS}${bId}`));
    }
    for (const curie of payload.conceitosEquivalentes ?? []) {
      add(subj, `${MYONT_NS}equivalenteAConceitoExterno`, namedNode(resolveCurie(curie)));
    }
    for (const curie of payload.conceitosBaseados ?? []) {
      add(subj, `${MYONT_NS}baseadaEmConceitoExterno`, namedNode(resolveCurie(curie)));
    }
    for (const pId of payload.proxyDe ?? []) {
      if (pId !== targetId) {
        add(subj, `${MYONT_NS}atuaComoProxyDe`, namedNode(`${MYONT_NS}${pId}`));
      }
    }
    for (const dId of payload.derivadaDe ?? []) {
      if (dId !== targetId) {
        add(subj, `${MYONT_NS}derivadaDe`, namedNode(`${MYONT_NS}${dId}`));
      }
    }

    for (const field of DESC_FIELDS) {
      const val = (payload.descricoes?.[field.key] ?? "").trim();
      if (val) {
        add(subj, field.predicate, literal(val, namedNode(`${XSD_NS}string`)));
      }
    }

    const validRisks = (payload.riscos ?? []).filter((r) => r.descricao.trim().length > 0);
    validRisks.forEach((risk, idx) => {
      const riskId = `Risco_${targetId}_${idx + 1}`;
      const rSubj = namedNode(`${MYONT_NS}${riskId}`);
      add(subj, `${MYONT_NS}possuiRisco`, rSubj);

      add(rSubj, `${RDF_NS}type`, OWL_NAMED_INDIVIDUAL);
      add(rSubj, `${RDF_NS}type`, namedNode(`${MYONT_NS}Risco`));
      add(rSubj, `${RDFS_NS}label`, literal(risk.descricao.trim(), "pt-br"));
      add(
        rSubj,
        `${MYONT_NS}descricaoRisco`,
        literal(risk.descricao.trim(), namedNode(`${XSD_NS}string`)),
      );
      add(
        rSubj,
        `${MYONT_NS}temNivelRisco`,
        namedNode(`${MYONT_NS}${risk.nivelRisco || "Risco_Medio"}`),
      );
      if (risk.demandaGovernanca?.trim()) {
        add(
          rSubj,
          `${MYONT_NS}descricaoDemandaGovernanca`,
          literal(risk.demandaGovernanca.trim(), namedNode(`${XSD_NS}string`)),
        );
      }
      if (risk.implicacaoLegal?.trim()) {
        add(
          rSubj,
          `${MYONT_NS}descricaoImplicacaoLegal`,
          literal(risk.implicacaoLegal.trim(), namedNode(`${XSD_NS}string`)),
        );
      }
      for (const bId of risk.basesAcionadas ?? []) {
        add(rSubj, `${MYONT_NS}acionaBaseLegal`, namedNode(`${MYONT_NS}${bId}`));
      }
    });

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
      totalRiscos: number;
    };
  } {
    const all = this.listVariables();
    const byId = new Map(all.map((v) => [v.id, v]));
    const selected = variableIds
      .map((id) => byId.get(id))
      .filter((v): v is VariableRecord => Boolean(v));

    const vetosOrMaxima = selected.filter(
      (v) => v.nivelRiscoMaximo === "Risco_Veto" || v.nivelRiscoMaximo === "Risco_Maximo",
    ).length;
    const sensiveis = selected.filter((v) => v.sensivel).length;
    const proxies = selected.filter((v) => v.isProxy).length;
    const pendentes = selected.filter((v) => v.statusCuradoria !== "Status_Auditada").length;
    const totalRiscos = selected.reduce((acc, v) => acc + v.riscos.length, 0);

    const now = new Date().toLocaleString("pt-BR");
    const lines: string[] = [
      `# Relatório Preventivo de Governança Algorítmica (MyOnt V2) — ${modelName || "Modelo de Crédito"}`,
      `**Gerado em:** ${now}  `,
      `**Variáveis selecionadas:** ${selected.length} | **Riscos mapeados:** ${totalRiscos}  `,
      "",
      "## 1. Resumo Executivo de Riscos",
      `- **Variáveis com Risco Veto / Máximo:** ${vetosOrMaxima}`,
      `- **Total de Riscos Identificados:** ${totalRiscos}`,
      `- **Variáveis Sensíveis / Protegidas:** ${sensiveis}`,
      `- **Variáveis com Atuação como Proxy:** ${proxies}`,
      `- **Pendentes de Revisão Jurídica:** ${pendentes}`,
      "",
      "## 2. Detalhamento Jurídico, Riscos e Lastro Semântico",
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
        `- **Maior Nível de Risco:** ${v.nivelRiscoLabel}`,
        `- **Status de Curadoria:** ${v.statusLabel}`,
        `- **Variável Sensível:** ${v.sensivel ? "Sim" : "Não"}`,
        `- **Atua como Proxy de:** ${proxiesLbl.length > 0 ? proxiesLbl.join(", ") : "Nenhuma ligação direta mapeada"}`,
        `- **Derivada de:** ${derivLbl.length > 0 ? derivLbl.join(", ") : "—"}`,
        `- **Lastro Externo (Schema.org):** ${conceitos.length > 0 ? conceitos.join(", ") : "Sem vínculo externo"}`,
        `- **Bases Legais Autorizadoras (Uso):** ${v.basesAutorizadorasLabels.length > 0 ? v.basesAutorizadorasLabels.join(", ") : "Não informada"}`,
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

      if (v.riscos.length > 0) {
        lines.push("- **Riscos Associados (`myont:Risco`):**");
        v.riscos.forEach((r, i) => {
          lines.push(`  ${i + 1}. **[${r.nivelLabel}]** ${r.descricao}`);
          if (r.demandaGovernanca) {
            lines.push(`     - *Demanda de Governança:* ${r.demandaGovernanca}`);
          }
          if (r.implicacaoLegal) {
            lines.push(`     - *Implicação Legal:* ${r.implicacaoLegal}`);
          }
          if (r.basesAcionadasLabels.length > 0) {
            lines.push(`     - *Normas / Dispositivos Acionados:* ${r.basesAcionadasLabels.join(", ")}`);
          }
        });
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
        totalRiscos,
      },
    };
  }
}
