"""Serviço de leitura, inferência e persistência sobre o grafo RDF da MyOnt V1."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from rdflib import Graph, Literal, Namespace, RDF, RDFS, OWL, URIRef, XSD

MYONT = Namespace("https://ontologia.governanca.credito/myont#")
SCHEMA = Namespace("https://schema.org/")

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMA_TTL = ROOT_DIR / "ontology" / "myont_v1.ttl"
CONCEPTS_TTL = ROOT_DIR / "data" / "conceitos_schemaorg.ttl"
VARS_V1_TTL = ROOT_DIR / "data" / "variaveis_schemaorg_v1.ttl"
CUSTOM_VARS_TTL = ROOT_DIR / "data" / "variaveis_custom.ttl"

DESC_FIELDS = [
    ("origem", MYONT.descricaoOrigem, "Origem Sugerida"),
    ("justificativa_legal", MYONT.descricaoJustificativaLegal, "Justificativa Legal"),
    ("risco_etico", MYONT.descricaoRiscoEtico, "Possíveis Viéses / Riscos Éticos"),
    ("demanda_governanca", MYONT.descricaoDemandaGovernanca, "Demanda de Governança"),
    ("explicabilidade", MYONT.descricaoExplicabilidade, "Explicabilidade Necessária"),
    ("implicacao_legal", MYONT.descricaoImplicacaoLegal, "Implicações Legais"),
    ("atuacao_proxy", MYONT.descricaoAtuacaoProxy, "Atuação como Proxy"),
]


@dataclass
class ConceitoExterno:
    uri: str
    curie: str
    label: str
    comment: str
    ontologia: str
    tipo: str
    contexto: str


@dataclass
class VariavelRecord:
    id: str
    uri: str
    label: str
    sensivel: bool
    is_proxy: bool
    status_curadoria: str
    status_label: str
    nivel_governanca: str
    nivel_label: str
    bases_legais: List[str] = field(default_factory=list)
    bases_legais_labels: List[str] = field(default_factory=list)
    conceitos_equivalentes: List[str] = field(default_factory=list)
    conceitos_baseados: List[str] = field(default_factory=list)
    proxy_de: List[str] = field(default_factory=list)
    derivada_de: List[str] = field(default_factory=list)
    descricoes: Dict[str, str] = field(default_factory=dict)


def _local_name(uri: URIRef) -> str:
    s = str(uri)
    if "#" in s:
        return s.split("#", 1)[1]
    return s.rstrip("/").rsplit("/", 1)[-1]


def _to_curie(uri: URIRef) -> str:
    s = str(uri)
    if s.startswith(str(SCHEMA)):
        return "schema:" + s[len(str(SCHEMA)):]
    if s.startswith(str(MYONT)):
        return "myont:" + s[len(str(MYONT)):]
    return s


def sanitize_identifier(name: str) -> str:
    """Converte um nome livre em PascalCase ASCII válido para fragmento de URI."""
    ascii_map = str.maketrans(
        "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ",
        "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC",
    )
    cleaned = name.translate(ascii_map)
    tokens = re.findall(r"[A-Za-z0-9]+", cleaned)
    if not tokens:
        return "NovaVariavel"
    result = "".join(t[0].upper() + t[1:] for t in tokens)
    if result[0].isdigit():
        result = "Var" + result
    return result


class OntologyService:
    """Encapsula consultas e atualizações no grafo RDF (MyOnt + Conceitos + Variáveis)."""

    def __init__(
        self,
        schema_ttl: Path = SCHEMA_TTL,
        concepts_ttl: Path = CONCEPTS_TTL,
        vars_v1_ttl: Path = VARS_V1_TTL,
        custom_vars_ttl: Path = CUSTOM_VARS_TTL,
    ) -> None:
        self.schema_ttl = schema_ttl
        self.concepts_ttl = concepts_ttl
        self.vars_v1_ttl = vars_v1_ttl
        self.custom_vars_ttl = custom_vars_ttl
        self.graph = Graph()
        self.reload()

    def reload(self) -> None:
        self.graph = Graph()
        self.graph.bind("myont", MYONT)
        self.graph.bind("schema", SCHEMA)
        for path in (self.schema_ttl, self.concepts_ttl):
            if path.exists():
                self.graph.parse(str(path), format="turtle")

        overridden_subjects: Set[URIRef] = set()
        custom_g = Graph()
        if self.custom_vars_ttl.exists():
            custom_g.parse(str(self.custom_vars_ttl), format="turtle")
            overridden_subjects = {s for s in custom_g.subjects() if isinstance(s, URIRef)}

        if self.vars_v1_ttl.exists():
            v1_g = Graph()
            v1_g.parse(str(self.vars_v1_ttl), format="turtle")
            for subj in overridden_subjects:
                v1_g.remove((subj, None, None))
            self.graph += v1_g

        self.graph += custom_g

    def _label_of(self, node: URIRef) -> str:
        lbl = self.graph.value(node, RDFS.label)
        return str(lbl) if lbl else _local_name(node)

    def get_controlled_vocabulary(self, cls_uri: URIRef) -> Dict[str, str]:
        """Retorna {id: label} para indivíduos de uma classe de apoio."""
        items: Dict[str, str] = {}
        for subj in self.graph.subjects(RDF.type, cls_uri):
            if isinstance(subj, URIRef):
                items[_local_name(subj)] = self._label_of(subj)
        return dict(sorted(items.items(), key=lambda kv: kv[1]))

    def list_external_concepts(self) -> List[ConceitoExterno]:
        """Lista todos os nós myont:ConceitoExterno do índice pré-processado."""
        concepts: List[ConceitoExterno] = []
        for subj in self.graph.subjects(RDF.type, MYONT.ConceitoExterno):
            if not isinstance(subj, URIRef):
                continue
            concepts.append(
                ConceitoExterno(
                    uri=str(subj),
                    curie=_to_curie(subj),
                    label=self._label_of(subj),
                    comment=str(self.graph.value(subj, RDFS.comment) or ""),
                    ontologia=str(self.graph.value(subj, MYONT.ontologiaOrigem) or ""),
                    tipo=str(self.graph.value(subj, MYONT.tipoTermoExterno) or ""),
                    contexto=str(self.graph.value(subj, MYONT.contextoExterno) or ""),
                )
            )
        return sorted(concepts, key=lambda c: c.label.lower())

    def list_variables(self) -> List[VariavelRecord]:
        """Lista todas as instâncias de myont:Variavel (incluindo subclasses)."""
        var_nodes: Set[URIRef] = set()
        for cls_uri in (MYONT.Variavel, MYONT.VariavelSensivel):
            for subj in self.graph.subjects(RDF.type, cls_uri):
                if isinstance(subj, URIRef):
                    var_nodes.add(subj)

        records: List[VariavelRecord] = []
        for subj in var_nodes:
            vid = _local_name(subj)
            sensivel = (subj, RDF.type, MYONT.VariavelSensivel) in self.graph

            proxy_targets = [
                _local_name(o)
                for o in self.graph.objects(subj, MYONT.atuaComoProxyDe)
                if isinstance(o, URIRef)
            ]
            deriv_targets = [
                _local_name(o)
                for o in self.graph.objects(subj, MYONT.derivadaDe)
                if isinstance(o, URIRef)
            ]

            status_node = self.graph.value(subj, MYONT.temStatusCuradoria)
            status_id = _local_name(status_node) if isinstance(status_node, URIRef) else "Status_PendenteRevisaoJuridica"
            status_lbl = self._label_of(status_node) if isinstance(status_node, URIRef) else "Pendente de Revisão Jurídica"

            gov_node = self.graph.value(subj, MYONT.temNivelGovernanca)
            gov_id = _local_name(gov_node) if isinstance(gov_node, URIRef) else "Governanca_Media"
            gov_lbl = self._label_of(gov_node) if isinstance(gov_node, URIRef) else "Demanda de Governança Média"

            base_nodes = [o for o in self.graph.objects(subj, MYONT.temBaseLegal) if isinstance(o, URIRef)]
            bases_ids = [_local_name(b) for b in base_nodes]
            bases_lbls = [self._label_of(b) for b in base_nodes]

            eq_concepts = [
                _to_curie(o)
                for o in self.graph.objects(subj, MYONT.equivalenteAConceitoExterno)
                if isinstance(o, URIRef)
            ]
            based_concepts = [
                _to_curie(o)
                for o in self.graph.objects(subj, MYONT.baseadaEmConceitoExterno)
                if isinstance(o, URIRef)
            ]
            # Fallback para mapeadaParaConceitoExterno direta
            for o in self.graph.objects(subj, MYONT.mapeadaParaConceitoExterno):
                if isinstance(o, URIRef):
                    c = _to_curie(o)
                    if c not in eq_concepts and c not in based_concepts:
                        based_concepts.append(c)

            descricoes = {
                key: str(self.graph.value(subj, pred) or "")
                for key, pred, _ in DESC_FIELDS
            }

            records.append(
                VariavelRecord(
                    id=vid,
                    uri=str(subj),
                    label=self._label_of(subj),
                    sensivel=sensivel,
                    is_proxy=len(proxy_targets) > 0,
                    status_curadoria=status_id,
                    status_label=status_lbl,
                    nivel_governanca=gov_id,
                    nivel_label=gov_lbl,
                    bases_legais=sorted(bases_ids),
                    bases_legais_labels=sorted(bases_lbls),
                    conceitos_equivalentes=sorted(eq_concepts),
                    conceitos_baseados=sorted(based_concepts),
                    proxy_de=sorted(proxy_targets),
                    derivada_de=sorted(deriv_targets),
                    descricoes=descricoes,
                )
            )

        return sorted(records, key=lambda v: v.label.lower())

    def trace_inherited_alerts(
        self, var_id: str, vars_by_id: Dict[str, VariavelRecord]
    ) -> List[str]:
        """Propaga alertas preventivos pelas arestas myont:derivadaDe (sem ciclos)."""
        alerts: List[str] = []
        visited: Set[str] = {var_id}
        queue: List[Tuple[str, int]] = [(src, 1) for src in vars_by_id[var_id].derivada_de if src in vars_by_id]

        while queue:
            cur_id, depth = queue.pop(0)
            if cur_id in visited:
                continue
            visited.add(cur_id)
            src = vars_by_id[cur_id]
            prefix = f"Derivada de `{src.label}` (nível {depth})"

            if src.sensivel:
                alerts.append(f"{prefix}: origem é **Variável Sensível/Protegida**.")
            if src.nivel_governanca in {"Governanca_Veto", "Governanca_Maxima"}:
                alerts.append(f"{prefix}: origem possui nível **{src.nivel_label}**.")
            if src.proxy_de:
                targets = ", ".join(vars_by_id[p].label if p in vars_by_id else p for p in src.proxy_de)
                alerts.append(f"{prefix}: origem atua como proxy de **{targets}**.")

            for parent in src.derivada_de:
                if parent in vars_by_id and parent not in visited:
                    queue.append((parent, depth + 1))

        return alerts

    def save_custom_variable(
        self,
        var_id: str,
        label: str,
        sensivel: bool,
        status_id: str,
        nivel_id: str,
        bases_ids: List[str],
        equivalente_curies: List[str],
        baseada_curies: List[str],
        proxy_ids: List[str],
        derivada_ids: List[str],
        descricoes: Dict[str, str],
    ) -> str:
        """Persiste (cria ou atualiza) uma variável em data/variaveis_custom.ttl."""
        custom_g = Graph()
        custom_g.bind("myont", MYONT)
        custom_g.bind("schema", SCHEMA)
        if self.custom_vars_ttl.exists():
            custom_g.parse(str(self.custom_vars_ttl), format="turtle")

        subj = MYONT[var_id]
        custom_g.remove((subj, None, None))

        custom_g.add((subj, RDF.type, OWL.NamedIndividual))
        custom_g.add((subj, RDF.type, MYONT.Variavel))
        if sensivel:
            custom_g.add((subj, RDF.type, MYONT.VariavelSensivel))

        custom_g.add((subj, RDFS.label, Literal(label, lang="pt-br")))
        custom_g.add((subj, MYONT.temStatusCuradoria, MYONT[status_id]))
        custom_g.add((subj, MYONT.temNivelGovernanca, MYONT[nivel_id]))

        for b_id in bases_ids:
            custom_g.add((subj, MYONT.temBaseLegal, MYONT[b_id]))

        for curie in equivalente_curies:
            custom_g.add((subj, MYONT.equivalenteAConceitoExterno, self._resolve_curie(curie)))
        for curie in baseada_curies:
            custom_g.add((subj, MYONT.baseadaEmConceitoExterno, self._resolve_curie(curie)))

        for p_id in proxy_ids:
            if p_id != var_id:
                custom_g.add((subj, MYONT.atuaComoProxyDe, MYONT[p_id]))
        for d_id in derivada_ids:
            if d_id != var_id:
                custom_g.add((subj, MYONT.derivadaDe, MYONT[d_id]))

        for key, pred, _ in DESC_FIELDS:
            val = descricoes.get(key, "").strip()
            if val:
                custom_g.add((subj, pred, Literal(val, datatype=XSD.string)))

        self.custom_vars_ttl.parent.mkdir(parents=True, exist_ok=True)
        custom_g.serialize(destination=str(self.custom_vars_ttl), format="turtle")
        self.reload()
        return var_id

    @staticmethod
    def _resolve_curie(curie: str) -> URIRef:
        if curie.startswith("schema:"):
            return SCHEMA[curie.split(":", 1)[1]]
        if curie.startswith("myont:"):
            return MYONT[curie.split(":", 1)[1]]
        return URIRef(curie)
