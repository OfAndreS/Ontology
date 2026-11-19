# GOVERNANÇA ALGORÍTMICA PREVENTIVA BASEADA EM WEB SEMÂNTICA E POLÍTICAS COMO CÓDIGO

**RESUMO**

Este documento descreve a concepção e o registro de decisões arquiteturais de uma plataforma de validação preventiva para modelos de ciência de dados. O projeto integra grafos de conhecimento e políticas como código para documentar conformidade regulatória e mapear riscos de discriminação algorítmica.

**Palavras-chave:** Web Semântica. Governança de Dados. Políticas como Código. Conformidade Algorítmica. RDF.

---

## 1 INTRODUÇÃO

O desenvolvimento de modelos preditivos exige o alinhamento contínuo entre requisitos técnicos e normas jurídicas. Este documento estabelece a visão geral do sistema e registra, em ordem cronológica, as decisões técnicas adotadas ao longo do projeto.

## 2 DEFINIÇÃO DO PROBLEMA

Equipes jurídicas e equipes de ciência de dados operam com linguagens e ferramentas distintas. Especialistas jurídicos interpretam normas em textos abstratos, enquanto cientistas de dados manipulam tabelas e códigos de programação. Essa desconexão atrasa a auditoria de modelos preditivos e eleva o risco de discriminação algorítmica e de violações regulatórias.

## 3 SOLUÇÃO PROPOSTA

O sistema propõe um fluxo de validação preventiva fundamentado na Web Semântica. Na visão completa da plataforma, conceitos de negócio são estruturados em grafos de conhecimento padronizados para avaliação automatizada de regras de governança.

### 3.1 Escopo da Primeira Versão (V1)

Na primeira versão do sistema, a plataforma atua como um catálogo semântico e gerador automatizado de relatórios de governança. O fluxo operacional compreende três etapas:

a) **Mapeamento Conceitual:** estruturação das variáveis de negócio em um grafo de conhecimento padronizado;
b) **Anotação Jurídica:** atribuição, pelo especialista jurídico, de descrições referentes a justificativas legais, riscos éticos, atuação como variável *proxy* e demandas de governança para cada atributo;
c) **Geração de Relatório:** seleção das variáveis (*features*) pelo cientista de dados e emissão automatizada de um relatório consolidado contendo as anotações jurídicas das variáveis escolhidas.

## 4 REGISTRO DE DECISÕES ARQUITETURAIS

Esta seção documenta as escolhas estruturais consolidadas durante a concepção do sistema.

### 4.1 Abordagem Semântica Nativa (Decisão 01)

* **Data:** 17 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Adoção de padrões da Web Semântica (W3C) para representação do grafo de conhecimento.
* **Detalhamento:** O grafo de conhecimento será modelado em RDF/OWL, utilizando o vocabulário Schema.org como ontologia de base para conectar variáveis de dados às suas respectivas descrições jurídicas e de governança.

### 4.2 Escopo Funcional Inicial por Relatório Consolidado (Decisão 02)

* **Data:** 17 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Implementação inicial focada na seleção de variáveis e emissão de relatório descritivo automatizado.
* **Detalhamento:** A primeira versão recupera as descrições jurídicas e demandas de governança alocadas às variáveis selecionadas pelo cientista de dados, consolidando-as em um relatório de auditoria.

### 4.3 Arquitetura em Duas Camadas e Índice Pré-processado de Ontologias de Suporte (Decisão 03)

* **Data:** 18 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Uso complementar das ontologias **FIBO**, **Schema.org** e **W3C DPV** por meio de um índice local pré-processado (`ConceitoExterno`), separado das variáveis de governança (`Variavel`).
* **Detalhamento:** Em vez de importar dinamicamente as quatro ontologias completas em tempo de execução — o que traria ruído de domínios não financeiros, lentidão de inferência e conflitos entre formalismos (RDFS flexível vs. OWL 2 DL) —, os termos relevantes das ontologias de suporte (classes e propriedades, preservando suas URIs canônicas) são extraídos para uma camada uniforme e previsível de referência para a interface (`ConceitoExterno`). A camada `Variavel` reúne exclusivamente as variáveis de crédito governadas (com seus textos jurídicos, bases legais e níveis de governança), ligadas aos conceitos externos para garantir lastro científico, literário e defensibilidade regulatória sem poluir o catálogo de variáveis.

### 4.4 Unificação de `Variavel`, Separação Sensível vs. Proxy e Linhagem por Derivação (Decisão 04)

* **Data:** 18 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Unificação das variáveis de crédito em `myont:Variavel`, modelagem ortogonal entre dado sensível e papel de *proxy* (`Variável -> Variável`) e suporte à linhagem de derivação entre variáveis.
* **Detalhamento:**
  * Toda instância de `myont:Variavel` pertence ao domínio de crédito (seja selecionável ou vetada) e possui acesso completo às propriedades descritivas (`xsd:string`) do relatório V1.
  * A natureza jurídica sensível (`myont:VariavelSensivel`, subclasse de `dpv:SensitivePersonalData`) é distinta do papel relacional de *proxy* (`myont:atuaComoProxyDe` ligando diretamente `Variável -> Variável`, definindo por inferência `myont:VariavelProxy`), permitindo que uma mesma variável seja simultaneamente sensível e *proxy* de outra.
  * Novas variáveis podem ser criadas por derivação de variáveis existentes (`derivadaDe`) ou especialização de conceitos externos, mantendo status de curadoria jurídica (`Auditada` vs. `PendenteRevisaoJuridica`) para propagação preventiva de alertas de risco.

### 4.5 Desmembramento do Nó `myont:Risco` e Migração de Nível, Demanda e Implicação Legal (Decisão 05)

* **Data:** 19 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Substituição dos campos 1:1 de risco, implicação legal, demanda de governança e nível de governança por um relacionamento N:M `Variavel -> myont:possuiRisco -> myont:Risco`.
* **Detalhamento:**
  * Uma variável pode apresentar múltiplos riscos distintos, e um risco pode envolver múltiplas normas jurídicas. A relação segue boas práticas OWL com propriedade tipada (`myont:possuiRisco`, `rdfs:domain myont:Variavel`, `rdfs:range myont:Risco`, `rdfs:label "possui risco"@pt-br`).
  * Cada instância de `myont:Risco` reúne: descrição do risco (`rdfs:label` / `myont:descricaoRisco`), seu nível de severidade (`myont:temNivelRisco` $\to$ `myont:NivelRisco`: `Baixo`, `Médio`, `Alto`, `Máximo`, `Veto`, substituindo o antigo `NivelDemandaGovernanca` 1:1), a demanda de governança mitigadora (`myont:descricaoDemandaGovernanca` em `xsd:string`), a implicação legal redigida pelo especialista jurídico (`myont:descricaoImplicacaoLegal` em `xsd:string`) e as normas/dispositivos restringidos ou acionados (`myont:acionaBaseLegal` $\to$ `myont:BaseLegal`).
  * O nível consolidado de risco/governança de uma `Variavel` passa a ser derivado automaticamente a partir dos riscos a ela vinculados.

### 4.6 Separação de Papéis Jurídicos e Estruturação de `BaseLegal` em Instrumento e Dispositivo (Decisão 06)

* **Data:** 19 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Separação entre bases legais que **autorizam o uso** da variável e bases legais que **restringem/sancionam riscos**, acompanhada da estruturação de `myont:BaseLegal` em `InstrumentoNormativo` e `DispositivoLegal`.
* **Detalhamento:**
  * Na `Variavel`, permanece a ligação direta N:M de autorização (`myont:autorizadaPorBaseLegal` $\to$ `myont:BaseLegal`) acompanhada do texto geral de enquadramento (`myont:descricaoJustificativaLegal` em `xsd:string`), sem nó intermediário obrigatório por norma na V1 para manter fluidez no trabalho do especialista jurídico.
  * No `myont:Risco`, ficam vinculadas via `myont:acionaBaseLegal` as normas que vedam, limitam ou geram responsabilização caso o risco se concretize.
  * Para refletir a diversidade do ordenamento jurídico (leis, Constituição, resoluções CMN/BACEN, súmulas, princípios, artigos, parágrafos, incisos e alíneas), `myont:BaseLegal` ($\sqsubseteq$ `dpv:LegalBasis`) passa a ser a superclasse comum de `myont:InstrumentoNormativo` (diploma/fonte normativa com tipo, descrição e fonte/URL) e `myont:DispositivoLegal` (unidade citável ligada ao instrumento por `myont:pertenceAInstrumento`).

### 4.7 Recorte Semântico da V1 para Conceitos Externos, Campos Textuais, Proxy e Datasets (Decisão 07)

* **Data:** 19 nov. 2026.
* **Status:** Aprovada.
* **Decisão:** Manutenção de atributos complementares simplificados na `Variavel` e exclusão de `Dataset` e tipagem estatística de dados do escopo da V1.
* **Detalhamento:**
  * Mantém-se o índice pré-processado focado no recorte de **Schema.org** na V1, preservando a relação 1:N (`Variavel -> ConceitoExterno`) para futura adição de **FIBO** e **W3C DPV** sem atrito.
  * Permanecem como `xsd:string` na `Variavel`: `myont:descricaoOrigem`, `myont:descricaoExplicabilidade` e `myont:descricaoAtuacaoProxy`.
  * A relação `myont:atuaComoProxyDe` permanece direta (`Variavel -> Variavel`, inferindo `myont:VariavelProxy`), com o detalhamento dos efeitos discriminatórios estruturado nos respectivos nós de `myont:Risco`.
  * Ficam fora desta V1 a modelagem de `Dataset`, matrizes de correlação estatística e classes de tipo estatístico de dado (`TipoDado`), para avaliação de custo em etapa posterior.

---

## 5 CASOS DE USO

A adoção prévia de ontologias consolidadas na literatura (**FIBO**, **Schema.org** e **W3C DPV**) viabiliza uma atuação assíncrona e preventiva: o especialista jurídico constrói antecipadamente a base de riscos e conformidade antes mesmo da submissão das *features* pelo cientista de dados, enquanto toda a plataforma se apoia em vocabulários formalmente reconhecidos para sustentação técnica e argumentação jurídica.

### 5.1 UC-01 — Curadoria Jurídica Proativa Baseada em Ontologias de Referência
* **Ator principal:** Especialista Jurídico.
* **Pré-condição:** Índice local de conceitos externos (**FIBO**, **Schema.org**, **DPV**) carregado na plataforma.
* **Fluxo:** O especialista consulta conceitos consolidados de crédito, pessoa e privacidade nas ontologias de suporte, instancia variáveis na `MyOnt` (ou revisa variáveis existentes) e cadastra antecipadamente justificativas legais, riscos éticos, relações de *proxy* entre variáveis e demandas de governança.
* **Resultado:** Formação prévia de uma base robusta e fundamentada na literatura antes do início do treinamento de novos modelos preditivos.

### 5.2 UC-02 — Pesquisa, Comparação e Associação de *Features* Existentes
* **Ator principal:** Cientista de Dados.
* **Pré-condição:** Base de variáveis previamente alimentada pelo especialista jurídico.
* **Fluxo:** Ao planejar ou selecionar as *features* de um modelo de crédito (antes ou no momento de consolidar o CSV do modelo), o cientista pesquisa na interface as variáveis já catalogadas, compara definições, verifica a origem conceitual nas ontologias de suporte e associa as colunas do seu conjunto de dados às variáveis auditadas na `MyOnt`.
* **Resultado:** Redução de retrabalho e alinhamento imediato entre a escolha técnica das *features* e as exigências regulatórias.

### 5.3 UC-03 — Criação de Variável Derivada ou Adaptada a partir de Conceito Existente
* **Ator principal:** Cientista de Dados (com posterior revisão do Especialista Jurídico).
* **Fluxo:** Quando uma *feature* do modelo representa uma adaptação de negócio ou engenharia de atributos (*feature engineering*), o usuário cria uma nova variável mantendo o vínculo explícito com sua origem — seja ligando-a à URI de um conceito externo (ex.: criar uma variante local de renda ligada a `fibo:AllBorrowersMonthlyIncome`), seja derivando-a de variáveis já existentes no catálogo (ex.: razão dívida/renda derivada de renda e dívidas).
* **Resultado:** A nova variável nasce com rastreabilidade semântica, recebe alertas preventivos herdados das variáveis de origem (como riscos de *proxy*) e entra com status pendente de curadoria jurídica.

### 5.4 UC-04 — Cadastro de Variável Totalmente Nova e Análise Sob Demanda
* **Ator principal:** Cientista de Dados e Especialista Jurídico.
* **Fluxo:** Caso o modelo utilize uma variável inédita que ainda não possua correspondência direta no catálogo nem nas ontologias de suporte, o cientista cadastra a nova variável na plataforma com sua descrição técnica e sinalização de pendência jurídica. O especialista jurídico recebe a demanda para avaliar bases legais, riscos éticos e eventuais atuações como *proxy*, incorporando-a ao grafo auditado.
* **Resultado:** Expansão contínua e governada do catálogo sem travar a experimentação.

### 5.5 UC-05 — Geração Automatizada de Relatório Consolidado e Sustentação Argumentativa
* **Atores:** Cientista de Dados, Especialista Jurídico e Auditoria.
* **Fluxo:** A partir da lista final de variáveis selecionadas para o modelo preditivo, a plataforma consulta o grafo de conhecimento e gera automaticamente o relatório consolidado da V1, reunindo pareceres jurídicos, bases legais aplicáveis, alertas de variáveis sensíveis e *proxies*, além das referências formais às ontologias **FIBO**, **Schema.org** e **DPV**.
* **Resultado:** Evidência auditável e defensável perante auditorias internas e órgãos reguladores, demonstrando que a definição conceitual e a avaliação de risco das variáveis têm lastro na literatura e em padrões internacionais.
