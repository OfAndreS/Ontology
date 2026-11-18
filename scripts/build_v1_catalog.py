#!/usr/bin/env python3
"""Converte as variáveis do Anexo 4 mapeadas ao Schema.org para instâncias de myont:Variavel.

Gera:
- data/variaveis_schemaorg_v1.ttl (somente as variáveis V1 reduzidas)
- data/variaveis_schemaorg_v1.json (espelho estruturado)
- data/grafo_v1_completo.ttl (esquema MyOnt + Conceitos Schema.org + Variáveis V1)
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Set

ROOT_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT_DIR / "Anexo4 - Governança de Variáveis para Crédito - V1.csv"
MAPPING_PATH = ROOT_DIR / "mappings" / "schemaorg_anexo4_mapping.json"
CONCEPTS_JSON = ROOT_DIR / "data" / "conceitos_schemaorg.json"
CONCEPTS_TTL = ROOT_DIR / "data" / "conceitos_schemaorg.ttl"
SCHEMA_TTL = ROOT_DIR / "ontology" / "myont_v1.ttl"

OUT_VARS_TTL = ROOT_DIR / "data" / "variaveis_schemaorg_v1.ttl"
OUT_VARS_JSON = ROOT_DIR / "data" / "variaveis_schemaorg_v1.json"
OUT_BUNDLE_TTL = ROOT_DIR / "data" / "grafo_v1_completo.ttl"


def ttl_escape(text: str) -> str:
    """Escapa texto para literal Turtle entre aspas duplas."""
    cleaned = " ".join(text.replace("\r", " ").replace("\n", " ").split())
    return cleaned.replace("\\", "\\\\").replace('"', '\\"')


def load_csv_rows(csv_path: Path) -> Dict[str, dict]:
    """Carrega linhas válidas do Anexo 4 indexadas pelo nome exato da variável."""
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    records: Dict[str, dict] = {}
    for row in rows[2:]:
        if not row or not row[0].strip() or row[0].strip() == "Variável":
            continue
        padded = row + [""] * max(0, 8 - len(row))
        name = padded[0].strip()
        records[name] = {
            "variavel": name,
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
    """Mapeia menções jurídicas do CSV para indivíduos myont:BaseLegal."""
    t = texto.lower()
    bases: List[str] = []

    if "proteção ao crédito" in t or "art. 7" in t:
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
    if "art. 11" in t or "sensível" in t:
        bases.append("myont:LGPD_Art11_DadosSensiveis")
    if "14.181" in t:
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

    return list(dict.fromkeys(bases))


def infer_nivel_governanca(texto: str) -> str:
    """Mapeia o texto da coluna de governança para myont:NivelDemandaGovernanca."""
    t = texto.lower()
    if "veto" in t or "impossível" in t or "crítico:" in t or "proibir" in t or "vetado" in t:
        return "myont:Governanca_Veto"
    if t.startswith("máxima"):
        return "myont:Governanca_Maxima"
    if t.startswith("alta"):
        return "myont:Governanca_Alta"
    if t.startswith("média"):
        return "myont:Governanca_Media"
    if t.startswith("baixa"):
        return "myont:Governanca_Baixa"
    return "myont:Governanca_Media"


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
        "#    CATÁLOGO V1 REDUZIDO (VARIÁVEIS DO ANEXO 4 EM SCHEMA.ORG)",
        "#################################################################",
        "",
    ]

    json_records: List[dict] = []

    for item in mapping:
        var_id = item["id"]
        csv_name = item["csv_name"]
        if csv_name not in csv_records:
            raise KeyError(f"Variável '{csv_name}' não encontrada no CSV {CSV_PATH}")

        rec = csv_records[csv_name]
        bases = infer_bases_legais(rec["justificativa_legal"])
        nivel = infer_nivel_governanca(rec["demanda_governanca"])

        for st in item["schema_terms"]:
            if st["curie"] not in valid_concepts:
                raise KeyError(
                    f"Conceito '{st['curie']}' (variável {var_id}) não está no índice {CONCEPTS_JSON}"
                )

        for target in item["proxy_de"]:
            if target not in valid_var_ids:
                raise KeyError(
                    f"Alvo de proxy '{target}' (variável {var_id}) não pertence ao subconjunto V1"
                )

        rdf_classes = ["owl:NamedIndividual", "myont:Variavel"]
        if item["sensivel"]:
            rdf_classes.append("myont:VariavelSensivel")

        ttl_lines.append(f"myont:{var_id} rdf:type {' , '.join(rdf_classes)} ;")
        ttl_lines.append(f'    rdfs:label "{ttl_escape(csv_name)}"@en ;')
        ttl_lines.append("    myont:temStatusCuradoria myont:Status_Auditada ;")
        ttl_lines.append(f"    myont:temNivelGovernanca {nivel} ;")

        if bases:
            ttl_lines.append(f"    myont:temBaseLegal {' , '.join(bases)} ;")

        equiv_terms = [
            st["curie"] for st in item["schema_terms"] if st["rel"] == "equivalente"
        ]
        based_terms = [
            st["curie"] for st in item["schema_terms"] if st["rel"] == "baseada"
        ]
        if equiv_terms:
            ttl_lines.append(
                f"    myont:equivalenteAConceitoExterno {' , '.join(equiv_terms)} ;"
            )
        if based_terms:
            ttl_lines.append(
                f"    myont:baseadaEmConceitoExterno {' , '.join(based_terms)} ;"
            )

        if item["proxy_de"]:
            proxies = [f"myont:{p}" for p in item["proxy_de"]]
            ttl_lines.append(f"    myont:atuaComoProxyDe {' , '.join(proxies)} ;")

        field_map = [
            ("myont:descricaoOrigem", rec["origem"]),
            ("myont:descricaoJustificativaLegal", rec["justificativa_legal"]),
            ("myont:descricaoRiscoEtico", rec["risco_etico"]),
            ("myont:descricaoDemandaGovernanca", rec["demanda_governanca"]),
            ("myont:descricaoExplicabilidade", rec["explicabilidade"]),
            ("myont:descricaoImplicacaoLegal", rec["implicacao_legal"]),
            ("myont:descricaoAtuacaoProxy", rec["atuacao_proxy"]),
        ]
        for prop, val in field_map:
            if val:
                ttl_lines.append(f'    {prop} "{ttl_escape(val)}" ;')

        ttl_lines[-1] = ttl_lines[-1][:-1] + "."
        ttl_lines.append("")

        json_records.append(
            {
                "id": var_id,
                "uri": f"https://ontologia.governanca.credito/myont#{var_id}",
                "nome": csv_name,
                "sensivel": item["sensivel"],
                "status_curadoria": "Auditada",
                "nivel_governanca": nivel.replace("myont:", ""),
                "bases_legais": [b.replace("myont:", "") for b in bases],
                "schema_terms": item["schema_terms"],
                "proxy_de": item["proxy_de"],
                "derivada_de": [],
                **rec,
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

    print(f"Convertidas {len(json_records)} variáveis do Anexo 4 para {OUT_VARS_TTL}")
    print(f"Grafo completo unificado salvo em {OUT_BUNDLE_TTL}")


if __name__ == "__main__":
    main()
