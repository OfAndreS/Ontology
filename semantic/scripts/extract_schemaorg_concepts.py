#!/usr/bin/env python3
"""Extrai termos do arquivo Schema.org Turtle para o índice uniforme myont:ConceitoExterno.

Uso:
    python3 scripts/extract_schemaorg_concepts.py
    python3 scripts/extract_schemaorg_concepts.py --scope all
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Set

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "ontologies" / "external" / "schemaorg.ttl"
DEFAULT_OUTPUT_TTL = ROOT_DIR / "data" / "conceitos_externos_schemaorg.ttl"
DEFAULT_OUTPUT_JSON = ROOT_DIR / "data" / "conceitos_externos_schemaorg.json"

# Subconjunto curado de termos/domínios relevantes para crédito, pessoa, finanças,
# moradia, emprego, educação, saúde, localização e comportamento digital.
SEED_CLASSES: Set[str] = {
    "schema:Person",
    "schema:MonetaryAmount",
    "schema:LoanOrCredit",
    "schema:FinancialProduct",
    "schema:BankAccount",
    "schema:BankOrCreditUnion",
    "schema:PaymentCard",
    "schema:CreditCard",
    "schema:RepaymentSpecification",
    "schema:PaymentService",
    "schema:Residence",
    "schema:PostalAddress",
    "schema:GeoCoordinates",
    "schema:Place",
    "schema:Occupation",
    "schema:EmployeeRole",
    "schema:EducationalOccupationalCredential",
    "schema:MedicalCondition",
    "schema:MedicalEntity",
    "schema:SocialMediaPosting",
    "schema:Message",
    "schema:Photograph",
    "schema:ImageObject",
    "schema:FollowAction",
    "schema:BefriendAction",
    "schema:BuyAction",
    "schema:PayAction",
    "schema:GenderType",
    "schema:Organization",
}

EXTRA_TERMS: Set[str] = {
    "schema:amount",
    "schema:address",
    "schema:category",
    "schema:baseSalary",
    "schema:estimatedSalary",
    "schema:employmentType",
    "schema:educationalLevel",
    "schema:monthsOfExperience",
    "schema:loanTerm",
    "schema:loanType",
    "schema:loanRepaymentForm",
    "schema:accountOverdraftLimit",
    "schema:accountMinimumInflow",
    "schema:bankAccountType",
    "schema:netWorth",
    "schema:homeLocation",
    "schema:hasOccupation",
    "schema:birthDate",
    "schema:gender",
    "schema:nationality",
    "schema:children",
    "schema:spouse",
    "schema:parent",
    "schema:parents",
    "schema:alumniOf",
    "schema:lifeEvent",
    "schema:knows",
    "schema:follows",
    "schema:worksFor",
    "schema:workLocation",
    "schema:Female",
    "schema:Male",
}


def ttl_escape(text: str) -> str:
    """Escapa texto para literal Turtle entre aspas duplas simples."""
    cleaned = " ".join(text.replace("\r", " ").replace("\n", " ").split())
    return cleaned.replace("\\", "\\\\").replace('"', '\\"')


def strip_markdown_links(text: str) -> str:
    """Simplifica marcações [[Term]] e links markdown presentes nos comentários do Schema.org."""
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return " ".join(text.split())


def extract_string_field(block: str, predicate: str) -> str:
    """Extrai o valor literal de rdfs:label ou rdfs:comment (simples ou multiline)."""
    triple_pat = re.compile(
        rf"{re.escape(predicate)}\s+\"\"\"(.*?)\"\"\"(?:@[a-zA-Z-]+)?\s*[;.]",
        re.DOTALL,
    )
    m = triple_pat.search(block)
    if m:
        return strip_markdown_links(m.group(1).replace('\\"', '"'))

    single_pat = re.compile(
        rf'{re.escape(predicate)}\s+"((?:[^"\\]|\\.)*)"(?:@[a-zA-Z-]+)?\s*[;.]'
    )
    m = single_pat.search(block)
    if m:
        return strip_markdown_links(m.group(1).replace('\\"', '"'))
    return ""


def extract_uri_list(block: str, predicate: str) -> List[str]:
    """Extrai lista de objetos prefixados associados a um predicado Turtle."""
    pat = re.compile(
        rf"{re.escape(predicate)}\s+(.*?)(?:\s*;|\s*\.\s*$)",
        re.DOTALL | re.MULTILINE,
    )
    m = pat.search(block)
    if not m:
        return []
    raw = m.group(1)
    return re.findall(r"schema:[A-Za-z0-9_]+", raw)


def parse_schemaorg_ttl(ttl_path: Path) -> Dict[str, dict]:
    """Faz o parsing dos blocos schema: em schemaorg-current-https.ttl."""
    text = ttl_path.read_text(encoding="utf-8")
    blocks = re.split(r"\n(?=\S)", text)
    terms: Dict[str, dict] = {}

    for raw_block in blocks:
        block = raw_block.strip()
        if not block.startswith("schema:"):
            continue
        m_head = re.match(r"^(schema:[A-Za-z0-9_]+)\s+(?:a|rdf:type)\s+([^;.\n]+)", block)
        if not m_head:
            continue

        curie = m_head.group(1)
        rdf_types = [t.strip() for t in m_head.group(2).split(",")]

        if "rdfs:Class" in rdf_types:
            kind = "Classe"
        elif "rdf:Property" in rdf_types:
            kind = "Propriedade"
        else:
            kind = "Enumeração"

        label = extract_string_field(block, "rdfs:label") or curie.split(":", 1)[1]
        comment = extract_string_field(block, "rdfs:comment")
        subclasses = extract_uri_list(block, "rdfs:subClassOf")
        subprops = extract_uri_list(block, "rdfs:subPropertyOf")
        domains = extract_uri_list(block, "schema:domainIncludes")
        ranges = extract_uri_list(block, "schema:rangeIncludes")

        context_parts: List[str] = []
        if kind == "Classe" and subclasses:
            context_parts.append("subClassOf: " + ", ".join(subclasses))
        elif kind == "Propriedade":
            if domains:
                context_parts.append("domainIncludes: " + ", ".join(domains))
            if ranges:
                context_parts.append("rangeIncludes: " + ", ".join(ranges))
            if subprops:
                context_parts.append("subPropertyOf: " + ", ".join(subprops))
        else:
            context_parts.append("tipo: " + ", ".join(rdf_types))

        terms[curie] = {
            "curie": curie,
            "uri": "https://schema.org/" + curie.split(":", 1)[1],
            "label": label,
            "comment": comment,
            "tipo": kind,
            "rdf_types": rdf_types,
            "subclasses": subclasses,
            "domains": domains,
            "ranges": ranges,
            "contexto": " | ".join(context_parts),
        }

    return terms


def filter_credit_scope(terms: Dict[str, dict]) -> Dict[str, dict]:
    """Filtra termos relevantes para o domínio de crédito e governança V1."""
    selected: Set[str] = set()

    for curie, info in terms.items():
        if curie in SEED_CLASSES or curie in EXTRA_TERMS:
            selected.add(curie)
            continue
        if any(sc in SEED_CLASSES for sc in info["subclasses"]):
            selected.add(curie)
            continue
        if any(t in SEED_CLASSES for t in info["rdf_types"]):
            selected.add(curie)
            continue
        if any(d in SEED_CLASSES for d in info["domains"]):
            selected.add(curie)
            continue

    return {k: terms[k] for k in sorted(selected) if k in terms}


def write_outputs(selected: Dict[str, dict], out_ttl: Path, out_json: Path) -> None:
    """Grava o índice normalizado em Turtle (myont:ConceitoExterno) e JSON."""
    out_ttl.parent.mkdir(parents=True, exist_ok=True)

    lines: List[str] = [
        "@prefix myont: <https://ontologia.governanca.credito/myont#> .",
        "@prefix schema: <https://schema.org/> .",
        "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "#################################################################",
        "#    ÍNDICE PRÉ-PROCESSADO DE CONCEITOS EXTERNOS (Schema.org)",
        "#################################################################",
        "",
    ]

    for curie, info in selected.items():
        lines.append(f"{curie} rdf:type owl:NamedIndividual , myont:ConceitoExterno ;")
        lines.append(f'    rdfs:label "{ttl_escape(info["label"])}" ;')
        if info["comment"]:
            lines.append(f'    rdfs:comment "{ttl_escape(info["comment"])}" ;')
        lines.append('    myont:ontologiaOrigem "Schema.org" ;')
        lines.append(f'    myont:tipoTermoExterno "{ttl_escape(info["tipo"])}" ;')
        if info["contexto"]:
            lines.append(f'    myont:contextoExterno "{ttl_escape(info["contexto"])}" ;')
        # Substitui o último ';' por '.'
        lines[-1] = lines[-1][:-1] + "."
        lines.append("")

    out_ttl.write_text("\n".join(lines), encoding="utf-8")
    out_json.write_text(
        json.dumps(list(selected.values()), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrai conceitos do Schema.org para MyOnt.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-ttl", type=Path, default=DEFAULT_OUTPUT_TTL)
    parser.add_argument("--output-json", type=Path, default=DEFAULT_OUTPUT_JSON)
    parser.add_argument(
        "--scope",
        choices=["credit", "all"],
        default="credit",
        help="credit: subconjunto curado para crédito; all: todos os termos do Schema.org.",
    )
    args = parser.parse_args()

    all_terms = parse_schemaorg_ttl(args.input)
    selected = all_terms if args.scope == "all" else filter_credit_scope(all_terms)
    write_outputs(selected, args.output_ttl, args.output_json)
    print(f"Extraídos {len(selected)} conceitos (de {len(all_terms)} totais) para {args.output_ttl}")


if __name__ == "__main__":
    main()
