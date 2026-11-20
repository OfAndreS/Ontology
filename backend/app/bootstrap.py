"""Inicialização idempotente dos bancos (PostgreSQL + Apache Jena Fuseki)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

from rdflib import Graph, Namespace, RDF
from sqlmodel import Session, select

from app.config import settings
from app.fuseki import GRAPH_DATA, GRAPH_EXTERNAL, GRAPH_ONTOLOGY, GraphBackend, get_graph_backend
from app.models import User
from app.security import hash_password

logger = logging.getLogger(__name__)

MYONT = Namespace("https://ontologia.governanca.credito/myont#")


def split_schema_and_initial_norms(schema_ttl_path: Path) -> Tuple[str, str]:
    """Separa o esquema OWL + vocabulário fixo das instâncias iniciais de normas."""
    full_graph = Graph()
    full_graph.parse(str(schema_ttl_path), format="turtle")

    norm_subjects = set(full_graph.subjects(RDF.type, MYONT.InstrumentoNormativo)) | set(
        full_graph.subjects(RDF.type, MYONT.DispositivoLegal)
    )

    ont_graph = Graph()
    norms_graph = Graph()
    for prefix, ns in full_graph.namespaces():
        ont_graph.bind(prefix, ns)
        norms_graph.bind(prefix, ns)

    for s, p, o in full_graph:
        if s in norm_subjects:
            norms_graph.add((s, p, o))
        else:
            ont_graph.add((s, p, o))

    return ont_graph.serialize(format="turtle"), norms_graph.serialize(format="turtle")


def ensure_default_admin(session: Session) -> None:
    """Cria o usuário administrador padrão caso não exista nenhum usuário ativo."""
    existing = session.exec(select(User).where(User.deleted_at.is_(None))).first()
    if existing:
        return

    admin = User(
        username=settings.admin_default_username,
        name=settings.admin_default_name,
        email=settings.admin_default_email,
        password_hash=hash_password(settings.admin_default_password),
        role="admin",
        is_active=True,
    )
    session.add(admin)
    session.commit()
    logger.info("Usuário administrador inicial '%s' criado.", admin.username)


def seed_fuseki_if_empty(backend: GraphBackend | None = None, semantic_dir: Path | None = None) -> None:
    """Carrega os 3 Named Graphs no Fuseki de forma idempotente."""
    graph_backend = backend or get_graph_backend()
    sem_path = semantic_dir or settings.semantic_path

    schema_ttl = sem_path / "ontologies" / "myont_v2.ttl"
    concepts_ttl = sem_path / "data" / "conceitos_externos_schemaorg.ttl"
    vars_ttl = sem_path / "data" / "variaveis_v2.ttl"

    if not schema_ttl.exists() or not vars_ttl.exists():
        logger.warning("Arquivos semânticos não encontrados em %s; seed do grafo ignorado.", sem_path)
        return

    ont_ttl, norms_ttl = split_schema_and_initial_norms(schema_ttl)

    # Sempre atualiza esquema OWL + vocabulário fixo em urn:graph:ontology
    graph_backend.put_turtle(GRAPH_ONTOLOGY, ont_ttl)

    # Carrega Schema.org em urn:graph:external apenas se ainda vazio
    has_ext = graph_backend.select(
        f"""PREFIX myont: <https://ontologia.governanca.credito/myont#>
        SELECT ?s WHERE {{ GRAPH <{GRAPH_EXTERNAL}> {{ ?s a myont:ConceitoExterno }} }} LIMIT 1"""
    )
    if not has_ext and concepts_ttl.exists():
        graph_backend.put_turtle(GRAPH_EXTERNAL, concepts_ttl.read_text(encoding="utf-8"))

    # Carrega catálogo inicial (normas + categorias + variáveis + riscos) se urn:graph:data estiver vazio
    has_data = graph_backend.select(
        f"""PREFIX myont: <https://ontologia.governanca.credito/myont#>
        SELECT ?s WHERE {{ GRAPH <{GRAPH_DATA}> {{ ?s a myont:Variavel }} }} LIMIT 1"""
    )
    if not has_data:
        combined_data = norms_ttl + "\n\n" + vars_ttl.read_text(encoding="utf-8")
        g_data = Graph()
        g_data.parse(data=combined_data, format="turtle")
        graph_backend.put_turtle(GRAPH_DATA, g_data.serialize(format="turtle"))
        logger.info("Grafo de dados inicial carregado em %s.", GRAPH_DATA)
