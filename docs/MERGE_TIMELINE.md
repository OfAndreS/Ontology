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
| **3. Escopo de Features** | Definição do que entra, do que é adaptado e do que fica de fora da mesclagem (variáveis, leis, relatórios, autenticação, busca, etc.). | Em andamento |
| **4. Fechamento de Detalhes** | Contratos de API, modelo de dados, fluxo de sincronização grafo/banco e plano de implementação. | Pendente |
| **5. Implementação (Código)** | Construção da plataforma unificada em `backend/` e `frontend/` e validação ponta a ponta. | Pendente |

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

---

## 3. DIÁRIO CRONOLÓGICO

### 19 nov. 2026 — Etapa 2 + Vitrine Visual V2
* Registradas as Decisões `05`, `06` e `07` em [ABOUTME.md](ABOUTME.md) (`myont:Risco`, `myont:NivelRisco`, `myont:InstrumentoNormativo` e `myont:DispositivoLegal`).
* Materializada a ontologia [myont_v2.ttl](../semantic/ontologies/myont_v2.ttl) e reorganizada a nomenclatura de versões/dados (`semantic/ontologies/versions/`, `semantic/data/archive_v1/`, `legacy/experiments/`).
* Criado o diagrama visual [ONTOLOGY_V2_DIAGRAM.md](ONTOLOGY_V2_DIAGRAM.md), o pipeline [build_v2_catalog.py](../semantic/scripts/build_v2_catalog.py) (36 variáveis e 42 nós de risco em `variaveis_v2.ttl`) e a vitrine temporária `web_v2/` para validação da ideia antes da Etapa 3.

### 19 nov. 2026 — Etapa 1: Reorganização do Repositório
* Criado `.gitignore` na raiz ignorando `ICTI/`, `node_modules/`, `dist/`, `.venv/`, `__pycache__/` e `.env`.
* Arquivos da raiz movidos para `docs/`, `semantic/` e `legacy/`.
* Caminhos internos atualizados em `semantic/scripts/build_v1_catalog.py`, `semantic/scripts/extract_schemaorg_concepts.py` e `legacy/web_v1/server/ontologyService.ts`.
* *Pendência Git local (fora da sandbox):* remover `web/node_modules` e `web/dist` antigos do índice do Git caso permaneçam em cache (`git rm -r --cached` antes do commit da reorganização).
