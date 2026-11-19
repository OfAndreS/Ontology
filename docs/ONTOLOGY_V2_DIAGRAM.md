# DIAGRAMA VISUAL DA ONTOLOGIA — MyOnt V2

Este documento apresenta a estrutura visual da ontologia **MyOnt V2** ([semantic/ontologies/myont_v2.ttl](file:///home/andre/Documents/Dev/Work/Ontology/semantic/ontologies/myont_v2.ttl)), refletindo as **Decisões 05, 06 e 07** registradas em [ABOUTME.md](ABOUTME.md).

---

## 1. Modelo Conceitual (Classes e Relações Principais)

```mermaid
flowchart LR
    %% Camadas
    subgraph EXT["Camada Externa (Referência)"]
        CE["myont:ConceitoExterno\n(Schema.org / futuro FIBO, DPV)"]
    end

    subgraph CORE["Camada de Governança de Crédito"]
        V["myont:Variavel\n(⊑ dpv:PersonalData)\n─────────────\n• rdfs:label\n• descricaoOrigem\n• descricaoJustificativaLegal\n• descricaoExplicabilidade\n• descricaoAtuacaoProxy"]
        VS["myont:VariavelSensivel\n(⊑ Variavel, dpv:SensitivePersonalData)"]
        VP["myont:VariavelProxy\n(Inferida OWL: ∃ atuaComoProxyDe.Variavel)"]
        SC["myont:StatusCuradoria\n(Auditada | PendenteRevisaoJuridica)"]
    end

    subgraph RISK["Camada de Riscos e Controles (Decisão 05)"]
        R["myont:Risco\n─────────────\n• descricaoRisco\n• descricaoDemandaGovernanca\n• descricaoImplicacaoLegal"]
        NR["myont:NivelRisco\n(Baixo | Médio | Alto | Máximo | Veto)"]
    end

    subgraph LAW["Camada Normativa (Decisão 06)"]
        BL["myont:BaseLegal\n(Superclasse ⊑ dpv:LegalBasis)"]
        IN["myont:InstrumentoNormativo\n(Constituição, Lei, Resolução,\nSúmula, Regulação Setorial)"]
        DL["myont:DispositivoLegal\n(Artigo, Parágrafo, Inciso,\nAlínea, Princípio)"]
    end

    %% Heranças
    VS -. "rdfs:subClassOf" .-> V
    VP -. "owl:equivalentClass" .-> V
    IN -. "rdfs:subClassOf" .-> BL
    DL -. "rdfs:subClassOf" .-> BL

    %% Propriedades da Variável
    V -- "mapeadaParaConceitoExterno\n(equivalente / baseada) [1:N]" --> CE
    V -- "temStatusCuradoria [1:1]" --> SC
    V -- "derivadaDe [N:M]" --> V
    V -- "atuaComoProxyDe [N:M]" --> V
    V -- "autorizadaPorBaseLegal [N:M]\n(Papel Autorizador)" --> BL
    V -- "possuiRisco [N:M]" --> R

    %% Propriedades do Risco
    R -- "temNivelRisco [1:1]" --> NR
    R -- "acionaBaseLegal [N:M]\n(Papel Restritivo / Implicação)" --> BL

    %% Hierarquia Normativa
    DL -- "pertenceAInstrumento" --> IN
    DL -- "parteDeDispositivo (opcional)" --> DL
```

---

## 2. Exemplo Prático — Separação de Papéis Jurídicos e Múltiplos Riscos

### Caso A: `Age` (Permitida com ressalvas, múltiplos riscos distintos)

```mermaid
flowchart TD
    AGE["myont:Age (Variavel)\nJustificativa: Capacidade civil, proteção ao crédito\ne provisão conforme expectativa de vida"]

    AGE -- "autorizadaPorBaseLegal" --> CC["myont:CodigoCivil_Geral\n(DispositivoLegal → Código Civil)"]
    AGE -- "autorizadaPorBaseLegal" --> LGPD7X["myont:LGPD_Art7_X_ProtecaoCredito\n(DispositivoLegal → LGPD)"]
    AGE -- "autorizadaPorBaseLegal" --> CMN["myont:Res_CMN_4966_2021\n(InstrumentoNormativo)"]

    AGE -- "possuiRisco" --> R1["Risco 1: Discriminação contra idosos\nNível: Risco_Medio\nDemanda: Validar curvas de risco por faixa etária\nImplicação: Discriminação etária abusiva"]
    AGE -- "possuiRisco" --> R2["Risco 2: Exclusão de jovens sem histórico\nNível: Risco_Medio\nDemanda: Alternativas de histórico financeiro"]

    R1 -- "acionaBaseLegal" --> IDOSO["myont:Estatuto_PessoaIdosa\n(InstrumentoNormativo)"]
    R1 -- "acionaBaseLegal" --> CF3["myont:CF_Art3_IV_VedacaoDiscriminacao\n(DispositivoLegal → CF/88)"]
```

### Caso B: `Gender` (Coleta legal obrigatória vs. Vedação decisória)

```mermaid
flowchart LR
    G["myont:Gender (VariavelSensivel)\nJustificativa: Coleta apenas cadastral;\nvedado uso para distinção na decisão"]
    G -- "autorizadaPorBaseLegal\n(Coleta / Identificação)" --> L7II["LGPD Art. 7º, II\n(Obrigação Legal)"]
    G -- "possuiRisco" --> RG["Risco: Discriminação de gênero\nNível: Risco_Veto\nDemanda: Uso vetado na decisão"]
    RG -- "acionaBaseLegal\n(Proibição Decisória)" --> CF5I["CF/88 Art. 5º, I\n(Igualdade de Gênero)"]
```

---

## 3. Resumo da Evolução V1 $\to$ V2

| Aspecto | MyOnt V1 (`versions/myont_v1.ttl`) | MyOnt V2 (`myont_v2.ttl`) |
| :--- | :--- | :--- |
| **Riscos** | String única `descricaoRiscoEtico` na `Variavel` | Classe `myont:Risco` ligada por `myont:possuiRisco` (N:M) |
| **Nível de Severidade** | `NivelDemandaGovernanca` 1:1 na `Variavel` | `myont:NivelRisco` em cada `Risco` (nível da variável é derivado) |
| **Demanda de Governança & Implicação Legal** | Strings 1:1 na `Variavel` | Strings próprias dentro de cada `myont:Risco` |
| **Bases Legais** | Lista plana `BaseLegal` com propriedade única `temBaseLegal` | Superclasse `BaseLegal` $\to$ `InstrumentoNormativo` + `DispositivoLegal`; papéis separados em `autorizadaPorBaseLegal` (na `Variavel`) e `acionaBaseLegal` (no `Risco`) |
| **Origem, Justificativa, Explicabilidade, Proxy** | 7 strings na `Variavel` | 4 strings na `Variavel` (`descricaoOrigem`, `descricaoJustificativaLegal`, `descricaoExplicabilidade`, `descricaoAtuacaoProxy`) + `atuaComoProxyDe` direto |
