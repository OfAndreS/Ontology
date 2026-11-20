#!/usr/bin/env python3
"""Converte as variáveis do Anexo 4 mapeadas ao Schema.org para instâncias da MyOnt V2.

Gera:
- semantic/data/variaveis_v2.ttl (Variáveis V2 + nós myont:Risco desmembrados)
- semantic/data/variaveis_v2.json (espelho estruturado)
- semantic/data/grafo_v2_completo.ttl (esquema MyOnt V2 + Conceitos Schema.org + Variáveis V2)
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Set

ROOT_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT_DIR / "raw" / "Anexo4 - Governança de Variáveis para Crédito - V1.csv"
MAPPING_PATH = ROOT_DIR / "mappings" / "schemaorg_anexo4_mapping.json"
CONCEPTS_JSON = ROOT_DIR / "data" / "conceitos_externos_schemaorg.json"
CONCEPTS_TTL = ROOT_DIR / "data" / "conceitos_externos_schemaorg.ttl"
SCHEMA_TTL = ROOT_DIR / "ontologies" / "myont_v2.ttl"

OUT_VARS_TTL = ROOT_DIR / "data" / "variaveis_v2.ttl"
OUT_VARS_JSON = ROOT_DIR / "data" / "variaveis_v2.json"
OUT_BUNDLE_TTL = ROOT_DIR / "data" / "grafo_v2_completo.ttl"


def ttl_escape(text: str) -> str:
    """Escapa texto para literal Turtle entre aspas duplas."""
    cleaned = " ".join(text.replace("\r", " ").replace("\n", " ").split())
    return cleaned.replace("\\", "\\\\").replace('"', '\\"')


CATEGORIES_ORDER = [
    ("Cat_Socioeconomico", "Socioeconômico", "socioeconomico", "Variáveis socioeconômicas de renda, patrimônio, ocupação e estrutura familiar."),
    ("Cat_Demografico", "Demográfico", "demografico", "Atributos demográficos e cadastrais protegidos contra discriminação."),
    ("Cat_InstitucionalFinanceiro", "Institucional e Financeiro", "institucional-e-financeiro", "Histórico de crédito, relacionamento bancário, saldo e compromissos financeiros."),
    ("Cat_ValoresAtitudesComportamento", "Valores, Atitudes e Comportamento", "valores-atitudes-e-comportamento", "Preferências de consumo, letramento financeiro, atitudes e padrões comportamentais."),
    ("Cat_Personalidade", "Personalidade", "personalidade", "Traços psicológicos, psicométricos e comportamentais avaliados com cautela regulatória."),
    ("Cat_Situacional", "Situacional", "situacional", "Eventos adversos e choques situacionais na vida do titular."),
    ("Cat_Educacional", "Educacional", "educacional", "Formação acadêmica, área de estudo e histórico educacional."),
    ("Cat_Macroeconomico", "Macroeconômico", "macroeconomico", "Indicadores econômicos agregados e variáveis de contexto macro."),
    ("Cat_Saude", "Saúde", "saude", "Indicadores de saúde física e mental (dados pessoais sensíveis sob LGPD Art. 11)."),
    ("Cat_DadosAlternativos", "Dados Alternativos", "dados-alternativos", "Metadados digitais, redes sociais, geolocalização e comportamento em dispositivos."),
    ("Cat_FinanceiroCorporativoPJ", "Financeiro Corporativo (PJ)", "financeiro-corporativo-pj", "Indicadores contábeis e financeiros de pessoa jurídica."),
]


def load_csv_rows(csv_path: Path) -> Dict[str, dict]:
    """Carrega linhas válidas do Anexo 4 indexadas pelo nome exato da variável e sua categoria."""
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    records: Dict[str, dict] = {}
    section_idx = -1
    for row in rows:
        first_cell = row[0].strip() if row else ""
        if not first_cell:
            continue
        if first_cell == "Variável":
            section_idx += 1
            continue
        if section_idx < 0 or section_idx >= len(CATEGORIES_ORDER):
            raise ValueError(f"Seção inesperada ({section_idx}) ao processar linha: {first_cell}")
        cat_id, cat_label, cat_slug, _ = CATEGORIES_ORDER[section_idx]
        padded = row + [""] * max(0, 8 - len(row))
        name = padded[0].strip()
        records[name] = {
            "variavel": name,
            "categoria_id": cat_id,
            "categoria_nome": cat_label,
            "categoria_slug": cat_slug,
            "origem": padded[1].strip(),
            "justificativa_legal": padded[2].strip(),
            "risco_etico": padded[3].strip(),
            "demanda_governanca": padded[4].strip(),
            "explicabilidade": padded[5].strip(),
            "implicacao_legal": padded[6].strip(),
            "atuacao_proxy": padded[7].strip(),
        }
    return records


def infer_bases_legais(texto: str) -> List[str]:
    """Mapeia menções jurídicas do CSV para indivíduos myont:BaseLegal (Instrumento/Dispositivo)."""
    t = texto.lower()
    bases: List[str] = []

    if "proteção ao crédito" in t or "art. 7" in t or "artigo 7" in t:
        if "obrigação legal" not in t and "interesse legítimo" not in t and "consentimento" not in t:
            bases.append("myont:LGPD_Art7_X_ProtecaoCredito")
        elif "proteção ao crédito" in t or "7, x" in t or "7º, x" in t:
            bases.append("myont:LGPD_Art7_X_ProtecaoCredito")
    if "execução de contrato" in t:
        bases.append("myont:LGPD_Art7_V_ExecucaoContrato")
    if "interesse legítimo" in t:
        bases.append("myont:LGPD_Art7_IX_InteresseLegitimo")
    if "consentimento" in t:
        bases.append("myont:LGPD_Art7_I_Consentimento")
    if "obrigação legal" in t:
        bases.append("myont:LGPD_Art7_II_ObrigacaoLegal")
    if "art. 6" in t:
        bases.append("myont:LGPD_Art6_I_Finalidade")
    if "art. 11" in t or "dados sensíveis" in t or "dado sensível" in t:
        bases.append("myont:LGPD_Art11_DadosSensiveis")
    if "14.181" in t or "superendividamento" in t:
        bases.append("myont:Lei_14181_2021_Superendividamento")
    if "4.966" in t or "cmn" in t:
        bases.append("myont:Res_CMN_4966_2021")
    if "bacen" in t:
        bases.append("myont:Normas_BACEN")
    if "1.419" in t or "garantias" in t:
        bases.append("myont:CodigoCivil_Garantias")
    elif "código civil" in t:
        bases.append("myont:CodigoCivil_Geral")
    if re.search(r"\bart\.?\s*3º?\b", t):
        bases.append("myont:CF_Art3_IV_VedacaoDiscriminacao")
    if re.search(r"\bart\.?\s*5º,\s*i\b", t):
        bases.append("myont:CF_Art5_I_IgualdadeGenero")
    if re.search(r"\bart\.?\s*5º,\s*xv\b", t):
        bases.append("myont:CF_Art5_XV_LiberdadeLocomocao")
    if re.search(r"\bart\.?\s*5º,\s*(?:iv|x|xii)\b", t):
        bases.append("myont:CF_Art5_PrivacidadeSigilo")
    if "marco civil" in t:
        bases.append("myont:MarcoCivil_Internet")
    if "estatuto do idoso" in t or "estatuto da pessoa idosa" in t:
        bases.append("myont:Estatuto_PessoaIdosa")

    return list(dict.fromkeys(bases))


def infer_nivel_risco(texto_gov: str, texto_risco: str = "", texto_impl: str = "") -> str:
    """Mapeia os textos de governança/risco/implicação para myont:NivelRisco."""
    t = f"{texto_gov} {texto_risco} {texto_impl}".lower()
    if (
        "veto" in t
        or "vetado" in t
        or "impossível" in t
        or "crítico:" in t
        or "proibido" in t
        or "proibir" in t
        or "não recomendado" in t
        or "violação direta" in t
    ):
        return "myont:Risco_Veto"
    if texto_gov.lower().startswith("máxima"):
        return "myont:Risco_Maximo"
    if texto_gov.lower().startswith("alta") or "alto risco" in texto_risco.lower():
        return "myont:Risco_Alto"
    if texto_gov.lower().startswith("média"):
        return "myont:Risco_Medio"
    if texto_gov.lower().startswith("baixa"):
        return "myont:Risco_Baixo"
    return "myont:Risco_Medio"


def split_risk_descriptions(risco_text: str) -> List[str]:
    """Desmembra riscos múltiplos separados por ';' quando cada parte é substantiva."""
    cleaned = re.sub(r"\s*[,;]+\s*", lambda m: "; " if ";" in m.group(0) else ", ", risco_text.strip())
    if not cleaned:
        return []
    parts = [p.strip() for p in cleaned.split(";") if p.strip()]
    if len(parts) <= 1:
        return [cleaned]
    if all(len(p.split()) >= 2 for p in parts):
        return [p[0].upper() + p[1:] if len(p) > 1 else p.upper() for p in parts]
    return [cleaned]


def split_auth_and_risk_bases(rec: dict) -> tuple[List[str], List[str]]:
    """Separa bases legais autorizadoras (na Variavel) das acionadas/restringidas (no Risco)."""
    just_text = rec["justificativa_legal"]
    risk_text = f"{rec['risco_etico']} {rec['implicacao_legal']}"

    prohibition_only = {
        "myont:CF_Art3_IV_VedacaoDiscriminacao",
        "myont:CF_Art5_I_IgualdadeGenero",
        "myont:LGPD_Art11_DadosSensiveis",
        "myont:Estatuto_PessoaIdosa",
    }

    from_just = infer_bases_legais(just_text)
    from_risk = infer_bases_legais(risk_text)

    # Em justificativas que citam vedações ("não deve", "proibido"), transfere a norma para o Risco
    has_prohibition_phrase = any(
        kw in just_text.lower() for kw in ("não deve", "proibido", "vedado", "somente para")
    )

    auth_bases: List[str] = []
    risk_bases: List[str] = list(from_risk)

    for b in from_just:
        if b in prohibition_only or (has_prohibition_phrase and b.startswith("myont:CF_")):
            if b not in risk_bases:
                risk_bases.append(b)
        else:
            auth_bases.append(b)

    return auth_bases, list(dict.fromkeys(risk_bases))


def strip_prefixes(ttl_text: str) -> str:
    """Remove linhas de @prefix ao concatenar arquivos TTL em um único grafo."""
    return "\n".join(
        line for line in ttl_text.splitlines() if not line.strip().startswith("@prefix ")
    )


def main() -> None:
    if not CONCEPTS_JSON.exists():
        raise FileNotFoundError(
            f"Índice não encontrado em {CONCEPTS_JSON}. Execute extract_schemaorg_concepts.py antes."
        )

    concepts_list = json.loads(CONCEPTS_JSON.read_text(encoding="utf-8"))
    valid_concepts: Set[str] = {c["curie"] for c in concepts_list}
    mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))["variables"]
    csv_records = load_csv_rows(CSV_PATH)
    valid_var_ids: Set[str] = {item["id"] for item in mapping}

    ttl_lines: List[str] = [
        "@prefix myont: <https://ontologia.governanca.credito/myont#> .",
        "@prefix schema: <https://schema.org/> .",
        "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "#################################################################",
        "#    CATEGORIAS TEMÁTICAS (DECISÃO 08)",
        "#################################################################",
        "",
    ]

    for cat_id, cat_label, cat_slug, cat_desc in CATEGORIES_ORDER:
        ttl_lines.append(f"myont:{cat_id} rdf:type owl:NamedIndividual , myont:Categoria ;")
        ttl_lines.append(f'    rdfs:label "{ttl_escape(cat_label)}"@pt-br ;')
        ttl_lines.append(f'    myont:slugCategoria "{ttl_escape(cat_slug)}"^^xsd:string ;')
        ttl_lines.append(f'    myont:descricaoCategoria "{ttl_escape(cat_desc)}"^^xsd:string .')
        ttl_lines.append("")

    ttl_lines.extend([
        "#################################################################",
        "#    CATÁLOGO V2 (VARIÁVEIS + NÓS myont:Risco DESMEMBRADOS)",
        "#################################################################",
        "",
    ])

    json_records: List[dict] = []

    for item in mapping:
        var_id = item["id"]
        csv_name = item["csv_name"]
        if csv_name not in csv_records:
            raise KeyError(f"Variável '{csv_name}' não encontrada no CSV {CSV_PATH}")

        rec = csv_records[csv_name]
        auth_bases, risk_bases = split_auth_and_risk_bases(rec)
        nivel_default = infer_nivel_risco(rec["demanda_governanca"], rec["risco_etico"], rec["implicacao_legal"])
        risk_parts = split_risk_descriptions(rec["risco_etico"])

        for st in item["schema_terms"]:
            if st["curie"] not in valid_concepts:
                raise KeyError(
                    f"Conceito '{st['curie']}' (variável {var_id}) não está no índice {CONCEPTS_JSON}"
                )

        for target in item["proxy_de"]:
            if target not in valid_var_ids:
                raise KeyError(
                    f"Alvo de proxy '{target}' (variável {var_id}) não pertence ao subconjunto mapeado"
                )

        risk_nodes: List[dict] = []
        for idx, desc in enumerate(risk_parts, start=1):
            r_id = f"Risco_{var_id}_{idx}"
            r_nivel = infer_nivel_risco(rec["demanda_governanca"], desc, rec["implicacao_legal"])
            risk_nodes.append(
                {
                    "id": r_id,
                    "uri": f"https://ontologia.governanca.credito/myont#{r_id}",
                    "descricao": desc,
                    "nivel_risco": r_nivel.replace("myont:", ""),
                    "demanda_governanca": rec["demanda_governanca"],
                    "implicacao_legal": rec["implicacao_legal"],
                    "bases_acionadas": [b.replace("myont:", "") for b in risk_bases],
                    "_nivel_curie": r_nivel,
                    "_bases_curies": risk_bases,
                }
            )

        # Caso não haja texto em risco_etico, mas exista implicação ou demanda de governança
        if not risk_nodes and (rec["implicacao_legal"] or rec["demanda_governanca"]):
            r_id = f"Risco_{var_id}_1"
            risk_nodes.append(
                {
                    "id": r_id,
                    "uri": f"https://ontologia.governanca.credito/myont#{r_id}",
                    "descricao": "Risco operacional ou de conformidade associado ao uso do atributo",
                    "nivel_risco": nivel_default.replace("myont:", ""),
                    "demanda_governanca": rec["demanda_governanca"],
                    "implicacao_legal": rec["implicacao_legal"],
                    "bases_acionadas": [b.replace("myont:", "") for b in risk_bases],
                    "_nivel_curie": nivel_default,
                    "_bases_curies": risk_bases,
                }
            )

        rdf_classes = ["owl:NamedIndividual", "myont:Variavel"]
        if item["sensivel"]:
            rdf_classes.append("myont:VariavelSensivel")

        ttl_lines.append(f"myont:{var_id} rdf:type {' , '.join(rdf_classes)} ;")
        ttl_lines.append(f'    rdfs:label "{ttl_escape(csv_name)}"@en ;')
        ttl_lines.append("    myont:temStatusCuradoria myont:Status_Auditada ;")
        ttl_lines.append(f"    myont:pertenceACategoria myont:{rec['categoria_id']} ;")

        if auth_bases:
            ttl_lines.append(f"    myont:autorizadaPorBaseLegal {' , '.join(auth_bases)} ;")

        if risk_nodes:
            r_refs = [f"myont:{rn['id']}" for rn in risk_nodes]
            ttl_lines.append(f"    myont:possuiRisco {' , '.join(r_refs)} ;")

        equiv_terms = [st["curie"] for st in item["schema_terms"] if st["rel"] == "equivalente"]
        based_terms = [st["curie"] for st in item["schema_terms"] if st["rel"] == "baseada"]
        if equiv_terms:
            ttl_lines.append(f"    myont:equivalenteAConceitoExterno {' , '.join(equiv_terms)} ;")
        if based_terms:
            ttl_lines.append(f"    myont:baseadaEmConceitoExterno {' , '.join(based_terms)} ;")

        if item["proxy_de"]:
            proxies = [f"myont:{p}" for p in item["proxy_de"]]
            ttl_lines.append(f"    myont:atuaComoProxyDe {' , '.join(proxies)} ;")

        var_text_fields = [
            ("myont:descricaoOrigem", rec["origem"]),
            ("myont:descricaoJustificativaLegal", rec["justificativa_legal"]),
            ("myont:descricaoExplicabilidade", rec["explicabilidade"]),
            ("myont:descricaoAtuacaoProxy", rec["atuacao_proxy"]),
        ]
        for prop, val in var_text_fields:
            if val:
                ttl_lines.append(f'    {prop} "{ttl_escape(val)}"^^xsd:string ;')

        ttl_lines[-1] = ttl_lines[-1][:-1] + "."
        ttl_lines.append("")

        # Instâncias myont:Risco da variável
        for rn in risk_nodes:
            ttl_lines.append(f"myont:{rn['id']} rdf:type owl:NamedIndividual , myont:Risco ;")
            ttl_lines.append(f'    rdfs:label "{ttl_escape(rn["descricao"])}"@pt-br ;')
            ttl_lines.append(f'    myont:descricaoRisco "{ttl_escape(rn["descricao"])}"^^xsd:string ;')
            ttl_lines.append(f"    myont:temNivelRisco {rn['_nivel_curie']} ;")
            if rn["_bases_curies"]:
                ttl_lines.append(f"    myont:acionaBaseLegal {' , '.join(rn['_bases_curies'])} ;")
            if rn["demanda_governanca"]:
                ttl_lines.append(
                    f'    myont:descricaoDemandaGovernanca "{ttl_escape(rn["demanda_governanca"])}"^^xsd:string ;'
                )
            if rn["implicacao_legal"]:
                ttl_lines.append(
                    f'    myont:descricaoImplicacaoLegal "{ttl_escape(rn["implicacao_legal"])}"^^xsd:string ;'
                )
            ttl_lines[-1] = ttl_lines[-1][:-1] + "."
            ttl_lines.append("")

        json_records.append(
            {
                "id": var_id,
                "uri": f"https://ontologia.governanca.credito/myont#{var_id}",
                "nome": csv_name,
                "categoria_id": rec["categoria_id"],
                "categoria_nome": rec["categoria_nome"],
                "sensivel": item["sensivel"],
                "status_curadoria": "Auditada",
                "bases_autorizadoras": [b.replace("myont:", "") for b in auth_bases],
                "schema_terms": item["schema_terms"],
                "proxy_de": item["proxy_de"],
                "derivada_de": [],
                "origem": rec["origem"],
                "justificativa_legal": rec["justificativa_legal"],
                "explicabilidade": rec["explicabilidade"],
                "atuacao_proxy": rec["atuacao_proxy"],
                "riscos": [
                    {k: v for k, v in rn.items() if not k.startswith("_")}
                    for rn in risk_nodes
                ],
            }
        )

    OUT_VARS_TTL.write_text("\n".join(ttl_lines), encoding="utf-8")
    OUT_VARS_JSON.write_text(
        json.dumps(json_records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    bundle_parts = [
        SCHEMA_TTL.read_text(encoding="utf-8").strip(),
        "",
        strip_prefixes(CONCEPTS_TTL.read_text(encoding="utf-8")).strip(),
        "",
        strip_prefixes(OUT_VARS_TTL.read_text(encoding="utf-8")).strip(),
        "",
    ]
    OUT_BUNDLE_TTL.write_text("\n".join(bundle_parts), encoding="utf-8")

    total_risks = sum(len(r["riscos"]) for r in json_records)
    print(f"Convertidas {len(json_records)} variáveis e {total_risks} nós myont:Risco para {OUT_VARS_TTL}")
    print(f"Grafo V2 completo salvo em {OUT_BUNDLE_TTL}")


if __name__ == "__main__":
    main()
