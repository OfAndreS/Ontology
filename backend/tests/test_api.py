"""Testes ponta a ponta da API unificada (SQLModel + RDFLib/SPARQL in-memory)."""

from pathlib import Path
import tempfile

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from app.bootstrap import ensure_default_admin, seed_fuseki_if_empty
from app.config import settings
from app.database import get_session
from app.fuseki import InMemoryRdflibBackend, set_graph_backend
from app.main import app


@pytest.fixture()
def client(tmp_path: Path):
    settings.skip_bootstrap = True
    settings.upload_dir = str(tmp_path / "uploads" / "laws")

    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        execution_options={"schema_translate_map": {"auth": None, "core": None}},
    )
    SQLModel.metadata.create_all(test_engine)

    with Session(test_engine) as session:
        ensure_default_admin(session)

    graph_backend = InMemoryRdflibBackend()
    set_graph_backend(graph_backend)
    seed_fuseki_if_empty(backend=graph_backend, semantic_dir=settings.semantic_path)

    def override_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _login(client: TestClient, username: str, password: str) -> str:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_auth_wall_and_roles(client: TestClient):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/variables").status_code == 401
    assert client.get("/api/laws").status_code == 401
    assert client.get("/api/categories").status_code == 401

    admin_token = _login(client, "admin", "admin123")
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}

    me = client.get("/api/auth/me", headers=admin_hdr)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"

    # Cria analista
    create_u = client.post(
        "/api/auth/users",
        headers=admin_hdr,
        json={
            "username": "analista1",
            "name": "Maria Analista",
            "email": "maria@governanca.local",
            "password": "secret123",
            "role": "analista",
        },
    )
    assert create_u.status_code == 201, create_u.text

    analista_token = _login(client, "analista1", "secret123")
    analista_hdr = {"Authorization": f"Bearer {analista_token}"}

    # Analista lê catálogo e categorias, mas não gerencia usuários nem categorias
    assert client.get("/api/variables", headers=analista_hdr).status_code == 200
    assert client.get("/api/categories", headers=analista_hdr).status_code == 200
    assert client.get("/api/auth/users", headers=analista_hdr).status_code == 403
    assert (
        client.post(
            "/api/categories",
            headers=analista_hdr,
            json={"label": "Nova Cat", "description": "Teste"},
        ).status_code
        == 403
    )


def test_seeded_catalog_categories_and_variable_crud(client: TestClient):
    admin_token = _login(client, "admin", "admin123")
    hdr = {"Authorization": f"Bearer {admin_token}"}

    cats = client.get("/api/categories", headers=hdr).json()
    assert len(cats) == 11

    vars_list = client.get("/api/variables", headers=hdr).json()
    assert len(vars_list) == 36
    assert all(v["categoria_id"] for v in vars_list)

    # Filtros diretos e endpoints de apoio
    saude = client.get("/api/variables", headers=hdr, params={"category_id": "Cat_Saude"}).json()
    assert len(saude) == 1
    assert saude[0]["id"] == "PhysicalHealthStatus"

    socio = client.get(
        "/api/variables", headers=hdr, params={"category_id": "Cat_Socioeconomico"}
    ).json()
    assert len(socio) == 10

    concepts = client.get("/api/concepts", headers=hdr, params={"q": "Monetary"}).json()
    assert len(concepts) >= 1
    vocab = client.get("/api/vocabularies", headers=hdr).json()
    assert len(vocab["niveis_risco"]) == 5

    # Cria variável derivada de Gender com risco próprio
    created = client.post(
        "/api/variables",
        headers=hdr,
        json={
            "label": "Renda Ajustada por Perfil",
            "categoria_id": "Cat_Socioeconomico",
            "sensivel": False,
            "status_curadoria": "Status_PendenteRevisaoJuridica",
            "bases_autorizadoras": ["LGPD_Art7_X_ProtecaoCredito"],
            "conceitos_baseados": ["schema:MonetaryAmount"],
            "derivada_de": ["Gender"],
            "proxy_de": ["Age"],
            "descricoes": {"origem": "Motor interno"},
            "riscos": [
                {
                    "descricao": "Risco de redlining indireto",
                    "nivel_risco": "Risco_Alto",
                    "demanda_governanca": "Monitorar impacto díspar",
                    "implicacao_legal": "Discriminação indireta",
                    "bases_acionadas": ["CF_Art3_IV_VedacaoDiscriminacao"],
                }
            ],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["categoria_id"] == "Cat_Socioeconomico"
    assert len(body["riscos"]) == 1
    assert any("Gender" in a for a in body["inherited_alerts"])
    assert len(body["history"]) == 1

    # Relatório preventivo
    rep = client.post(
        "/api/report",
        headers=hdr,
        json={"model_name": "Score V2", "variable_ids": [body["id"], "Income"]},
    )
    assert rep.status_code == 200
    rep_data = rep.json()
    assert rep_data["summary"]["total"] == 2
    assert "Score V2" in rep_data["markdown"]

    # Exclusão permitida
    del_resp = client.delete(f"/api/variables/{body['id']}", headers=hdr)
    assert del_resp.status_code == 204
    assert client.get(f"/api/variables/{body['id']}", headers=hdr).status_code == 404


def test_law_crud_pdf_and_category_guard(client: TestClient):
    admin_token = _login(client, "admin", "admin123")
    hdr = {"Authorization": f"Bearer {admin_token}"}

    # Não deixa apagar categoria em uso
    del_cat = client.delete("/api/categories/Cat_Saude", headers=hdr)
    assert del_cat.status_code == 409

    # Cria e apaga categoria vazia
    new_cat = client.post(
        "/api/categories",
        headers=hdr,
        json={"label": "Teste Temporaria", "description": "Desc"},
    )
    assert new_cat.status_code == 201
    cid = new_cat.json()["id"]
    assert client.delete(f"/api/categories/{cid}", headers=hdr).status_code == 204

    # Cria norma com dispositivo
    law_resp = client.post(
        "/api/laws",
        headers=hdr,
        json={
            "label": "Resolução BCB 999/2026",
            "tipo_instrumento": "Resolução",
            "descricao": "Norma de teste",
            "url_fonte": "https://www.bcb.gov.br",
            "data_publicacao": "2026-01-10",
            "dispositivos": [
                {"label": "Art. 1º - Objeto", "tipo_dispositivo": "Artigo", "descricao": "Dispõe sobre crédito"}
            ],
        },
    )
    assert law_resp.status_code == 201, law_resp.text
    slug = law_resp.json()["slug"]
    assert len(law_resp.json()["dispositivos"]) == 1
    assert len(law_resp.json()["history"]) == 1

    # Upload e download de PDF
    up = client.post(
        f"/api/laws/{slug}/upload-pdf",
        headers=hdr,
        files={"file": ("norma.pdf", b"%PDF-1.4\n%test\n", "application/pdf")},
    )
    assert up.status_code == 200, up.text
    assert up.json()["pdf_name"] == "norma.pdf"

    dl = client.get(f"/api/laws/{slug}/download-pdf", headers=hdr)
    assert dl.status_code == 200
    assert dl.content.startswith(b"%PDF-1.4")

    # Exclui norma e valida limpeza
    assert client.delete(f"/api/laws/{slug}", headers=hdr).status_code == 204
    assert client.get(f"/api/laws/{slug}", headers=hdr).status_code == 404
