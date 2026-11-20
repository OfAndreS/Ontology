# LINHA DO TEMPO DA MESCLAGEM — ONTOLOGY + ICTI CREDIT FEATURE WIKI

Este documento registra o planejamento, as decisões arquiteturais e o acompanhamento cronológico da mesclagem entre o projeto **Ontology** (camada semântica e governança preventiva em RDF/OWL) e o projeto **ICTI Credit Feature Wiki** (arquitetura full-stack com FastAPI, PostgreSQL, Elasticsearch, React 19 e exploração estatística de datasets).

> **Referências base:**
> * Histórico e concepção semântica original: [ABOUTME.md](ABOUTME.md)
> * Diretório de consulta do projeto ICTI (mantido intocado, com Git próprio): `ICTI/`

---

## 1. ROADMAP DAS ETAPAS

| Etapa | Descrição | Status |
| :--- | :--- | :--- |
| **1. Organização dos Diretórios** | Limpeza da raiz, separação por camadas (`docs/`, `semantic/`, `backend/`, `frontend/`, `legacy/`), criação do `.gitignore` e isolamento do `ICTI/` apenas para consulta. | Concluída (19 nov. 2026) |
| **2. Aspectos da Ontologia** | Revisão de vocabulários (Schema.org, FIBO, W3C DPV), desmembramento de `Risco` e estruturação de `BaseLegal` (`InstrumentoNormativo` e `DispositivoLegal`). Decisões registradas em [ABOUTME.md](ABOUTME.md) (Decisões 05–07). | Concluída (19 nov. 2026) |
| **3. Escopo de Features** | Definição do que entra, do que é adaptado e do que fica de fora da mesclagem (variáveis, leis, relatórios, autenticação, busca, etc.). | Concluída (19 nov. 2026) |
| **4. Fechamento de Detalhes** | Contratos de API, modelo de dados, fluxo de sincronização grafo/banco e plano de implementação. | Concluída (19 nov. 2026) |
| **5. Implementação (Código)** | Construção da plataforma unificada em `backend/` e `frontend/` e validação ponta a ponta. | Concluída (19 nov. 2026) |

---

## 2. REGISTRO DE DECISÕES DA MESCLAGEM

### Decisão M-01 — Estratégia de Repositório e Estrutura de Diretórios (Opção 1)
* **Data:** 19 nov. 2026
* **Status:** Aprovada e executada
* **Decisão:** Consolidar o projeto unificado diretamente no repositório Git raiz do **Ontology**, mantendo `ICTI/` estritamente como diretório de consulta (com seus repositórios `.git` internos intocados e ignorados pelo `.gitignore` raiz).
* **Estrutura adotada:**
  * `docs/` — documentação (`ABOUTME.md`, `MERGE_TIMELINE.md`, `assets/`).
  * `semantic/` — ativos semânticos (`ontologies/`, `ontologies/external/`, `mappings/`, `raw/`, `data/`, `scripts/`).
  * `backend/` — novo back-end unificado da plataforma.
  * `frontend/` — novo front-end unificado da plataforma.
  * `legacy/` — referência temporária do MVP anterior (`web_v1/`) e experimentos iniciais (`experiments/`).
  * `ICTI/` — referência de consulta (não versionada no Git raiz).

### Decisão M-02 — Escopo de Features da Mesclagem (Etapa 3)
* **Data:** 19 nov. 2026
* **Status:** Aprovada
* **Itens definidos:**
  * **Núcleo do Ontology V2 (obrigatório):** catálogo de variáveis, múltiplos `myont:Risco` por variável com `NivelRisco`, separação entre autorização (`autorizadaPorBaseLegal`) e restrição (`acionaBaseLegal`), linhagem (`derivadaDe`) com alertas preventivos, proxies (`atuaComoProxyDe`), explorador `ConceitoExterno` (Schema.org) e relatório preventivo consolidado.
  * **Autenticação simplificada e 2 papéis:** login JWT com dois perfis — **Administrador (`admin`)** e **Analista (`analista`)**, **sem** fluxo de confirmação de e-mail por SMTP.
  * **Painel `/admin`:**
    * *Analista:* abas *Visão Geral*, *Variáveis* e *Normas*.
    * *Administrador:* abas *Visão Geral*, *Variáveis*, *Normas*, *Categorias* e *Usuários* (sem *Datasets* na V1).
  * **Módulo de Normas e Dispositivos completo:** herdado do ICTI e adaptado para `InstrumentoNormativo` + `DispositivoLegal`, com URL oficial + upload/download de PDF opcional (arquivo em disco e referência no PostgreSQL) e histórico de alterações (`LawHistory`).
  * **Categorias temáticas incluídas:** adoção das categorias das tabelas do Anexo 4 / ICTI, também representadas na ontologia (`myont:Categoria`, Decisão 08 em [ABOUTME.md](ABOUTME.md)).
  * **Busca direta (sem Elasticsearch):** remoção do Elasticsearch da stack, utilizando busca direta sobre o grafo/banco.
  * **Datasets e correlações estatísticas fora da V1:** mantidos fora nesta etapa conforme Decisão 07.
* **Stack-alvo confirmada:** Front-end em **React**, Back-end em **FastAPI (Python)**, persistência semântica em **Apache Jena Fuseki** (ontologia, variáveis, riscos, categorias e normas) e persistência operacional em **PostgreSQL** (usuários/JWT, `LawHistory` e referências de PDFs em disco).

### Decisão M-03 — Arquitetura dos Bancos de Dados (Etapa 4)
* **Data:** 19 nov. 2026
* **Status:** Aprovada
* **Apache Jena Fuseki (dataset único com 3 Named Graphs):**
  * `urn:graph:ontology` — esquema OWL `MyOnt` (`myont_v2.ttl` + `myont:Categoria` / `myont:pertenceACategoria`), níveis de risco e status de curadoria.
  * `urn:graph:external` — termos `myont:ConceitoExterno` (Schema.org).
  * `urn:graph:data` — instâncias de `Variavel`, `Risco`, `Categoria`, `InstrumentoNormativo` e `DispositivoLegal`.
* **PostgreSQL (enxuto, ligado ao Fuseki via URI/`slug` canônico):**
  * `auth.users` — modelo simplificado com coluna direta `role` (`admin` | `analista`), `is_active` (default `true`), sem `email_confirmed`, `invitations` ou tabelas N:N de permissões.
  * `core.law_attachments` — referência (`pdf_name`, `pdf_path`) dos PDFs armazenados em disco (`uploads/laws/`), vinculada por `norm_uri` / `norm_slug`.
  * `core.law_histories` — trilha de auditoria de normas vinculada por `norm_uri`.
  * `core.variable_histories` — trilha de auditoria de variáveis vinculada por `variable_uri`.

### Decisão M-04 — Contratos de API, Autenticação e Autorização (Etapa 4)
* **Data:** 19 nov. 2026
* **Status:** Aprovada
* **Acesso fechado por autenticação:** toda a plataforma (front-end e rotas `/api/*`, exceto `/api/auth/login` e `/api/health`) exige usuário autenticado via JWT.
* **Matriz de permissões:**
  * **Analista (`analista`) e Administrador (`admin`):** leitura completa (catálogo, normas, conceitos, relatório preventivo) + criação, edição e exclusão (`POST`/`PUT`/`PATCH`/`DELETE`) de **variáveis** e **normas/dispositivos** (incluindo upload/remoção de PDF).
  * **Exclusivo de Administrador (`admin`):** gestão de **Categorias** e **Usuários**.
* **Sincronização Fuseki ↔ PostgreSQL:** Fuseki atua como fonte primária nas escritas de domínio (`SPARQL UPDATE` em `urn:graph:data`), seguido do registro de auditoria (`law_histories` / `variable_histories`) e anexos em disco (`law_attachments`) no PostgreSQL.

---

## 3. DIÁRIO CRONOLÓGICO

### 19 nov. 2026 — Refinamento do Login & Geração do Manual de Governança em PDF
* **Interface de Login (`frontend/src/pages/LoginPage.tsx`):** simplificada visualmente para seguir o padrão editorial de cards do restante da aplicação (`bg-surface`, `border-rule`, sem textos técnicos ou parágrafos redundantes).
* **Geração de Relatório em PDF (`backend/app/services/report_pdf_service.py`, `backend/app/routers/catalog_meta.py`):** implementado o endpoint `POST /api/report/pdf` com **ReportLab**, gerando o manual executivo paginado em A4 inspirado em [Manual_Governança.pdf](assets/Manual_Governança.pdf) (capa institucional, sumário dinâmico, divisores *Parte I* e *Parte II*, matrizes de variáveis agrupadas por categoria temática com badges `APROVADO` / `RESTRITO` / `ADAPTADO` / `VETADO`, metas de conformidade regulatória, métricas de auditoria de equidade e técnicas de mitigação de viés no pipeline).
* **Pré-visualização Visual no Front-end (`frontend/src/components/GovernanceManualPreview.tsx`, `frontend/src/pages/ReportPage.tsx`):** adicionada visualização interativa das páginas do Manual diretamente na tela de Relatório Preventivo (alternável com a visão em Markdown `.md`) e botão **Baixar PDF**.
* **Testes (`backend/tests/test_api.py`):** incluída verificação automatizada do endpoint `POST /api/report/pdf`.

### 19 nov. 2026 — Etapa 5 Concluída: Implementação & Validação
* **Camada semântica (`semantic/`):** adicionadas `myont:Categoria`, `myont:pertenceACategoria`, `myont:descricaoCategoria` e `myont:slugCategoria` em [myont_v2.ttl](../semantic/ontologies/myont_v2.ttl); atualizado [build_v2_catalog.py](../semantic/scripts/build_v2_catalog.py) e regenerado o catálogo (11 categorias temáticas, 36 variáveis e 42 nós de risco).
* **Infraestrutura (`docker-compose.yml`, `infra/fuseki/`):** configurado ambiente com PostgreSQL 16, Apache Jena Fuseki 5.1 (TDB2 + `unionDefaultGraph`), FastAPI e React/Nginx.
* **Back-end (`backend/`):** implementados modelos SQLModel (`auth.users`, `core.law_attachments`, `core.law_histories`, `core.variable_histories`), autenticação JWT (`admin` / `analista`), cliente SPARQL (`FusekiClient`), seed idempotente (`bootstrap.py`), CRUD completo de variáveis/riscos, categorias, normas/dispositivos + upload/download de PDF, vocabulários, conceitos Schema.org e relatório preventivo.
* **Front-end (`frontend/`):** implementadas telas de login, catálogo com filtro por categoria/risco, cadastro/edição de variáveis (5 blocos + categoria), módulo completo de normas/dispositivos com PDF e histórico, explorador Schema.org, relatório preventivo e painel `/admin` segmentado por papel.
* **Validação:** `pytest backend/tests -v` (3/3 passaram), `npm --prefix frontend run typecheck` e `npm --prefix frontend run build` executados com sucesso.

### 19 nov. 2026 — Etapa 4 Concluída + Início da Etapa 5 (Implementação)
* Fechada a Etapa 4 com a definição dos contratos de API (`/api/auth`, `/api/variables`, `/api/categories`, `/api/laws`, `/api/concepts`, `/api/vocabularies`, `/api/report`), fluxo de sincronização Fuseki ↔ PostgreSQL, acesso autenticado obrigatório em toda a plataforma e permissão de criação/edição/exclusão de variáveis e normas para **Administrador** e **Analista** (ficando *Categorias* e *Usuários* restritos ao **Administrador**).
* Iniciada a **Etapa 5 (Implementação)** em `semantic/`, `backend/` e `frontend/`.

### 19 nov. 2026 — Etapa 3 Concluída
* Fechada a Etapa 3 com a definição dos dois papéis (**Administrador** e **Analista**), recorte de abas do `/admin`, manutenção de **URL + PDF opcional** para normas (PDF em disco + metadado no PostgreSQL), busca direta sem Elasticsearch, inclusão de `myont:Categoria` e exclusão de Datasets na V1.

### 19 nov. 2026 — Refinamentos Visuais na Vitrine `web_v2/`
* Removido jargão RDF/OWL das telas operacionais (`CatalogPage`, `VariableDetailPage`, `VariableFormPage`, `ReportPage`, `AppLayout`), mantendo termos técnicos apenas em `docs/`.
* Removido o modo escuro (`styles.css` e `AppLayout.tsx`), mantendo apenas tema claro.
* Removida a página técnica `/ontology` (`OntologyPage.tsx` e endpoint `/api/ontology-overview`) após avaliação de aderência ao modelo de negócio.
* Melhorado o formulário (`VariableFormPage.tsx` + `LegalBasePicker.tsx` + `VariableMultiPicker.tsx`): separação em 5 blocos com busca no padrão Schema.org para *Linhagem* e *Relações de Proxy*, validação contra descarte silencioso de riscos, reset de estado entre rotas, e padronização tipográfica/alinhamento dos cards de risco em `VariableDetailPage.tsx`.

### 19 nov. 2026 — Etapa 2 + Vitrine Visual V2
* Registradas as Decisões `05`, `06` e `07` em [ABOUTME.md](ABOUTME.md) (`myont:Risco`, `myont:NivelRisco`, `myont:InstrumentoNormativo` e `myont:DispositivoLegal`).
* Materializada a ontologia [myont_v2.ttl](../semantic/ontologies/myont_v2.ttl) e reorganizada a nomenclatura de versões/dados (`semantic/ontologies/versions/`, `semantic/data/archive_v1/`, `legacy/experiments/`).
* Criado o diagrama visual [ONTOLOGY_V2_DIAGRAM.md](ONTOLOGY_V2_DIAGRAM.md), o pipeline [build_v2_catalog.py](../semantic/scripts/build_v2_catalog.py) (36 variáveis e 42 nós de risco em `variaveis_v2.ttl`) e a vitrine temporária `web_v2/` para validação da ideia antes da Etapa 3.

### 19 nov. 2026 — Etapa 1: Reorganização do Repositório
* Criado `.gitignore` na raiz ignorando `ICTI/`, `node_modules/`, `dist/`, `.venv/`, `__pycache__/` e `.env`.
* Arquivos da raiz movidos para `docs/`, `semantic/` e `legacy/`.
* Caminhos internos atualizados em `semantic/scripts/build_v1_catalog.py`, `semantic/scripts/extract_schemaorg_concepts.py` e `legacy/web_v1/server/ontologyService.ts`.
* *Pendência Git local (fora da sandbox):* remover `web/node_modules` e `web/dist` antigos do índice do Git caso permaneçam em cache (`git rm -r --cached` antes do commit da reorganização).
