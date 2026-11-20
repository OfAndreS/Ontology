"""Serviço de domínio semântico via SPARQL (Fuseki / RDFLib)."""

from __future__ import annotations

from collections import deque
from datetime import datetime
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

from app.fuseki import GRAPH_DATA, GraphBackend, get_graph_backend
from app.models import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    ExternalConceptRead,
    LawCreate,
    LawDeviceRead,
    LawRead,
    LawUpdate,
    LegalBaseVocabItem,
    ReportResponse,
    ReportSummary,
    RiskRead,
    VariableDescriptions,
    VariableDetailRead,
    VariablePayload,
    VariableRead,
    VariableRef,
    VocabItem,
    VocabulariesRead,
)

MYONT_NS = "https://ontologia.governanca.credito/myont#"
SCHEMA_NS = "https://schema.org/"

PREFIXES = """
PREFIX myont: <https://ontologia.governanca.credito/myont#>
PREFIX schema: <https://schema.org/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
""".strip()

RISK_SEVERITY_ORDER: Dict[str, int] = {
    "Risco_Baixo": 1,
    "Risco_Medio": 2,
    "Risco_Alto": 3,
    "Risco_Maximo": 4,
    "Risco_Veto": 5,
}

DESC_PREDICATES: List[Tuple[str, str, str]] = [
    ("origem", "myont:descricaoOrigem", "Origem Sugerida"),
    ("justificativa_legal", "myont:descricaoJustificativaLegal", "Justificativa Legal de Uso"),
    ("explicabilidade", "myont:descricaoExplicabilidade", "Explicabilidade Necessária"),
    ("atuacao_proxy", "myont:descricaoAtuacaoProxy", "Atuação como Proxy"),
]


def local_name(uri: str) -> str:
    if "#" in uri:
        return uri.rsplit("#", 1)[1]
    return uri.rstrip("/").rsplit("/", 1)[-1]


def to_curie(uri: str) -> str:
    if uri.startswith(SCHEMA_NS):
        return f"schema:{uri[len(SCHEMA_NS):]}"
    if uri.startswith(MYONT_NS):
        return f"myont:{uri[len(MYONT_NS):]}"
    return uri


def resolve_curie_uri(val: str) -> str:
    val = val.strip()
    if val.startswith("http://") or val.startswith("https://"):
        return val
    if val.startswith("schema:"):
        return f"{SCHEMA_NS}{val[7:]}"
    if val.startswith("myont:"):
        return f"{MYONT_NS}{val[6:]}"
    return f"{MYONT_NS}{val}"


def sanitize_identifier(raw: str, prefix: str = "") -> str:
    """Normaliza um texto para identificador seguro de URI (PascalCase ou slug)."""
    norm = unicodedata.normalize("NFD", raw or "")
    ascii_only = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    parts = [p for p in re.split(r"[^a-zA-Z0-9]+", ascii_only) if p]
    if not parts:
        ident = "ItemSemNome"
    else:
        ident = "".join(p[0].upper() + p[1:] if len(p) > 1 else p.upper() for p in parts)
        if ident[0].isdigit():
            ident = f"V{ident}"
    if prefix and not ident.startswith(prefix):
        return f"{prefix}{ident}"
    return ident


def slugify(raw: str) -> str:
    norm = unicodedata.normalize("NFD", raw or "")
    ascii_only = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only.lower()).strip("-")
    return slug or "item"


def sparql_str(value: str) -> str:
    escaped = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\r", " ")
        .replace("\n", "\\n")
    )
    return f'"{escaped}"'


def val(binding: Dict[str, Dict[str, str]], key: str, default: str = "") -> str:
    item = binding.get(key)
    return item.get("value", default) if item else default


class OntologyService:
    """Orquestra consultas e atualizações semânticas no dataset Fuseki."""

    def __init__(self, backend: GraphBackend | None = None) -> None:
        self._backend = backend

    @property
    def backend(self) -> GraphBackend:
        return self._backend or get_graph_backend()

    # ------------------------------------------------------------------
    # Vocabulários e Conceitos Externos
    # ------------------------------------------------------------------

    def get_vocabularies(self) -> VocabulariesRead:
        risk_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label WHERE {{
              ?s a myont:NivelRisco .
              OPTIONAL {{ ?s rdfs:label ?label }}
            }}"""
        )
        niveis_risco = [
            VocabItem(id=local_name(val(r, "s")), label=val(r, "label") or local_name(val(r, "s")))
            for r in risk_rows
        ]
        niveis_risco.sort(key=lambda x: RISK_SEVERITY_ORDER.get(x.id, 99))

        status_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label WHERE {{
              ?s a myont:StatusCuradoria .
              OPTIONAL {{ ?s rdfs:label ?label }}
            }}"""
        )
        status_curadoria = sorted(
            [
                VocabItem(id=local_name(val(r, "s")), label=val(r, "label") or local_name(val(r, "s")))
                for r in status_rows
            ],
            key=lambda x: x.label.lower(),
        )

        inst_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label ?tipo WHERE {{
              ?s a myont:InstrumentoNormativo .
              OPTIONAL {{ ?s rdfs:label ?label }}
              OPTIONAL {{ ?s myont:tipoInstrumento ?tipo }}
            }}"""
        )
        inst_labels: Dict[str, str] = {}
        bases_legais: List[LegalBaseVocabItem] = []
        for r in inst_rows:
            uri = val(r, "s")
            bid = local_name(uri)
            lbl = val(r, "label") or bid
            inst_labels[bid] = lbl
            bases_legais.append(
                LegalBaseVocabItem(
                    id=bid,
                    uri=uri,
                    label=lbl,
                    kind="InstrumentoNormativo",
                    tipo_detalhe=val(r, "tipo") or "Instrumento",
                )
            )

        dev_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label ?tipo ?inst WHERE {{
              ?s a myont:DispositivoLegal .
              OPTIONAL {{ ?s rdfs:label ?label }}
              OPTIONAL {{ ?s myont:tipoDispositivo ?tipo }}
              OPTIONAL {{ ?s myont:pertenceAInstrumento ?inst }}
            }}"""
        )
        for r in dev_rows:
            uri = val(r, "s")
            bid = local_name(uri)
            lbl = val(r, "label") or bid
            inst_uri = val(r, "inst")
            inst_id = local_name(inst_uri) if inst_uri else None
            bases_legais.append(
                LegalBaseVocabItem(
                    id=bid,
                    uri=uri,
                    label=lbl,
                    kind="DispositivoLegal",
                    tipo_detalhe=val(r, "tipo") or "Dispositivo",
                    instrumento_id=inst_id,
                    instrumento_label=inst_labels.get(inst_id, inst_id) if inst_id else None,
                )
            )

        bases_legais.sort(key=lambda x: x.label.lower())

        return VocabulariesRead(
            bases_legais=bases_legais,
            niveis_risco=niveis_risco,
            status_curadoria=status_curadoria,
            tipos_instrumento=[
                "Constituição",
                "Lei",
                "Decreto",
                "Resolução",
                "Regulação Setorial",
                "Súmula/Jurisprudência",
                "Guia/Autorregulação",
            ],
            tipos_dispositivo=[
                "Artigo",
                "Parágrafo",
                "Inciso",
                "Alínea",
                "Enunciado",
                "Princípio",
            ],
        )

    def list_concepts(self, q: str = "") -> List[ExternalConceptRead]:
        rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label ?comment ?ont ?tipo ?ctx WHERE {{
              ?s a myont:ConceitoExterno .
              OPTIONAL {{ ?s rdfs:label ?label }}
              OPTIONAL {{ ?s rdfs:comment ?comment }}
              OPTIONAL {{ ?s myont:ontologiaOrigem ?ont }}
              OPTIONAL {{ ?s myont:tipoTermoExterno ?tipo }}
              OPTIONAL {{ ?s myont:contextoExterno ?ctx }}
            }}"""
        )
        term = q.strip().lower()
        concepts: List[ExternalConceptRead] = []
        for r in rows:
            uri = val(r, "s")
            curie = to_curie(uri)
            label = val(r, "label") or local_name(uri)
            comment = val(r, "comment")
            ctx = val(r, "ctx")
            if term and not any(
                term in field.lower() for field in (label, curie, comment, ctx)
            ):
                continue
            concepts.append(
                ExternalConceptRead(
                    uri=uri,
                    curie=curie,
                    label=label,
                    comment=comment,
                    ontologia=val(r, "ont") or "Schema.org",
                    tipo=val(r, "tipo"),
                    contexto=ctx,
                )
            )
        concepts.sort(key=lambda c: c.label.lower())
        return concepts

    # ------------------------------------------------------------------
    # Categorias Temáticas (Decisão 08)
    # ------------------------------------------------------------------

    def list_categories(self) -> List[CategoryRead]:
        cat_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label ?slug ?desc WHERE {{
              ?s a myont:Categoria .
              OPTIONAL {{ ?s rdfs:label ?label }}
              OPTIONAL {{ ?s myont:slugCategoria ?slug }}
              OPTIONAL {{ ?s myont:descricaoCategoria ?desc }}
            }}"""
        )
        count_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?cat (COUNT(DISTINCT ?v) AS ?cnt) WHERE {{
              ?v a myont:Variavel ;
                 myont:pertenceACategoria ?cat .
            }} GROUP BY ?cat"""
        )
        counts = {local_name(val(r, "cat")): int(val(r, "cnt", "0")) for r in count_rows}

        categories: List[CategoryRead] = []
        for r in cat_rows:
            uri = val(r, "s")
            cid = local_name(uri)
            label = val(r, "label") or cid
            categories.append(
                CategoryRead(
                    id=cid,
                    uri=uri,
                    slug=val(r, "slug") or slugify(label),
                    label=label,
                    description=val(r, "desc"),
                    variable_count=counts.get(cid, 0),
                )
            )
        categories.sort(key=lambda c: c.label.lower())
        return categories

    def get_category(self, category_id_or_slug: str) -> Optional[CategoryRead]:
        target = category_id_or_slug.strip().lower()
        for cat in self.list_categories():
            if cat.id.lower() == target or cat.slug.lower() == target:
                return cat
        return None

    def create_category(self, payload: CategoryCreate) -> CategoryRead:
        cid = sanitize_identifier(payload.id or payload.label, prefix="Cat_")
        if self.get_category(cid):
            raise ValueError(f"Categoria '{cid}' já existe.")
        cat_slug = slugify(payload.label)
        for existing in self.list_categories():
            if existing.slug == cat_slug or existing.label.lower() == payload.label.strip().lower():
                raise ValueError(f"Já existe uma categoria chamada '{existing.label}'.")

        triples = [
            f"myont:{cid} rdf:type owl:NamedIndividual , myont:Categoria .",
            f"myont:{cid} rdfs:label {sparql_str(payload.label.strip())}@pt-br .",
            f"myont:{cid} myont:slugCategoria {sparql_str(cat_slug)}^^xsd:string .",
        ]
        if payload.description.strip():
            triples.append(
                f"myont:{cid} myont:descricaoCategoria {sparql_str(payload.description.strip())}^^xsd:string ."
            )
        self.backend.update(
            f"{PREFIXES}\nINSERT DATA {{\n  GRAPH <{GRAPH_DATA}> {{\n    "
            + "\n    ".join(triples)
            + "\n  }\n}"
        )
        created = self.get_category(cid)
        if not created:
            raise RuntimeError("Falha ao recuperar categoria criada.")
        return created

    def update_category(self, category_id_or_slug: str, payload: CategoryUpdate) -> CategoryRead:
        existing = self.get_category(category_id_or_slug)
        if not existing:
            raise KeyError("Categoria não encontrada.")

        new_label = payload.label.strip() if payload.label is not None else existing.label
        new_desc = payload.description.strip() if payload.description is not None else existing.description
        new_slug = slugify(new_label)

        inserts = [
            f"myont:{existing.id} rdfs:label {sparql_str(new_label)}@pt-br .",
            f"myont:{existing.id} myont:slugCategoria {sparql_str(new_slug)}^^xsd:string .",
        ]
        if new_desc:
            inserts.append(
                f"myont:{existing.id} myont:descricaoCategoria {sparql_str(new_desc)}^^xsd:string ."
            )

        self.backend.update(
            f"""{PREFIXES}
            DELETE {{
              GRAPH <{GRAPH_DATA}> {{
                myont:{existing.id} rdfs:label ?l .
                myont:{existing.id} myont:slugCategoria ?s .
                myont:{existing.id} myont:descricaoCategoria ?d .
              }}
            }}
            INSERT {{
              GRAPH <{GRAPH_DATA}> {{
                {' '.join(inserts)}
              }}
            }}
            WHERE {{
              GRAPH <{GRAPH_DATA}> {{
                myont:{existing.id} a myont:Categoria .
                OPTIONAL {{ myont:{existing.id} rdfs:label ?l }}
                OPTIONAL {{ myont:{existing.id} myont:slugCategoria ?s }}
                OPTIONAL {{ myont:{existing.id} myont:descricaoCategoria ?d }}
              }}
            }}"""
        )
        updated = self.get_category(existing.id)
        if not updated:
            raise RuntimeError("Falha ao atualizar categoria.")
        return updated

    def delete_category(self, category_id_or_slug: str) -> None:
        existing = self.get_category(category_id_or_slug)
        if not existing:
            raise KeyError("Categoria não encontrada.")
        if existing.variable_count > 0:
            raise ValueError(
                f"Não é possível excluir a categoria '{existing.label}' pois há {existing.variable_count} variável(is) vinculada(s)."
            )
        self.backend.update(
            f"""{PREFIXES}
            DELETE WHERE {{
              GRAPH <{GRAPH_DATA}> {{
                myont:{existing.id} ?p ?o .
              }}
            }}"""
        )

    # ------------------------------------------------------------------
    # Normas e Dispositivos Legais
    # ------------------------------------------------------------------

    def list_laws(self) -> List[LawRead]:
        inst_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?s ?label ?tipo ?desc ?url ?pub WHERE {{
              ?s a myont:InstrumentoNormativo .
              OPTIONAL {{ ?s rdfs:label ?label }}
              OPTIONAL {{ ?s myont:tipoInstrumento ?tipo }}
              OPTIONAL {{ ?s myont:descricaoNorma ?desc }}
              OPTIONAL {{ ?s myont:urlFonteNorma ?url }}
              OPTIONAL {{ ?s myont:dataPublicacaoNorma ?pub }}
            }}"""
        )
        dev_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?d ?label ?tipo ?desc ?inst WHERE {{
              ?d a myont:DispositivoLegal ;
                 myont:pertenceAInstrumento ?inst .
              OPTIONAL {{ ?d rdfs:label ?label }}
              OPTIONAL {{ ?d myont:tipoDispositivo ?tipo }}
              OPTIONAL {{ ?d myont:descricaoNorma ?desc }}
            }}"""
        )

        # Variáveis ligadas direta ou indiretamente (via dispositivo/risco) a cada instrumento
        var_links_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT DISTINCT ?inst ?v ?vLabel WHERE {{
              ?v a myont:Variavel .
              OPTIONAL {{ ?v rdfs:label ?vLabel }}
              {{
                ?v myont:autorizadaPorBaseLegal ?inst .
                ?inst a myont:InstrumentoNormativo .
              }} UNION {{
                ?v myont:autorizadaPorBaseLegal ?dev .
                ?dev myont:pertenceAInstrumento ?inst .
              }} UNION {{
                ?v myont:possuiRisco ?r .
                ?r myont:acionaBaseLegal ?inst .
                ?inst a myont:InstrumentoNormativo .
              }} UNION {{
                ?v myont:possuiRisco ?r .
                ?r myont:acionaBaseLegal ?dev .
                ?dev myont:pertenceAInstrumento ?inst .
              }}
            }}"""
        )

        devices_by_inst: Dict[str, List[LawDeviceRead]] = {}
        for r in dev_rows:
            inst_id = local_name(val(r, "inst"))
            d_uri = val(r, "d")
            d_id = local_name(d_uri)
            devices_by_inst.setdefault(inst_id, []).append(
                LawDeviceRead(
                    id=d_id,
                    uri=d_uri,
                    label=val(r, "label") or d_id,
                    tipo_dispositivo=val(r, "tipo") or "Artigo",
                    descricao=val(r, "desc"),
                )
            )
        for devs in devices_by_inst.values():
            devs.sort(key=lambda d: d.label.lower())

        vars_by_inst: Dict[str, List[Dict[str, str]]] = {}
        seen_pairs: set[Tuple[str, str]] = set()
        for r in var_links_rows:
            inst_id = local_name(val(r, "inst"))
            v_id = local_name(val(r, "v"))
            if (inst_id, v_id) in seen_pairs:
                continue
            seen_pairs.add((inst_id, v_id))
            vars_by_inst.setdefault(inst_id, []).append(
                {"id": v_id, "label": val(r, "vLabel") or v_id}
            )
        for vlist in vars_by_inst.values():
            vlist.sort(key=lambda x: x["label"].lower())

        laws: List[LawRead] = []
        for r in inst_rows:
            uri = val(r, "s")
            lid = local_name(uri)
            label = val(r, "label") or lid
            laws.append(
                LawRead(
                    id=lid,
                    uri=uri,
                    slug=slugify(lid),
                    label=label,
                    tipo_instrumento=val(r, "tipo") or "Lei",
                    descricao=val(r, "desc"),
                    url_fonte=val(r, "url") or None,
                    data_publicacao=val(r, "pub") or None,
                    dispositivos=devices_by_inst.get(lid, []),
                    linked_variables=vars_by_inst.get(lid, []),
                )
            )
        laws.sort(key=lambda l: l.label.lower())
        return laws

    def get_law(self, identifier: str) -> Optional[LawRead]:
        target = identifier.strip().lower()
        for law in self.list_laws():
            if law.id.lower() == target or law.slug.lower() == target:
                return law
        return None

    def _build_law_triples(
        self,
        law_id: str,
        label: str,
        tipo_instrumento: str,
        descricao: str,
        url_fonte: Optional[str],
        data_publicacao: Optional[str],
        dispositivos: List[dict],
    ) -> List[str]:
        t = [
            f"myont:{law_id} rdf:type owl:NamedIndividual , myont:InstrumentoNormativo .",
            f"myont:{law_id} rdfs:label {sparql_str(label.strip())}@pt-br .",
            f"myont:{law_id} myont:tipoInstrumento {sparql_str(tipo_instrumento.strip() or 'Lei')}^^xsd:string .",
        ]
        if descricao.strip():
            t.append(f"myont:{law_id} myont:descricaoNorma {sparql_str(descricao.strip())}^^xsd:string .")
        if url_fonte and url_fonte.strip():
            t.append(f"myont:{law_id} myont:urlFonteNorma {sparql_str(url_fonte.strip())}^^xsd:anyURI .")
        if data_publicacao and data_publicacao.strip():
            t.append(
                f"myont:{law_id} myont:dataPublicacaoNorma {sparql_str(data_publicacao.strip())}^^xsd:string ."
            )

        for idx, dev in enumerate(dispositivos, start=1):
            dev_id = (
                sanitize_identifier(dev.get("id") or "")
                if dev.get("id")
                else sanitize_identifier(f"{law_id}_{dev['label']}_{idx}")
            )
            t.extend([
                f"myont:{dev_id} rdf:type owl:NamedIndividual , myont:DispositivoLegal .",
                f"myont:{dev_id} rdfs:label {sparql_str(dev['label'].strip())}@pt-br .",
                f"myont:{dev_id} myont:tipoDispositivo {sparql_str((dev.get('tipo_dispositivo') or 'Artigo').strip())}^^xsd:string .",
                f"myont:{dev_id} myont:pertenceAInstrumento myont:{law_id} .",
            ])
            if (dev.get("descricao") or "").strip():
                t.append(
                    f"myont:{dev_id} myont:descricaoNorma {sparql_str(dev['descricao'].strip())}^^xsd:string ."
                )
        return t

    def create_law(self, payload: LawCreate) -> LawRead:
        law_id = sanitize_identifier(payload.id or payload.label, prefix="Norma_")
        if self.get_law(law_id):
            raise ValueError(f"Norma '{law_id}' já existe.")
        for existing in self.list_laws():
            if existing.label.lower() == payload.label.strip().lower():
                raise ValueError(f"Já existe uma norma com o nome '{existing.label}'.")

        triples = self._build_law_triples(
            law_id=law_id,
            label=payload.label,
            tipo_instrumento=payload.tipo_instrumento,
            descricao=payload.descricao,
            url_fonte=payload.url_fonte,
            data_publicacao=payload.data_publicacao,
            dispositivos=[d.model_dump() for d in payload.dispositivos],
        )
        self.backend.update(
            f"{PREFIXES}\nINSERT DATA {{\n  GRAPH <{GRAPH_DATA}> {{\n    "
            + "\n    ".join(triples)
            + "\n  }\n}"
        )
        created = self.get_law(law_id)
        if not created:
            raise RuntimeError("Falha ao recuperar norma criada.")
        return created

    def update_law(self, identifier: str, payload: LawUpdate) -> LawRead:
        existing = self.get_law(identifier)
        if not existing:
            raise KeyError("Norma não encontrada.")

        new_label = payload.label if payload.label is not None else existing.label
        new_tipo = payload.tipo_instrumento if payload.tipo_instrumento is not None else existing.tipo_instrumento
        new_desc = payload.descricao if payload.descricao is not None else existing.descricao
        new_url = payload.url_fonte if payload.url_fonte is not None else existing.url_fonte
        new_pub = payload.data_publicacao if payload.data_publicacao is not None else existing.data_publicacao
        if payload.dispositivos is not None:
            new_devs = [d.model_dump() for d in payload.dispositivos]
        else:
            new_devs = [
                {
                    "id": d.id,
                    "label": d.label,
                    "tipo_dispositivo": d.tipo_dispositivo,
                    "descricao": d.descricao,
                }
                for d in existing.dispositivos
            ]

        triples = self._build_law_triples(
            law_id=existing.id,
            label=new_label,
            tipo_instrumento=new_tipo,
            descricao=new_desc,
            url_fonte=new_url,
            data_publicacao=new_pub,
            dispositivos=new_devs,
        )

        # Remove triplas do instrumento e de seus dispositivos atuais no grafo de dados
        delete_clauses = [f"myont:{existing.id} ?p ?o ."]
        for d in existing.dispositivos:
            delete_clauses.append(f"myont:{d.id} ?dp_{d.id} ?do_{d.id} .")

        self.backend.update(
            f"""{PREFIXES}
            DELETE WHERE {{
              GRAPH <{GRAPH_DATA}> {{
                myont:{existing.id} ?p ?o .
              }}
            }}"""
        )
        for d in existing.dispositivos:
            self.backend.update(
                f"""{PREFIXES}
                DELETE WHERE {{
                  GRAPH <{GRAPH_DATA}> {{
                    myont:{d.id} ?p ?o .
                  }}
                }}"""
            )

        self.backend.update(
            f"{PREFIXES}\nINSERT DATA {{\n  GRAPH <{GRAPH_DATA}> {{\n    "
            + "\n    ".join(triples)
            + "\n  }\n}"
        )
        updated = self.get_law(existing.id)
        if not updated:
            raise RuntimeError("Falha ao recuperar norma atualizada.")
        return updated

    def delete_law(self, identifier: str) -> LawRead:
        existing = self.get_law(identifier)
        if not existing:
            raise KeyError("Norma não encontrada.")

        # Remove referências à norma e seus dispositivos no grafo de dados e apaga os nós
        targets = [existing.id] + [d.id for d in existing.dispositivos]
        for tid in targets:
            self.backend.update(
                f"""{PREFIXES}
                DELETE WHERE {{
                  GRAPH <{GRAPH_DATA}> {{
                    myont:{tid} ?p ?o .
                  }}
                }}"""
            )
            self.backend.update(
                f"""{PREFIXES}
                DELETE WHERE {{
                  GRAPH <{GRAPH_DATA}> {{
                    ?s ?p myont:{tid} .
                  }}
                }}"""
            )
        return existing

    # ------------------------------------------------------------------
    # Variáveis, Riscos e Linhagem
    # ------------------------------------------------------------------

    def list_variables(
        self,
        q: str = "",
        category_id: str = "",
        nivel_risco: str = "",
        sensivel: Optional[bool] = None,
        is_proxy: Optional[bool] = None,
        status: str = "",
    ) -> List[VariableRead]:
        vocab = self.get_vocabularies()
        base_label_by_id = {b.id: b.label for b in vocab.bases_legais}
        nivel_label_by_id = {n.id: n.label for n in vocab.niveis_risco}
        status_label_by_id = {s.id: s.label for s in vocab.status_curadoria}

        cat_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?c ?label WHERE {{
              ?c a myont:Categoria .
              OPTIONAL {{ ?c rdfs:label ?label }}
            }}"""
        )
        cat_label_by_id = {local_name(val(r, "c")): (val(r, "label") or local_name(val(r, "c"))) for r in cat_rows}

        var_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?v ?label ?status ?cat ?origem ?just ?expl ?proxyTxt WHERE {{
              ?v a myont:Variavel .
              OPTIONAL {{ ?v rdfs:label ?label }}
              OPTIONAL {{ ?v myont:temStatusCuradoria ?status }}
              OPTIONAL {{ ?v myont:pertenceACategoria ?cat }}
              OPTIONAL {{ ?v myont:descricaoOrigem ?origem }}
              OPTIONAL {{ ?v myont:descricaoJustificativaLegal ?just }}
              OPTIONAL {{ ?v myont:descricaoExplicabilidade ?expl }}
              OPTIONAL {{ ?v myont:descricaoAtuacaoProxy ?proxyTxt }}
            }}"""
        )

        sens_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT DISTINCT ?v WHERE {{ ?v a myont:VariavelSensivel . }}"""
        )
        sens_set = {local_name(val(r, "v")) for r in sens_rows}

        rel_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?v ?p ?o WHERE {{
              ?v a myont:Variavel ;
                 ?p ?o .
              VALUES ?p {{
                myont:autorizadaPorBaseLegal
                myont:atuaComoProxyDe
                myont:derivadaDe
                myont:equivalenteAConceitoExterno
                myont:baseadaEmConceitoExterno
                myont:mapeadaParaConceitoExterno
                myont:possuiRisco
              }}
            }}"""
        )

        risk_rows = self.backend.select(
            f"""{PREFIXES}
            SELECT ?r ?desc ?nivel ?gov ?impl ?base WHERE {{
              ?v a myont:Variavel ;
                 myont:possuiRisco ?r .
              OPTIONAL {{ ?r myont:descricaoRisco ?desc }}
              OPTIONAL {{ ?r rdfs:label ?desc2 }}
              OPTIONAL {{ ?r myont:temNivelRisco ?nivel }}
              OPTIONAL {{ ?r myont:descricaoDemandaGovernanca ?gov }}
              OPTIONAL {{ ?r myont:descricaoImplicacaoLegal ?impl }}
              OPTIONAL {{ ?r myont:acionaBaseLegal ?base }}
            }}"""
        )

        # Agrupa nós de Risco
        risks_map: Dict[str, dict] = {}
        for r in risk_rows:
            r_uri = val(r, "r")
            r_id = local_name(r_uri)
            entry = risks_map.setdefault(
                r_id,
                {
                    "id": r_id,
                    "uri": r_uri,
                    "descricao": val(r, "desc") or r_id,
                    "nivel_risco": local_name(val(r, "nivel")) if val(r, "nivel") else "Risco_Medio",
                    "demanda_governanca": val(r, "gov"),
                    "implicacao_legal": val(r, "impl"),
                    "bases_acionadas": [],
                },
            )
            if val(r, "base"):
                b_id = local_name(val(r, "base"))
                if b_id not in entry["bases_acionadas"]:
                    entry["bases_acionadas"].append(b_id)

        # Agrupa relações das variáveis
        var_rels: Dict[str, Dict[str, List[str]]] = {}
        for r in rel_rows:
            v_id = local_name(val(r, "v"))
            p_name = local_name(val(r, "p"))
            o_uri = val(r, "o")
            bucket = var_rels.setdefault(v_id, {})
            lst = bucket.setdefault(p_name, [])
            if o_uri not in lst:
                lst.append(o_uri)

        records: List[VariableRead] = []
        seen_vars: set[str] = set()
        for r in var_rows:
            v_uri = val(r, "v")
            v_id = local_name(v_uri)
            if v_id in seen_vars:
                continue
            seen_vars.add(v_id)

            rels = var_rels.get(v_id, {})
            bases_auth = sorted({local_name(u) for u in rels.get("autorizadaPorBaseLegal", [])})
            proxy_de = sorted({local_name(u) for u in rels.get("atuaComoProxyDe", [])})
            derivada_de = sorted({local_name(u) for u in rels.get("derivadaDe", [])})
            conc_equiv = sorted({to_curie(u) for u in rels.get("equivalenteAConceitoExterno", [])})
            conc_base = [
                to_curie(u)
                for u in rels.get("baseadaEmConceitoExterno", []) + rels.get("mapeadaParaConceitoExterno", [])
                if to_curie(u) not in conc_equiv
            ]
            conc_base = sorted(set(conc_base))

            risk_objs: List[RiskRead] = []
            restricted_ids: set[str] = set()
            for r_uri in rels.get("possuiRisco", []):
                r_id = local_name(r_uri)
                rdata = risks_map.get(r_id)
                if not rdata:
                    continue
                n_id = rdata["nivel_risco"]
                b_ids = sorted(rdata["bases_acionadas"])
                restricted_ids.update(b_ids)
                risk_objs.append(
                    RiskRead(
                        id=r_id,
                        uri=rdata["uri"],
                        descricao=rdata["descricao"],
                        nivel_risco=n_id,
                        nivel_label=nivel_label_by_id.get(n_id, n_id),
                        demanda_governanca=rdata["demanda_governanca"],
                        implicacao_legal=rdata["implicacao_legal"],
                        bases_acionadas=b_ids,
                        bases_acionadas_labels=[base_label_by_id.get(b, b) for b in b_ids],
                    )
                )
            risk_objs.sort(key=lambda x: RISK_SEVERITY_ORDER.get(x.nivel_risco, 0), reverse=True)

            max_nivel = risk_objs[0].nivel_risco if risk_objs else "Risco_Baixo"
            status_id = local_name(val(r, "status")) if val(r, "status") else "Status_PendenteRevisaoJuridica"
            cat_id = local_name(val(r, "cat")) if val(r, "cat") else None
            bases_rest = sorted(restricted_ids)

            records.append(
                VariableRead(
                    id=v_id,
                    uri=v_uri,
                    label=val(r, "label") or v_id,
                    categoria_id=cat_id,
                    categoria_label=cat_label_by_id.get(cat_id, cat_id) if cat_id else None,
                    sensivel=v_id in sens_set,
                    is_proxy=len(proxy_de) > 0,
                    status_curadoria=status_id,
                    status_label=status_label_by_id.get(status_id, status_id),
                    nivel_risco_maximo=max_nivel,
                    nivel_risco_label=nivel_label_by_id.get(max_nivel, max_nivel),
                    bases_autorizadoras=bases_auth,
                    bases_autorizadoras_labels=[base_label_by_id.get(b, b) for b in bases_auth],
                    bases_restringidas=bases_rest,
                    bases_restringidas_labels=[base_label_by_id.get(b, b) for b in bases_rest],
                    conceitos_equivalentes=conc_equiv,
                    conceitos_baseados=conc_base,
                    proxy_de=proxy_de,
                    derivada_de=derivada_de,
                    descricoes=VariableDescriptions(
                        origem=val(r, "origem"),
                        justificativa_legal=val(r, "just"),
                        explicabilidade=val(r, "expl"),
                        atuacao_proxy=val(r, "proxyTxt"),
                    ),
                    riscos=risk_objs,
                    inherited_alerts=[],
                )
            )

        by_id = {rec.id: rec for rec in records}
        for rec in records:
            rec.inherited_alerts = self._trace_inherited_alerts(rec.id, by_id)

        records.sort(key=lambda x: x.label.lower())

        # Filtros diretos (sem Elasticsearch)
        term = q.strip().lower()
        filtered: List[VariableRead] = []
        for rec in records:
            if category_id and rec.categoria_id != category_id:
                continue
            if nivel_risco and rec.nivel_risco_maximo != nivel_risco:
                continue
            if sensivel is not None and rec.sensivel != sensivel:
                continue
            if is_proxy is not None and rec.is_proxy != is_proxy:
                continue
            if status and rec.status_curadoria != status:
                continue
            if term:
                haystack = " ".join(
                    [
                        rec.id,
                        rec.label,
                        rec.categoria_label or "",
                        rec.descricoes.origem,
                        rec.descricoes.justificativa_legal,
                        rec.descricoes.explicabilidade,
                        rec.descricoes.atuacao_proxy,
                        " ".join(r.descricao for r in rec.riscos),
                        " ".join(rec.conceitos_equivalentes + rec.conceitos_baseados),
                    ]
                ).lower()
                if term not in haystack:
                    continue
            filtered.append(rec)

        return filtered

    def _trace_inherited_alerts(self, var_id: str, by_id: Dict[str, VariableRead]) -> List[str]:
        start = by_id.get(var_id)
        if not start:
            return []
        alerts: List[str] = []
        visited = {var_id}
        queue = deque((d, 1) for d in start.derivada_de if d in by_id)
        while queue:
            src_id, depth = queue.popleft()
            if src_id in visited:
                continue
            visited.add(src_id)
            src = by_id[src_id]
            prefix = f"Derivada de {src.label} (nível {depth})"
            if src.sensivel:
                alerts.append(f"{prefix}: origem é Variável Sensível/Protegida.")
            if src.nivel_risco_maximo in ("Risco_Veto", "Risco_Maximo"):
                alerts.append(f"{prefix}: origem possui severidade {src.nivel_risco_label}.")
            if src.is_proxy:
                proxies = ", ".join(by_id[p].label if p in by_id else p for p in src.proxy_de)
                alerts.append(f"{prefix}: origem atua como proxy de {proxies}.")
            for parent_id in src.derivada_de:
                if parent_id in by_id and parent_id not in visited:
                    queue.append((parent_id, depth + 1))
        return alerts

    def get_variable_detail(self, var_id: str) -> Optional[VariableDetailRead]:
        all_vars = self.list_variables()
        target = next((v for v in all_vars if v.id == var_id), None)
        if not target:
            return None
        reverse_proxies = [
            VariableRef(id=v.id, label=v.label) for v in all_vars if target.id in v.proxy_de
        ]
        derived_children = [
            VariableRef(id=v.id, label=v.label) for v in all_vars if target.id in v.derivada_de
        ]
        return VariableDetailRead(
            **target.model_dump(),
            reverse_proxies=reverse_proxies,
            derived_children=derived_children,
        )

    def save_variable(self, payload: VariablePayload, target_id: Optional[str] = None) -> VariableDetailRead:
        is_update = target_id is not None
        var_id = target_id or sanitize_identifier(payload.id or payload.label)
        existing = self.get_variable_detail(var_id)

        if is_update and not existing:
            raise KeyError(f"Variável '{var_id}' não encontrada.")
        if not is_update and existing:
            raise ValueError(f"Já existe uma variável com ID '{var_id}'.")

        # Remove triplas antigas da variável e seus nós de risco antes de inserir
        if existing:
            self._delete_variable_triples(var_id, [r.id for r in existing.riscos])

        rdf_classes = ["owl:NamedIndividual", "myont:Variavel"]
        if payload.sensivel:
            rdf_classes.append("myont:VariavelSensivel")

        triples: List[str] = [
            f"myont:{var_id} rdf:type {' , '.join(rdf_classes)} .",
            f"myont:{var_id} rdfs:label {sparql_str(payload.label.strip())}@pt-br .",
            f"myont:{var_id} myont:temStatusCuradoria myont:{payload.status_curadoria or 'Status_PendenteRevisaoJuridica'} .",
        ]
        if payload.categoria_id:
            triples.append(f"myont:{var_id} myont:pertenceACategoria myont:{payload.categoria_id} .")

        for b_id in payload.bases_autorizadoras:
            triples.append(f"myont:{var_id} myont:autorizadaPorBaseLegal myont:{b_id} .")
        for curie in payload.conceitos_equivalentes:
            triples.append(
                f"myont:{var_id} myont:equivalenteAConceitoExterno <{resolve_curie_uri(curie)}> ."
            )
        for curie in payload.conceitos_baseados:
            triples.append(
                f"myont:{var_id} myont:baseadaEmConceitoExterno <{resolve_curie_uri(curie)}> ."
            )
        for p_id in payload.proxy_de:
            if p_id != var_id:
                triples.append(f"myont:{var_id} myont:atuaComoProxyDe myont:{p_id} .")
        for d_id in payload.derivada_de:
            if d_id != var_id:
                triples.append(f"myont:{var_id} myont:derivadaDe myont:{d_id} .")

        desc_dict = payload.descricoes.model_dump()
        for key, pred, _ in DESC_PREDICATES:
            val_txt = (desc_dict.get(key) or "").strip()
            if val_txt:
                triples.append(f"myont:{var_id} {pred} {sparql_str(val_txt)}^^xsd:string .")

        valid_risks = [r for r in payload.riscos if r.descricao.strip()]
        for idx, risk in enumerate(valid_risks, start=1):
            r_id = f"Risco_{var_id}_{idx}"
            triples.extend([
                f"myont:{var_id} myont:possuiRisco myont:{r_id} .",
                f"myont:{r_id} rdf:type owl:NamedIndividual , myont:Risco .",
                f"myont:{r_id} rdfs:label {sparql_str(risk.descricao.strip())}@pt-br .",
                f"myont:{r_id} myont:descricaoRisco {sparql_str(risk.descricao.strip())}^^xsd:string .",
                f"myont:{r_id} myont:temNivelRisco myont:{risk.nivel_risco or 'Risco_Medio'} .",
            ])
            if risk.demanda_governanca.strip():
                triples.append(
                    f"myont:{r_id} myont:descricaoDemandaGovernanca {sparql_str(risk.demanda_governanca.strip())}^^xsd:string ."
                )
            if risk.implicacao_legal.strip():
                triples.append(
                    f"myont:{r_id} myont:descricaoImplicacaoLegal {sparql_str(risk.implicacao_legal.strip())}^^xsd:string ."
                )
            for b_id in risk.bases_acionadas:
                triples.append(f"myont:{r_id} myont:acionaBaseLegal myont:{b_id} .")

        self.backend.update(
            f"{PREFIXES}\nINSERT DATA {{\n  GRAPH <{GRAPH_DATA}> {{\n    "
            + "\n    ".join(triples)
            + "\n  }\n}"
        )

        saved = self.get_variable_detail(var_id)
        if not saved:
            raise RuntimeError(f"Falha ao recuperar variável '{var_id}' após gravação.")
        return saved

    def _delete_variable_triples(self, var_id: str, risk_ids: List[str]) -> None:
        self.backend.update(
            f"""{PREFIXES}
            DELETE WHERE {{
              GRAPH <{GRAPH_DATA}> {{
                myont:{var_id} ?p ?o .
              }}
            }}"""
        )
        for r_id in risk_ids:
            self.backend.update(
                f"""{PREFIXES}
                DELETE WHERE {{
                  GRAPH <{GRAPH_DATA}> {{
                    myont:{r_id} ?p ?o .
                  }}
                }}"""
            )

    def delete_variable(self, var_id: str) -> VariableDetailRead:
        existing = self.get_variable_detail(var_id)
        if not existing:
            raise KeyError(f"Variável '{var_id}' não encontrada.")

        self._delete_variable_triples(var_id, [r.id for r in existing.riscos])
        self.backend.update(
            f"""{PREFIXES}
            DELETE WHERE {{
              GRAPH <{GRAPH_DATA}> {{
                ?s ?p myont:{var_id} .
              }}
            }}"""
        )
        return existing

    # ------------------------------------------------------------------
    # Relatório Preventivo Consolidado
    # ------------------------------------------------------------------

    def build_report(self, variable_ids: List[str], model_name: str = "") -> ReportResponse:
        all_vars = self.list_variables()
        by_id = {v.id: v for v in all_vars}
        selected = [by_id[vid] for vid in variable_ids if vid in by_id]

        vetos_or_maxima = sum(
            1 for v in selected if v.nivel_risco_maximo in ("Risco_Veto", "Risco_Maximo")
        )
        sensiveis = sum(1 for v in selected if v.sensivel)
        proxies = sum(1 for v in selected if v.is_proxy)
        pendentes = sum(1 for v in selected if v.status_curadoria != "Status_Auditada")
        total_riscos = sum(len(v.riscos) for v in selected)

        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        title = model_name.strip() or "Modelo de Crédito"
        lines: List[str] = [
            f"# Relatório Preventivo de Governança Algorítmica — {title}",
            f"**Gerado em:** {now}  ",
            f"**Variáveis selecionadas:** {len(selected)} | **Riscos mapeados:** {total_riscos}  ",
            "",
            "## 1. Resumo Executivo de Riscos",
            f"- **Variáveis com Risco Veto / Máximo:** {vetos_or_maxima}",
            f"- **Total de Riscos Identificados:** {total_riscos}",
            f"- **Variáveis Sensíveis / Protegidas:** {sensiveis}",
            f"- **Variáveis com Atuação como Proxy:** {proxies}",
            f"- **Pendentes de Revisão Jurídica:** {pendentes}",
            "",
            "## 2. Detalhamento Jurídico, Riscos e Lastro Semântico",
        ]

        for v in selected:
            conceitos = [f"{c} (Equivalente)" for c in v.conceitos_equivalentes] + [
                f"{c} (Baseada)" for c in v.conceitos_baseados
            ]
            proxies_lbl = [by_id[p].label if p in by_id else p for p in v.proxy_de]
            deriv_lbl = [by_id[d].label if d in by_id else d for d in v.derivada_de]
            desc_dict = v.descricoes.model_dump()

            lines.extend(
                [
                    "",
                    f"### {v.label} (`{v.id}`)",
                    f"- **Categoria:** {v.categoria_label or 'Não categorizada'}",
                    f"- **Maior Nível de Risco:** {v.nivel_risco_label}",
                    f"- **Status de Curadoria:** {v.status_label}",
                    f"- **Variável Sensível:** {'Sim' if v.sensivel else 'Não'}",
                    f"- **Atua como Proxy de:** {', '.join(proxies_lbl) if proxies_lbl else 'Nenhuma ligação direta mapeada'}",
                    f"- **Derivada de:** {', '.join(deriv_lbl) if deriv_lbl else '—'}",
                    f"- **Lastro Externo (Schema.org):** {', '.join(conceitos) if conceitos else 'Sem vínculo externo'}",
                    f"- **Bases Legais Autorizadoras (Uso):** {', '.join(v.bases_autorizadoras_labels) if v.bases_autorizadoras_labels else 'Não informada'}",
                ]
            )

            if v.inherited_alerts:
                lines.append("- **Alertas Propagados por Derivação:**")
                for alert in v.inherited_alerts:
                    lines.append(f"  - {alert}")

            for key, _, label_title in DESC_PREDICATES:
                if desc_dict.get(key):
                    lines.append(f"- **{label_title}:** {desc_dict[key]}")

            if v.riscos:
                lines.append("- **Riscos Associados:**")
                for idx, r in enumerate(v.riscos, start=1):
                    lines.append(f"  {idx}. **[{r.nivel_label}]** {r.descricao}")
                    if r.demanda_governanca:
                        lines.append(f"     - *Demanda de Governança:* {r.demanda_governanca}")
                    if r.implicacao_legal:
                        lines.append(f"     - *Implicação Legal:* {r.implicacao_legal}")
                    if r.bases_acionadas_labels:
                        lines.append(
                            f"     - *Normas / Dispositivos Acionados:* {', '.join(r.bases_acionadas_labels)}"
                        )

        return ReportResponse(
            markdown="\n".join(lines),
            selected_variables=selected,
            summary=ReportSummary(
                total=len(selected),
                vetos_or_maxima=vetos_or_maxima,
                sensiveis=sensiveis,
                proxies=proxies,
                pendentes=pendentes,
                total_riscos=total_riscos,
            ),
        )
