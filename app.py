"""Interface Streamlit V1 — Governança Algorítmica Preventiva (MyOnt)."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List

import pandas as pd
import streamlit as st

from src.ontology_service import (
    DESC_FIELDS,
    MYONT,
    ConceitoExterno,
    OntologyService,
    VariavelRecord,
    sanitize_identifier,
)

st.set_page_config(
    page_title="MyOnt V1 — Governança Algorítmica Preventiva",
    page_icon="⚖️",
    layout="wide",
)


@st.cache_resource
def get_service() -> OntologyService:
    return OntologyService()


def build_markdown_report(
    selected_vars: List[VariavelRecord],
    vars_by_id: Dict[str, VariavelRecord],
    unmatched_cols: List[str],
    service: OntologyService,
    model_name: str,
) -> str:
    """Gera o relatório consolidado da V1 em Markdown para auditoria e defesa técnica."""
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    lines = [
        f"# Relatório Preventivo de Governança Algorítmica (V1) — {model_name or 'Modelo de Crédito'}",
        f"**Gerado em:** {now_str}  ",
        f"**Variáveis auditadas selecionadas:** {len(selected_vars)}  ",
        "",
        "## 1. Resumo Executivo de Riscos",
    ]

    vetos = [v for v in selected_vars if v.nivel_governanca in {"Governanca_Veto", "Governanca_Maxima"}]
    sensiveis = [v for v in selected_vars if v.sensivel]
    proxies = [v for v in selected_vars if v.is_proxy]
    pendentes = [v for v in selected_vars if v.status_curadoria != "Status_Auditada"]

    lines.extend(
        [
            f"- **Nível Veto / Governança Máxima:** {len(vetos)}",
            f"- **Variáveis Sensíveis / Protegidas:** {len(sensiveis)}",
            f"- **Variáveis com Atuação como Proxy:** {len(proxies)}",
            f"- **Pendentes de Revisão Jurídica:** {len(pendentes)}",
        ]
    )

    if unmatched_cols:
        lines.append(f"- **Colunas do CSV não mapeadas na ontologia:** {', '.join(unmatched_cols)}")

    lines.extend(["", "## 2. Detalhamento Jurídico e Semântico por Variável"])

    for v in selected_vars:
        inherited = service.trace_inherited_alerts(v.id, vars_by_id)
        conceitos = [f"{c} (Equivalente)" for c in v.conceitos_equivalentes] + [
            f"{c} (Baseada)" for c in v.conceitos_baseados
        ]
        proxies_lbl = [vars_by_id[p].label if p in vars_by_id else p for p in v.proxy_de]
        deriv_lbl = [vars_by_id[d].label if d in vars_by_id else d for d in v.derivada_de]

        lines.extend(
            [
                "",
                f"### {v.label} (`{v.id}`)",
                f"- **Nível de Governança:** {v.nivel_label}",
                f"- **Status de Curadoria:** {v.status_label}",
                f"- **Variável Sensível:** {'Sim' if v.sensivel else 'Não'}",
                f"- **Atua como Proxy de:** {', '.join(proxies_lbl) if proxies_lbl else 'Nenhuma ligação direta mapeada'}",
                f"- **Derivada de:** {', '.join(deriv_lbl) if deriv_lbl else '—'}",
                f"- **Lastro Externo (Schema.org):** {', '.join(conceitos) if conceitos else 'Sem vínculo externo'}",
                f"- **Bases Legais:** {', '.join(v.bases_legais_labels) if v.bases_legais_labels else 'Não informada'}",
            ]
        )
        if inherited:
            lines.append("- **Alertas Propagados por Derivação:**")
            for al in inherited:
                lines.append(f"  - {al}")

        for key, _, title in DESC_FIELDS:
            val = v.descricoes.get(key, "")
            if val:
                lines.append(f"- **{title}:** {val}")

    return "\n".join(lines)


def render_catalog_tab(
    service: OntologyService,
    variables: List[VariavelRecord],
    vars_by_id: Dict[str, VariavelRecord],
    concepts: List[ConceitoExterno],
    concepts_by_curie: Dict[str, ConceitoExterno],
) -> None:
    st.subheader("Catálogo Semântico de Variáveis & Conceitos Externos")
    view_mode = st.radio(
        "Visualização",
        ["Variáveis de Crédito (MyOnt)", "Conceitos de Referência (Schema.org)"],
        horizontal=True,
    )

    if view_mode == "Variáveis de Crédito (MyOnt)":
        c1, c2, c3, c4 = st.columns([2, 1.3, 1, 1])
        query = c1.text_input("Buscar variável ou termo Schema.org", placeholder="Ex.: Income, MonetaryAmount, gender...")
        gov_options = ["Todos"] + sorted({v.nivel_label for v in variables})
        gov_filter = c2.selectbox("Nível de Governança", gov_options)
        only_sens = c3.checkbox("Apenas Sensíveis")
        only_proxy = c4.checkbox("Apenas Proxies")

        filtered: List[VariavelRecord] = []
        q = query.strip().lower()
        for v in variables:
            if gov_filter != "Todos" and v.nivel_label != gov_filter:
                continue
            if only_sens and not v.sensivel:
                continue
            if only_proxy and not v.is_proxy:
                continue
            haystack = " ".join(
                [
                    v.id,
                    v.label,
                    " ".join(v.conceitos_equivalentes),
                    " ".join(v.conceitos_baseados),
                    " ".join(v.descricoes.values()),
                ]
            ).lower()
            if q and q not in haystack:
                continue
            filtered.append(v)

        st.caption(f"Exibindo {len(filtered)} de {len(variables)} variáveis catalogadas.")
        if not filtered:
            st.info("Nenhuma variável encontrada com os filtros atuais.")
            return

        rows = []
        for v in filtered:
            ext = ", ".join(v.conceitos_equivalentes + v.conceitos_baseados)
            px = ", ".join(vars_by_id[p].label if p in vars_by_id else p for p in v.proxy_de)
            rows.append(
                {
                    "Variável": v.label,
                    "ID": v.id,
                    "Governança": v.nivel_label,
                    "Sensível": "Sim" if v.sensivel else "Não",
                    "Proxy de": px or "—",
                    "Schema.org": ext or "—",
                    "Curadoria": v.status_label,
                }
            )
        st.dataframe(pd.DataFrame(rows), width="stretch", hide_index=True)

        selected_id = st.selectbox(
            "Inspecionar ficha completa da variável:",
            options=[v.id for v in filtered],
            format_func=lambda vid: f"{vars_by_id[vid].label} ({vid})",
        )
        v = vars_by_id[selected_id]
        st.markdown(f"### {v.label}")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Governança", v.nivel_label.replace("Demanda de Governança ", ""))
        m2.metric("Dado Sensível", "Sim" if v.sensivel else "Não")
        m3.metric("Papel de Proxy", f"{len(v.proxy_de)} ligação(ões)" if v.proxy_de else "Não")
        m4.metric("Curadoria", "Auditada" if v.status_curadoria == "Status_Auditada" else "Pendente")

        if v.derivada_de:
            st.info("**Derivada de:** " + ", ".join(vars_by_id[d].label if d in vars_by_id else d for d in v.derivada_de))
            for al in service.trace_inherited_alerts(v.id, vars_by_id):
                st.warning(al)

        if v.proxy_de:
            st.warning(
                "**Atua como Proxy de:** "
                + ", ".join(vars_by_id[p].label if p in vars_by_id else p for p in v.proxy_de)
            )

        with st.expander("Lastro Semântico no Schema.org e Bases Legais", expanded=True):
            st.write("**Bases Legais:**", ", ".join(v.bases_legais_labels) if v.bases_legais_labels else "—")
            for curie in v.conceitos_equivalentes:
                c_obj = concepts_by_curie.get(curie)
                desc = f" — *{c_obj.comment}*" if c_obj and c_obj.comment else ""
                st.markdown(f"- **Equivalente a** `{curie}` ([link]({c_obj.uri if c_obj else '#'})){desc}")
            for curie in v.conceitos_baseados:
                c_obj = concepts_by_curie.get(curie)
                desc = f" — *{c_obj.comment}*" if c_obj and c_obj.comment else ""
                st.markdown(f"- **Baseada em** `{curie}` ([link]({c_obj.uri if c_obj else '#'})){desc}")

        with st.expander("Parecer Jurídico e de Governança (7 Dimensões)", expanded=True):
            for key, _, title in DESC_FIELDS:
                val = v.descricoes.get(key, "")
                st.markdown(f"**{title}:** {val if val else '—'}")
    else:
        c1, c2 = st.columns([2.5, 1])
        q_ext = c1.text_input("Buscar conceito no índice Schema.org", placeholder="Ex.: MonetaryAmount, birthDate, Loan...")
        tipo_ext = c2.selectbox("Tipo de termo", ["Todos", "Classe", "Propriedade", "Enumeração"])

        usage_map: Dict[str, List[str]] = {}
        for v in variables:
            for c in v.conceitos_equivalentes + v.conceitos_baseados:
                usage_map.setdefault(c, []).append(v.label)

        ext_filtered = []
        qx = q_ext.strip().lower()
        for c in concepts:
            if tipo_ext != "Todos" and c.tipo != tipo_ext:
                continue
            if qx and qx not in f"{c.curie} {c.label} {c.comment} {c.contexto}".lower():
                continue
            ext_filtered.append(c)

        st.caption(f"Exibindo {len(ext_filtered)} de {len(concepts)} conceitos extraídos do Schema.org.")
        ext_rows = [
            {
                "CURIE": c.curie,
                "Tipo": c.tipo,
                "Contexto": c.contexto or "—",
                "Descrição": c.comment[:140] + ("..." if len(c.comment) > 140 else ""),
                "Variáveis MyOnt": ", ".join(usage_map.get(c.curie, [])) or "—",
            }
            for c in ext_filtered
        ]
        st.dataframe(pd.DataFrame(ext_rows), width="stretch", hide_index=True)


def render_authoring_tab(
    service: OntologyService,
    variables: List[VariavelRecord],
    vars_by_id: Dict[str, VariavelRecord],
    concepts: List[ConceitoExterno],
) -> None:
    st.subheader("Cadastrar / Derivar Variável e Curadoria Jurídica")
    mode = st.radio(
        "Operação",
        ["Cadastrar Nova Variável (UC-03 / UC-04)", "Editar / Auditar Variável Existente (UC-01)"],
        horizontal=True,
    )

    bases_vocab = service.get_controlled_vocabulary(MYONT.BaseLegal)
    gov_vocab = service.get_controlled_vocabulary(MYONT.NivelDemandaGovernanca)
    status_vocab = service.get_controlled_vocabulary(MYONT.StatusCuradoria)
    concept_curies = [c.curie for c in concepts]
    concept_labels = {c.curie: f"{c.curie} ({c.tipo}) — {c.comment[:70]}" for c in concepts}
    var_ids = [v.id for v in variables]

    if mode.startswith("Cadastrar"):
        st.markdown("Crie uma variável baseada em um conceito do Schema.org, derivada de variáveis existentes ou totalmente nova.")
        with st.form("create_var_form"):
            c1, c2 = st.columns([2, 1])
            nome_var = c1.text_input("Nome da Variável *", placeholder="Ex.: Renda Per Capita Familiar")
            sensivel = c2.checkbox("Variável Sensível / Protegida (LGPD / CF)")

            c3, c4 = st.columns(2)
            eq_sel = c3.multiselect(
                "Equivalente a Conceito(s) Schema.org",
                options=concept_curies,
                format_func=lambda k: concept_labels[k],
            )
            base_sel = c4.multiselect(
                "Baseada em Conceito(s) Schema.org",
                options=concept_curies,
                format_func=lambda k: concept_labels[k],
            )

            c5, c6 = st.columns(2)
            deriv_sel = c5.multiselect(
                "Derivada de Variáveis Existentes (Feature Engineering)",
                options=var_ids,
                format_func=lambda vid: f"{vars_by_id[vid].label} ({vid})",
            )
            proxy_sel = c6.multiselect(
                "Atua como Proxy de",
                options=var_ids,
                format_func=lambda vid: f"{vars_by_id[vid].label} ({vid})",
            )

            c7, c8, c9 = st.columns(3)
            status_id = c7.selectbox(
                "Status de Curadoria",
                options=list(status_vocab.keys()),
                index=list(status_vocab.keys()).index("Status_PendenteRevisaoJuridica")
                if "Status_PendenteRevisaoJuridica" in status_vocab
                else 0,
                format_func=lambda k: status_vocab[k],
            )
            gov_id = c8.selectbox(
                "Nível de Demanda de Governança",
                options=list(gov_vocab.keys()),
                format_func=lambda k: gov_vocab[k],
            )
            bases_sel = c9.multiselect(
                "Bases Legais Aplicáveis",
                options=list(bases_vocab.keys()),
                format_func=lambda k: bases_vocab[k],
            )

            st.markdown("#### Anotações Jurídicas / Técnicas (Opcionais se pendente)")
            descs: Dict[str, str] = {}
            for key, _, title in DESC_FIELDS:
                descs[key] = st.text_area(title, key=f"new_{key}", height=68)

            submitted = st.form_submit_button("Salvar Variável na Ontologia", type="primary")
            if submitted:
                if not nome_var.strip():
                    st.error("Informe o nome da variável.")
                else:
                    var_id = sanitize_identifier(nome_var)
                    if var_id in vars_by_id:
                        st.error(f"Já existe uma variável com ID `{var_id}`. Use a aba de edição ou outro nome.")
                    else:
                        service.save_custom_variable(
                            var_id=var_id,
                            label=nome_var.strip(),
                            sensivel=sensivel,
                            status_id=status_id,
                            nivel_id=gov_id,
                            bases_ids=bases_sel,
                            equivalente_curies=eq_sel,
                            baseada_curies=base_sel,
                            proxy_ids=proxy_sel,
                            derivada_ids=deriv_sel,
                            descricoes=descs,
                        )
                        st.success(f"Variável `{nome_var.strip()}` (`myont:{var_id}`) salva em `data/variaveis_custom.ttl`!")
                        st.rerun()
    else:
        ordered_ids = sorted(
            var_ids,
            key=lambda vid: (0 if vars_by_id[vid].status_curadoria != "Status_Auditada" else 1, vars_by_id[vid].label.lower()),
        )
        target_id = st.selectbox(
            "Selecione a variável para curadoria/edição:",
            options=ordered_ids,
            format_func=lambda vid: f"[{vars_by_id[vid].status_label}] {vars_by_id[vid].label} ({vid})",
        )
        cur = vars_by_id[target_id]

        with st.form("edit_var_form"):
            c1, c2 = st.columns([2, 1])
            edit_label = c1.text_input("Rótulo da Variável", value=cur.label)
            edit_sens = c2.checkbox("Variável Sensível / Protegida", value=cur.sensivel)

            c3, c4 = st.columns(2)
            eq_cur = [c for c in cur.conceitos_equivalentes if c in concept_curies]
            base_cur = [c for c in cur.conceitos_baseados if c in concept_curies]
            edit_eq = c3.multiselect(
                "Equivalente a Schema.org",
                options=concept_curies,
                default=eq_cur,
                format_func=lambda k: concept_labels[k],
            )
            edit_base = c4.multiselect(
                "Baseada em Schema.org",
                options=concept_curies,
                default=base_cur,
                format_func=lambda k: concept_labels[k],
            )

            other_ids = [vid for vid in var_ids if vid != target_id]
            c5, c6 = st.columns(2)
            edit_deriv = c5.multiselect(
                "Derivada de",
                options=other_ids,
                default=[d for d in cur.derivada_de if d in other_ids],
                format_func=lambda vid: f"{vars_by_id[vid].label} ({vid})",
            )
            edit_proxy = c6.multiselect(
                "Atua como Proxy de",
                options=other_ids,
                default=[p for p in cur.proxy_de if p in other_ids],
                format_func=lambda vid: f"{vars_by_id[vid].label} ({vid})",
            )

            c7, c8, c9 = st.columns(3)
            status_keys = list(status_vocab.keys())
            gov_keys = list(gov_vocab.keys())
            edit_status = c7.selectbox(
                "Status de Curadoria",
                options=status_keys,
                index=status_keys.index(cur.status_curadoria) if cur.status_curadoria in status_keys else 0,
                format_func=lambda k: status_vocab[k],
            )
            edit_gov = c8.selectbox(
                "Nível de Governança",
                options=gov_keys,
                index=gov_keys.index(cur.nivel_governanca) if cur.nivel_governanca in gov_keys else 0,
                format_func=lambda k: gov_vocab[k],
            )
            edit_bases = c9.multiselect(
                "Bases Legais",
                options=list(bases_vocab.keys()),
                default=[b for b in cur.bases_legais if b in bases_vocab],
                format_func=lambda k: bases_vocab[k],
            )

            edit_descs: Dict[str, str] = {}
            for key, _, title in DESC_FIELDS:
                edit_descs[key] = st.text_area(
                    title, value=cur.descricoes.get(key, ""), key=f"edit_{target_id}_{key}", height=68
                )

            if st.form_submit_button("Atualizar Parecer e Salvar", type="primary"):
                service.save_custom_variable(
                    var_id=target_id,
                    label=edit_label.strip() or cur.label,
                    sensivel=edit_sens,
                    status_id=edit_status,
                    nivel_id=edit_gov,
                    bases_ids=edit_bases,
                    equivalente_curies=edit_eq,
                    baseada_curies=edit_base,
                    proxy_ids=edit_proxy,
                    derivada_ids=edit_deriv,
                    descricoes=edit_descs,
                )
                st.success(f"Variável `{target_id}` atualizada!")
                st.rerun()


def render_report_tab(
    service: OntologyService,
    variables: List[VariavelRecord],
    vars_by_id: Dict[str, VariavelRecord],
) -> None:
    st.subheader("Seleção de Features e Relatório Preventivo Consolidado (UC-05)")
    c1, c2 = st.columns([2, 1])
    model_name = c1.text_input("Nome do Modelo / Projeto de Crédito", value="Modelo Score Crédito PF — V1")
    uploaded = c2.file_uploader("Opcional: subir CSV do dataset (cabeçalho)", type=["csv"])

    matched_from_csv: List[str] = []
    unmatched_cols: List[str] = []
    if uploaded is not None:
        df_head = pd.read_csv(uploaded, nrows=1)
        lookup: Dict[str, str] = {}
        for v in variables:
            lookup[v.id.lower()] = v.id
            lookup[v.label.lower()] = v.id
            lookup[sanitize_identifier(v.label).lower()] = v.id
        for col in df_head.columns:
            norm = str(col).strip().lower()
            norm_sanitized = sanitize_identifier(str(col)).lower()
            vid = lookup.get(norm) or lookup.get(norm_sanitized)
            if vid and vid not in matched_from_csv:
                matched_from_csv.append(vid)
            elif not vid:
                unmatched_cols.append(str(col))

        if unmatched_cols:
            st.warning(
                "Colunas do CSV sem correspondência automática no catálogo (podem ser cadastradas na aba anterior): "
                + ", ".join(f"`{c}`" for c in unmatched_cols)
            )

    default_selection = matched_from_csv if matched_from_csv else [
        vid for vid in ("Income", "HomeOwnership", "Age", "Gender", "GeographicalLocations") if vid in vars_by_id
    ]
    selected_ids = st.multiselect(
        "Selecione as variáveis (features) que compõem o modelo:",
        options=[v.id for v in variables],
        default=default_selection,
        format_func=lambda vid: f"{vars_by_id[vid].label} — {vars_by_id[vid].nivel_label}",
    )

    if not selected_ids:
        st.info("Selecione ao menos uma variável para gerar o relatório consolidado.")
        return

    selected_vars = [vars_by_id[vid] for vid in selected_ids]

    vetos = sum(1 for v in selected_vars if v.nivel_governanca in {"Governanca_Veto", "Governanca_Maxima"})
    sensiveis = sum(1 for v in selected_vars if v.sensivel)
    proxies = sum(1 for v in selected_vars if v.is_proxy)
    pendentes = sum(1 for v in selected_vars if v.status_curadoria != "Status_Auditada")

    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Features Selecionadas", len(selected_vars))
    k2.metric("Veto / Máxima", vetos)
    k3.metric("Sensíveis", sensiveis)
    k4.metric("Atuam como Proxy", proxies)
    k5.metric("Pendentes Jurídico", pendentes)

    summary_rows = []
    for v in selected_vars:
        inherited = service.trace_inherited_alerts(v.id, vars_by_id)
        summary_rows.append(
            {
                "Variável": v.label,
                "Governança": v.nivel_label,
                "Curadoria": v.status_label,
                "Sensível": "Sim" if v.sensivel else "Não",
                "Proxy de": ", ".join(vars_by_id[p].label if p in vars_by_id else p for p in v.proxy_de) or "—",
                "Schema.org": ", ".join(v.conceitos_equivalentes + v.conceitos_baseados) or "—",
                "Alertas Derivação": len(inherited),
            }
        )
    summary_df = pd.DataFrame(summary_rows)
    st.dataframe(summary_df, width="stretch", hide_index=True)

    md_report = build_markdown_report(selected_vars, vars_by_id, unmatched_cols, service, model_name)

    d1, d2 = st.columns(2)
    d1.download_button(
        "Baixar Relatório Consolidado (.md)",
        data=md_report.encode("utf-8"),
        file_name="relatorio_governanca_v1.md",
        mime="text/markdown",
        type="primary",
    )
    d2.download_button(
        "Baixar Tabela Resumo (.csv)",
        data=summary_df.to_csv(index=False).encode("utf-8"),
        file_name="resumo_governanca_v1.csv",
        mime="text/csv",
    )

    with st.expander("Pré-visualização do Relatório Consolidado", expanded=True):
        st.markdown(md_report)


def main() -> None:
    service = get_service()
    variables = service.list_variables()
    vars_by_id = {v.id: v for v in variables}
    concepts = service.list_external_concepts()
    concepts_by_curie = {c.curie: c for c in concepts}

    st.title("⚖️ MyOnt V1 — Governança Algorítmica Preventiva")
    st.caption(
        "Ponte semântica entre Direito e Ciência de Dados para modelos de crédito "
        "(RDF/OWL + Schema.org)."
    )

    with st.sidebar:
        st.header("Estado do Grafo RDF")
        st.metric("Variáveis Catalogadas", len(variables))
        st.metric("Conceitos Schema.org", len(concepts))
        st.metric("Variáveis Sensíveis", sum(1 for v in variables if v.sensivel))
        st.metric("Variáveis Proxy", sum(1 for v in variables if v.is_proxy))
        st.metric(
            "Pendentes de Revisão",
            sum(1 for v in variables if v.status_curadoria != "Status_Auditada"),
        )
        if st.button("Recarregar Grafo (.ttl)"):
            service.reload()
            st.rerun()

    tab1, tab2, tab3 = st.tabs(
        [
            "📚 Catálogo & Schema.org",
            "✍️ Cadastrar / Auditar Variável",
            "📋 Relatório Preventivo V1",
        ]
    )

    with tab1:
        render_catalog_tab(service, variables, vars_by_id, concepts, concepts_by_curie)
    with tab2:
        render_authoring_tab(service, variables, vars_by_id, concepts)
    with tab3:
        render_report_tab(service, variables, vars_by_id)


if __name__ == "__main__":
    main()
