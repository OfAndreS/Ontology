# Plataforma Unificada de Governança Preventiva de Variáveis de Crédito (MyOnt + ICTI)

Plataforma full-stack para governança semântica e regulatória de variáveis de crédito, unindo **Apache Jena Fuseki** (camada semântica RDF/OWL), **PostgreSQL** (usuários/JWT, auditoria e metadados de PDFs), **FastAPI** (`backend/`) e **React** (`frontend/`).

## Estrutura do Repositório

* `docs/` — documentação conceitual ([ABOUTME.md](docs/ABOUTME.md)), diagrama ([ONTOLOGY_V2_DIAGRAM.md](docs/ONTOLOGY_V2_DIAGRAM.md)) e histórico da mesclagem ([MERGE_TIMELINE.md](docs/MERGE_TIMELINE.md)).
* `semantic/` — ontologia [myont_v2.ttl](semantic/ontologies/myont_v2.ttl), mapeamentos, conceitos Schema.org e scripts de geração ([build_v2_catalog.py](semantic/scripts/build_v2_catalog.py)).
* `infra/fuseki/` — configuração TDB2 com `unionDefaultGraph` para o Apache Jena Fuseki.
* `backend/` — API FastAPI, modelos SQLModel (`auth` e `core`), cliente SPARQL e bootstrap idempotente.
* `frontend/` — aplicação React 19 + Vite + Tailwind CSS.
* `web_v2/` e `legacy/` — vitrine e protótipos anteriores mantidos para referência.

## Execução com Docker Compose (Recomendado)

1. Copie `.env.example` para `.env` e ajuste os segredos se desejar:
   ```bash
   cp .env.example .env
   ```
2. Suba todos os serviços (`postgres`, `fuseki`, `backend`, `frontend`):
   ```bash
   docker compose up --build
   ```
3. Acesse:
   * **Plataforma Web:** `http://localhost:5173`
   * **API FastAPI (Swagger):** `http://localhost:8000/docs`
   * **Apache Jena Fuseki:** `http://localhost:3030`
   * **Login inicial:** `admin` / `admin123` (configurável em `.env`)

## Execução Local em Desenvolvimento (Conda + Node)

1. Suba apenas os bancos (`postgres` e `fuseki`):
   ```bash
   docker compose up -d postgres fuseki
   ```
2. Crie o ambiente Conda do back-end e inicie o FastAPI:
   ```bash
   conda env create -f backend/environment.yml
   conda activate myont-backend
   PYTHONPATH=backend uvicorn app.main:app --reload --port 8000
   ```
3. Inicie o front-end:
   ```bash
   npm --prefix frontend install
   npm --prefix frontend run dev
   ```

## Testes Automatizados

```bash
PYTHONPATH=backend pytest backend/tests -v
npm --prefix frontend run typecheck
npm --prefix frontend run build
```
