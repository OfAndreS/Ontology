"""Geração de PDF do Relatório Preventivo no layout visual do Manual de Governança."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime
import io
import math
from typing import Dict, List, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from app.models import CategoryRead, ReportResponse, VariableRead

PAGE_W, PAGE_H = A4  # 595.27 x 841.89 pt

# Paleta fiel ao Manual_Governança.pdf
NAVY = colors.HexColor("#061138")
ORANGE = colors.HexColor("#EF6B10")
ORANGE_LIGHT = colors.HexColor("#F58A3E")
ROYAL = colors.HexColor("#0018A8")
GOLD = colors.HexColor("#DCA000")
OCHRE = colors.HexColor("#9E6B00")
GREEN_DARK = colors.HexColor("#0B531C")
GREEN_BADGE = colors.HexColor("#0E6B22")
WHITE = colors.HexColor("#FFFFFF")
TEXT_DARK = colors.HexColor("#18181B")
TEXT_MUTED = colors.HexColor("#71717A")
RULE_GRAY = colors.HexColor("#E4E4E7")
ROW_ALT = colors.HexColor("#F4F4F6")
EQUITY_BG = colors.HexColor("#EEF2FB")

STATUS_STYLES: Dict[str, Tuple[colors.Color, colors.Color]] = {
    "APROVADO": (colors.HexColor("#DCFCE7"), colors.HexColor("#15803D")),
    "RESTRITO": (colors.HexColor("#FEF3C7"), colors.HexColor("#92400E")),
    "ADAPTADO": (colors.HexColor("#FEF3C7"), colors.HexColor("#92400E")),
    "VETADO": (colors.HexColor("#FEE2E2"), colors.HexColor("#B91C1C")),
}

DEFAULT_CATEGORY_DESCRIPTIONS: Dict[str, str] = {
    "Institucional e Financeiro": "O núcleo do modelo de risco: variáveis com nexo causal direto e comprovado com a capacidade de pagamento.",
    "Financeiro Corporativo (PJ)": "Indicadores contábeis e financeiros corporativos voltados à avaliação de solvência de pessoa jurídica.",
    "Socioeconômico": "Variáveis legítimas em tese, mas que exigem cautela para evitar reconstrução indireta de classe ou renda informal.",
    "Demográfico": "Atributos pessoais e territoriais com alto potencial de atuar como proxy de grupos protegidos.",
    "Educacional": "Indicadores de escolaridade e formação acadêmica que demandam calibração contra viés socioeconômico.",
    "Valores, Atitudes e Comportamento": "Dados derivados de hábitos e comportamento financeiro: úteis estatisticamente, mas com nexo causal sensível.",
    "Situacional": "Eventos de vida e contextos temporários que exigem revisão humana e proteção contra penalização crônica.",
    "Personalidade": "Atributos psicométricos e comportamentais com elevado risco de medicalização ou discriminação indireta.",
    "Saúde": "Dados clínicos e de saúde física ou mental protegidos por vedação legal estrita contra discriminação.",
    "Dados Alternativos": "Pegada digital, redes sociais e metadados de dispositivo com forte risco de redlining digital.",
    "Macroeconômico": "Variáveis conjunturais e setoriais externas ao indivíduo para ajuste de cenário econômico.",
}

DEFAULT_CONFORMITY_GOALS: List[Tuple[str, str]] = [
    (
        "ART. 20 · LGPD",
        "Explicar substitui recusar sem explicação. Toda negativa ou revisão de crédito precisa fazer sentido para o titular e permitir contestação.",
    ),
    (
        "RES. BCB 303 · CMN 4.966",
        "Se a auditoria e o Banco Central não conseguem rastrear e auditar a variável, ela não entra no núcleo decisório do modelo.",
    ),
    (
        "CDC 54-D · LEI 14.181",
        "Avaliar capacidade de pagamento de forma responsável é dever legal. Prevenir o superendividamento faz parte da governança do modelo.",
    ),
    (
        "ART. 6, IX · LGPD",
        "Proxy também é discriminação: variável neutra na forma, mas discriminatória no efeito estatístico, exige mitigação ou veto.",
    ),
]


def _latin1_safe(text: str) -> str:
    """Garante compatibilidade com fontes padrão WinAnsi/Latin-1 do ReportLab."""
    if not text:
        return ""
    replacements = {
        "\u2192": "->",
        "\u2190": "<-",
        "\u2291": "<=",
        "\u2013": "-",
        "\u2014": " - ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u2022": "·",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def classify_variable_status(v: VariableRead) -> str:
    if v.nivel_risco_maximo == "Risco_Veto":
        return "VETADO"
    if v.derivada_de and v.nivel_risco_maximo in ("Risco_Baixo", "Risco_Medio"):
        return "ADAPTADO"
    if (
        v.nivel_risco_maximo in ("Risco_Maximo", "Risco_Alto", "Risco_Medio")
        or v.sensivel
        or v.is_proxy
    ):
        return "RESTRITO"
    return "APROVADO"


def format_variable_legal_basis(v: VariableRead) -> str:
    bases: List[str] = []
    for b in v.bases_autorizadoras_labels:
        if b and b not in bases:
            bases.append(b)
    for b in v.bases_restringidas_labels:
        if b and b not in bases:
            bases.append(b)
    if bases:
        return "; ".join(bases[:4])
    if v.descricoes.justificativa_legal:
        return v.descricoes.justificativa_legal.strip()
    return "Análise jurídica pendente"


def format_variable_proxy_and_risk(v: VariableRead, labels_by_id: Dict[str, str]) -> str:
    parts: List[str] = []
    if v.proxy_de:
        targets = ", ".join(labels_by_id.get(pid, pid) for pid in v.proxy_de)
        parts.append(f"Proxy de: {targets}.")
    if v.descricoes.atuacao_proxy:
        parts.append(v.descricoes.atuacao_proxy.strip())
    if v.riscos:
        for r in v.riscos[:2]:
            desc = r.descricao.strip().rstrip(".")
            if r.demanda_governanca:
                dem = r.demanda_governanca.strip().rstrip(".")
                parts.append(f"{desc} ({dem}).")
            else:
                parts.append(f"{desc}.")
    elif v.descricoes.justificativa_legal and not parts:
        parts.append(v.descricoes.justificativa_legal.strip())

    if v.inherited_alerts:
        parts.append(v.inherited_alerts[0].strip())

    text = " ".join(parts).strip()
    if not text:
        return "Baixo risco identificado; uso permitido conforme governança padrão."
    return text


def _draw_wave_pattern(c: canvas.Canvas, stroke_color: colors.Color, alpha: float = 0.14) -> None:
    c.saveState()
    try:
        c.setStrokeAlpha(alpha)
    except Exception:
        pass
    c.setStrokeColor(stroke_color)
    c.setLineWidth(0.7)
    step_y = 28
    seg_w = 72
    for y in range(20, int(PAGE_H) + 40, step_y):
        p = c.beginPath()
        p.moveTo(-20, y)
        x = -20
        while x < PAGE_W + seg_w:
            p.curveTo(x + seg_w * 0.33, y + 9, x + seg_w * 0.66, y - 9, x + seg_w, y)
            x += seg_w
        c.drawPath(p, stroke=1, fill=0)
    c.restoreState()


def _draw_page_header_footer(
    c: canvas.Canvas,
    page_num: int,
    total_pages: int,
    model_name: str,
) -> None:
    c.saveState()
    # Header pill ICTi
    c.setFillColor(ORANGE)
    c.roundRect(44, PAGE_H - 42, 38, 18, 9, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(63, PAGE_H - 36, "ICTi")

    # Header right label
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawRightString(
        PAGE_W - 44,
        PAGE_H - 35,
        _latin1_safe("DOCUMENTO INTERNO · GOVERNANÇA DE IA"),
    )

    # Footer line & labels
    c.setStrokeColor(RULE_GRAY)
    c.setLineWidth(0.6)
    c.line(44, 42, PAGE_W - 44, 42)

    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica", 7.5)
    footer_left = f"Manual de Processos e Métricas de Governança de IA em Crédito · {model_name}"
    c.drawString(44, 27, _latin1_safe(footer_left[:85]))
    c.drawRightString(PAGE_W - 44, 27, _latin1_safe(f"Página {page_num} de {total_pages}"))
    c.restoreState()


def _draw_cover_page(c: canvas.Canvas, report: ReportResponse, model_name: str) -> None:
    c.saveState()
    # Fundo azul marinho
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    _draw_wave_pattern(c, colors.HexColor("#273875"), alpha=0.25)

    # Elementos geométricos da capa
    # Círculo laranja à esquerda
    c.setFillColor(ORANGE)
    c.circle(-8, PAGE_H * 0.69, 74, stroke=0, fill=1)

    # Pílula laranja + círculo azul royal no topo direito
    c.setFillColor(ORANGE)
    c.roundRect(PAGE_W - 96, PAGE_H - 44, 110, 22, 11, stroke=0, fill=1)
    c.setFillColor(ROYAL)
    c.circle(PAGE_W - 22, PAGE_H - 115, 42, stroke=0, fill=1)

    # Pílula laranja + círculo dourado na parte inferior direita
    c.setFillColor(ORANGE)
    c.roundRect(PAGE_W - 118, 178, 68, 22, 11, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.circle(PAGE_W - 76, 150, 27, stroke=0, fill=1)

    # Tag superior com espaçamento
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(
        56,
        PAGE_H - 210,
        _latin1_safe("G O V E R N A N Ç A   &   A U D I T O R I A   A L G O R Í T M I C A"),
    )

    # Título principal
    c.setFont("Helvetica-Bold", 28)
    c.drawString(56, PAGE_H - 258, _latin1_safe("Matriz de Variáveis,"))
    c.drawString(56, PAGE_H - 294, _latin1_safe("Proxies e Base Legal em"))
    c.drawString(56, PAGE_H - 330, _latin1_safe("Crédito"))

    # Subtítulo + Nome do Modelo
    c.setFont("Helvetica", 12)
    c.setFillColor(colors.HexColor("#DCE3F7"))
    c.drawString(
        56,
        PAGE_H - 372,
        _latin1_safe("Como decidimos quais dados entram e quais"),
    )
    c.drawString(
        56,
        PAGE_H - 390,
        _latin1_safe("nunca entram nos modelos de crédito."),
    )

    # Linha divisória
    c.setStrokeColor(colors.HexColor("#4B598B"))
    c.setLineWidth(0.8)
    c.line(56, PAGE_H - 425, PAGE_W - 155, PAGE_H - 425)

    # Descrição + metadados do relatório gerado
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(
        56,
        PAGE_H - 458,
        _latin1_safe("Guia de referência sobre variáveis, proxies de discriminação"),
    )
    c.drawString(
        56,
        PAGE_H - 472,
        _latin1_safe("indireta e a legislação que rege seu uso em modelos de risco"),
    )
    c.drawString(56, PAGE_H - 486, _latin1_safe("de crédito."))

    # Card resumo do modelo avaliado
    c.setFillColor(colors.HexColor("#0D1D56"))
    c.roundRect(56, PAGE_H - 585, PAGE_W - 210, 74, 8, stroke=0, fill=1)
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(70, PAGE_H - 530, _latin1_safe(f"MODELO AVALIADO: {model_name.upper()}"))
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 8.5)
    s = report.summary
    c.drawString(
        70,
        PAGE_H - 548,
        _latin1_safe(
            f"{s.total} variáveis selecionadas  ·  {s.total_riscos} riscos mapeados  ·  {s.vetos_or_maxima} veto/máximo"
        ),
    )
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    c.setFillColor(colors.HexColor("#B5C0E0"))
    c.setFont("Helvetica", 7.8)
    c.drawString(
        70,
        PAGE_H - 566,
        _latin1_safe(
            f"Proxies identificados: {s.proxies}  ·  Sensíveis: {s.sensiveis}  ·  Emitido em {now_str}"
        ),
    )

    # Badge inferior esquerdo
    c.setFillColor(WHITE)
    c.roundRect(56, 62, 52, 24, 12, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(82, 70, "ICTi")
    c.restoreState()


def _draw_toc_page(
    c: canvas.Canvas,
    part1_entries: List[Tuple[int, str, int]],
    part2_entries: List[Tuple[int, str, int]],
    total_pages: int,
    model_name: str,
) -> None:
    _draw_page_header_footer(c, 2, total_pages, model_name)
    c.saveState()

    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(44, PAGE_H - 118, _latin1_safe("S U M Á R I O"))

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 21)
    c.drawString(44, PAGE_H - 150, _latin1_safe("O que você vai encontrar aqui"))

    y = PAGE_H - 210
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Bold", 7.8)
    c.drawString(44, y, _latin1_safe("PARTE I · A MATRIZ, VARIÁVEL A VARIÁVEL"))
    y -= 28

    for idx, title, pg in part1_entries:
        c.setFillColor(ORANGE)
        c.roundRect(44, y - 5, 19, 19, 5, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawCentredString(53.5, y + 1, str(idx))

        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(78, y + 1, _latin1_safe(title))

        c.setFillColor(TEXT_MUTED)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawRightString(PAGE_W - 44, y + 1, f"{pg:02d}")

        c.setStrokeColor(RULE_GRAY)
        c.setLineWidth(0.5)
        c.line(44, y - 13, PAGE_W - 44, y - 13)
        y -= 34

    y -= 16
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Bold", 7.8)
    c.drawString(44, y, _latin1_safe("PARTE II · FUNDAMENTAÇÃO LEGAL E AUDITORIA TÉCNICA"))
    y -= 28

    for idx, title, pg in part2_entries:
        c.setFillColor(GREEN_BADGE)
        c.roundRect(44, y - 5, 19, 19, 5, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawCentredString(53.5, y + 1, str(idx))

        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(78, y + 1, _latin1_safe(title))

        c.setFillColor(TEXT_MUTED)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawRightString(PAGE_W - 44, y + 1, f"{pg:02d}")

        c.setStrokeColor(RULE_GRAY)
        c.setLineWidth(0.5)
        c.line(44, y - 13, PAGE_W - 44, y - 13)
        y -= 34

    c.restoreState()


def _draw_section_divider(
    c: canvas.Canvas,
    bg_color: colors.Color,
    roman: str,
    part_label: str,
    title_lines: List[str],
    subtitle_lines: List[str],
    accent_circle_color: colors.Color,
    accent_left: bool = True,
) -> None:
    c.saveState()
    c.setFillColor(bg_color)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    _draw_wave_pattern(c, WHITE, alpha=0.12)

    # Círculo translúcido no canto superior
    c.saveState()
    try:
        c.setFillAlpha(0.16)
    except Exception:
        pass
    c.setFillColor(WHITE)
    if accent_left:
        c.circle(PAGE_W - 15, PAGE_H - 15, 86, stroke=0, fill=1)
    else:
        c.circle(25, PAGE_H - 25, 86, stroke=0, fill=1)
    c.restoreState()

    # Badge romano no canto superior direito
    c.saveState()
    try:
        c.setFillAlpha(0.22)
    except Exception:
        pass
    c.setFillColor(WHITE)
    c.roundRect(PAGE_W - 96, PAGE_H - 102, 42, 44, 12, stroke=0, fill=1)
    c.restoreState()

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(PAGE_W - 75, PAGE_H - 85, roman)

    # Label da Parte
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(56, PAGE_H - 270, _latin1_safe(part_label))

    # Título grande
    y = PAGE_H - 320
    c.setFont("Helvetica-Bold", 28)
    for line in title_lines:
        c.drawString(56, y, _latin1_safe(line))
        y -= 34

    # Subtítulo
    y -= 6
    c.setFont("Helvetica", 10.5)
    for line in subtitle_lines:
        c.drawString(56, y, _latin1_safe(line))
        y -= 16

    # Círculo de destaque inferior
    c.setFillColor(accent_circle_color)
    if accent_left:
        c.circle(106, 152, 22, stroke=0, fill=1)
    else:
        c.circle(PAGE_W - 118, 152, 25, stroke=0, fill=1)

    c.restoreState()


def _measure_variable_row(
    v: VariableRead,
    labels_by_id: Dict[str, str],
) -> Tuple[List[str], str, List[str], List[str], float]:
    var_lines = simpleSplit(_latin1_safe(v.label), "Helvetica", 8.5, 112)
    status = classify_variable_status(v)
    legal_text = _latin1_safe(format_variable_legal_basis(v))
    legal_lines = simpleSplit(legal_text, "Helvetica", 8.2, 102) or ["-"]
    proxy_text = _latin1_safe(format_variable_proxy_and_risk(v, labels_by_id))
    proxy_lines = simpleSplit(proxy_text, "Helvetica", 8.2, 185) or ["-"]

    max_lines = max(len(var_lines), len(legal_lines), len(proxy_lines), 1)
    row_h = max(36.0, max_lines * 11.5 + 16.0)
    return var_lines, status, legal_lines, proxy_lines, row_h


def _paginate_category_variables(
    variables: List[VariableRead],
    labels_by_id: Dict[str, str],
) -> List[List[VariableRead]]:
    """Divide variáveis de uma categoria em páginas para nunca estourar a área útil A4."""
    max_table_h = 540.0
    pages: List[List[VariableRead]] = []
    current: List[VariableRead] = []
    used_h = 0.0

    for v in variables:
        _, _, _, _, row_h = _measure_variable_row(v, labels_by_id)
        if current and (used_h + row_h > max_table_h):
            pages.append(current)
            current = [v]
            used_h = row_h
        else:
            current.append(v)
            used_h += row_h

    if current:
        pages.append(current)
    return pages


def _draw_category_table_page(
    c: canvas.Canvas,
    page_num: int,
    total_pages: int,
    model_name: str,
    section_num: int,
    category_title: str,
    category_desc: str,
    variables: List[VariableRead],
    labels_by_id: Dict[str, str],
    is_continuation: bool = False,
) -> None:
    _draw_page_header_footer(c, page_num, total_pages, model_name)
    c.saveState()

    # Badge numérico azul-marinho + Título da Categoria
    c.setFillColor(NAVY)
    c.roundRect(44, PAGE_H - 122, 18, 18, 5, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(53, PAGE_H - 116, str(section_num))

    title_display = f"{category_title} (continuação)" if is_continuation else category_title
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(68, PAGE_H - 118, _latin1_safe(title_display))

    # Descrição da categoria
    desc_lines = simpleSplit(_latin1_safe(category_desc), "Helvetica", 9.2, PAGE_W - 112)
    y = PAGE_H - 136
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica", 9.2)
    for line in desc_lines[:2]:
        c.drawString(68, y, line)
        y -= 13

    # Cabeçalho da Tabela
    table_x = 68
    table_w = PAGE_W - 112  # 483 pt
    col_var_x = table_x + 10
    col_status_x = table_x + 128
    col_legal_x = table_x + 200
    col_proxy_x = table_x + 310

    header_top = y - 12
    header_h = 26
    c.setFillColor(NAVY)
    c.rect(table_x, header_top - header_h, table_w, header_h, stroke=0, fill=1)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(col_var_x, header_top - 16, _latin1_safe("VARIÁVEL"))
    c.drawString(col_status_x, header_top - 16, _latin1_safe("STATUS"))
    c.drawString(col_legal_x, header_top - 16, _latin1_safe("BASE LEGAL"))
    c.drawString(col_proxy_x, header_top - 16, _latin1_safe("ATUAÇÃO COMO PROXY / RISCO"))

    row_y = header_top - header_h
    for idx, v in enumerate(variables):
        var_lines, status, legal_lines, proxy_lines, row_h = _measure_variable_row(v, labels_by_id)
        if idx % 2 == 1:
            c.setFillColor(ROW_ALT)
            c.rect(table_x, row_y - row_h, table_w, row_h, stroke=0, fill=1)

        text_top = row_y - 14

        # Coluna 1: Variável
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 8.5)
        for i, line in enumerate(var_lines):
            c.drawString(col_var_x, text_top - i * 11.2, line)

        # Coluna 2: Status pill
        bg_pill, fg_pill = STATUS_STYLES.get(status, STATUS_STYLES["RESTRITO"])
        pill_w = 54
        pill_h = 14
        pill_y = row_y - 21
        c.setFillColor(bg_pill)
        c.roundRect(col_status_x, pill_y, pill_w, pill_h, 7, stroke=0, fill=1)
        c.setFillColor(fg_pill)
        c.setFont("Helvetica-Bold", 6.3)
        c.drawCentredString(col_status_x + pill_w / 2.0, pill_y + 4.3, status)

        # Coluna 3: Base Legal
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 8.2)
        for i, line in enumerate(legal_lines):
            c.drawString(col_legal_x, text_top - i * 11.2, line)

        # Coluna 4: Atuação como Proxy / Risco
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 8.2)
        for i, line in enumerate(proxy_lines):
            c.drawString(col_proxy_x, text_top - i * 11.2, line)

        row_y -= row_h

    # Linha final da tabela
    c.setStrokeColor(RULE_GRAY)
    c.setLineWidth(0.6)
    c.line(table_x, row_y, table_x + table_w, row_y)

    c.restoreState()


def _extract_conformity_goals(variables: List[VariableRead]) -> List[Tuple[str, str]]:
    """Extrai metas/demandas reais das variáveis selecionadas e complementa com as metas regulatórias."""
    dynamic_goals: List[Tuple[str, str]] = []
    seen_tabs = set()

    for v in variables:
        for r in v.riscos:
            base_label = (
                r.bases_acionadas_labels[0]
                if r.bases_acionadas_labels
                else (v.bases_autorizadoras_labels[0] if v.bases_autorizadoras_labels else v.label)
            )
            tab = base_label.upper()[:28]
            body = (r.demanda_governanca or r.implicacao_legal or r.descricao).strip()
            if body and tab not in seen_tabs:
                seen_tabs.add(tab)
                dynamic_goals.append((tab, f"{v.label}: {body}"))
            if len(dynamic_goals) >= 4:
                break
        if len(dynamic_goals) >= 4:
            break

    for tab, body in DEFAULT_CONFORMITY_GOALS:
        if len(dynamic_goals) >= 4:
            break
        if tab not in seen_tabs:
            dynamic_goals.append((tab, body))

    return dynamic_goals[:4]


def _draw_conformity_and_equity_page(
    c: canvas.Canvas,
    page_num: int,
    total_pages: int,
    model_name: str,
    sec_conformity_num: int,
    sec_equity_num: int,
    variables: List[VariableRead],
) -> None:
    _draw_page_header_footer(c, page_num, total_pages, model_name)
    c.saveState()

    # Seção: Metas de Conformidade Regulatória
    c.setFillColor(NAVY)
    c.roundRect(44, PAGE_H - 122, 18, 18, 5, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(53, PAGE_H - 116, str(sec_conformity_num))

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(68, PAGE_H - 118, _latin1_safe("Metas de Conformidade Regulatória"))

    goals = _extract_conformity_goals(variables)
    y = PAGE_H - 140
    card_x = 72
    card_w = PAGE_W - 134

    for tab_title, body_text in goals:
        tab_text = _latin1_safe(tab_title)
        tab_w = max(112, min(220, len(tab_text) * 5.8 + 24))
        tab_h = 22
        box_h = 44

        # Aba laranja superior
        c.setFillColor(ORANGE)
        c.roundRect(card_x, y - tab_h + 4, tab_w, tab_h, 6, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 7.8)
        c.drawString(card_x + 12, y - 10, tab_text)

        # Corpo azul-marinho
        box_top = y - tab_h + 6
        c.setFillColor(NAVY)
        c.roundRect(card_x, box_top - box_h, card_w, box_h, 7, stroke=0, fill=1)

        c.setFillColor(WHITE)
        c.setFont("Helvetica", 9.0)
        lines = simpleSplit(_latin1_safe(body_text), "Helvetica", 9.0, card_w - 30)[:2]
        if len(lines) == 1:
            c.drawString(card_x + 15, box_top - 26, lines[0])
        else:
            c.drawString(card_x + 15, box_top - 19, lines[0])
            c.drawString(card_x + 15, box_top - 32, lines[1])

        y = box_top - box_h - 14

    # Seção: Métricas de Auditoria de Equidade
    y -= 10
    c.setFillColor(NAVY)
    c.roundRect(44, y - 4, 18, 18, 5, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(53, y + 2, str(sec_equity_num))

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(68, y, _latin1_safe("Métricas de Auditoria de Equidade"))

    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica", 9.0)
    c.drawString(
        68,
        y - 15,
        _latin1_safe("Recalculadas a cada re-treinamento e, no mínimo, a cada trimestre."),
    )

    metrics = [
        (
            "Statistical Parity",
            "Aprovação equivalente entre grupo protegido e não protegido.",
        ),
        (
            "Equalized Odds",
            "Acerto e erro equivalentes entre os grupos analisados.",
        ),
        (
            "Equal Opportunity",
            "Entre bons pagadores, aprovação equivalente entre grupos.",
        ),
        (
            "Counterfactual Fairness",
            "Decisão estável ao simular outro grupo protegido.",
        ),
    ]

    grid_top = y - 36
    col_w = (card_w - 14) / 2.0
    box_h = 56
    for idx, (m_title, m_desc) in enumerate(metrics):
        row = idx // 2
        col = idx % 2
        bx = card_x + col * (col_w + 14)
        by = grid_top - row * (box_h + 12) - box_h

        c.setFillColor(EQUITY_BG)
        c.roundRect(bx, by, col_w, box_h, 7, stroke=0, fill=1)

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(bx + 12, by + box_h - 18, _latin1_safe(m_title))

        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 8.2)
        d_lines = simpleSplit(_latin1_safe(m_desc), "Helvetica", 8.2, col_w - 24)[:2]
        for li, line in enumerate(d_lines):
            c.drawString(bx + 12, by + box_h - 31 - li * 11, line)

    c.restoreState()


def _draw_mitigation_page(
    c: canvas.Canvas,
    page_num: int,
    total_pages: int,
    model_name: str,
    sec_mitigation_num: int,
    report: ReportResponse,
) -> None:
    _draw_page_header_footer(c, page_num, total_pages, model_name)
    c.saveState()

    c.setFillColor(NAVY)
    c.roundRect(44, PAGE_H - 122, 18, 18, 5, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(53, PAGE_H - 116, str(sec_mitigation_num))

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(68, PAGE_H - 118, _latin1_safe("Mitigação de Viés no Pipeline"))

    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica", 9.2)
    c.drawString(
        68,
        PAGE_H - 135,
        _latin1_safe("Disparidade acima do limiar aciona uma destas técnicas, conforme a fase do modelo:"),
    )

    stages = [
        ("Pré-processamento", ROYAL, ["Reweighing", "Fair Representation"]),
        ("In-processing", NAVY, ["Constraint Optimization", "Regularization"]),
        ("Pós-processamento", OCHRE, ["Calibration", "Thresholding"]),
    ]

    start_x = 76
    total_w = PAGE_W - 144
    col_w = (total_w - 24) / 3.0
    pill_y = PAGE_H - 192
    pill_h = 28

    for i, (stage_title, stage_color, items) in enumerate(stages):
        sx = start_x + i * (col_w + 12)
        c.setFillColor(stage_color)
        c.roundRect(sx, pill_y, col_w, pill_h, 7, stroke=0, fill=1)

        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 9.0)
        c.drawCentredString(sx + col_w / 2.0, pill_y + 10, _latin1_safe(stage_title))

        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 9.0)
        for j, tech in enumerate(items):
            c.drawCentredString(sx + col_w / 2.0, pill_y - 22 - j * 18, _latin1_safe(tech))

    # Linha divisória
    div_y = pill_y - 72
    c.setStrokeColor(RULE_GRAY)
    c.setLineWidth(0.6)
    c.line(44, div_y, PAGE_W - 44, div_y)

    # Quadro de Síntese Executiva do Modelo Avaliado
    box_top = div_y - 22
    box_h = 110
    c.setFillColor(ROW_ALT)
    c.roundRect(44, box_top - box_h, PAGE_W - 88, box_h, 8, stroke=0, fill=1)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, box_top - 22, _latin1_safe(f"Síntese de Auditoria do Modelo: {model_name}"))

    s = report.summary
    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica", 8.8)
    c.drawString(
        60,
        box_top - 42,
        _latin1_safe(
            f"· Variáveis analisadas: {s.total}   |   Riscos identificados: {s.total_riscos}   |   Veto ou Risco Máximo: {s.vetos_or_maxima}"
        ),
    )
    c.drawString(
        60,
        box_top - 58,
        _latin1_safe(
            f"· Variáveis Sensíveis: {s.sensiveis}   |   Atuação como Proxy: {s.proxies}   |   Pendentes de Revisão Jurídica: {s.pendentes}"
        ),
    )

    vetoed_labels = [
        v.label for v in report.selected_variables if v.nivel_risco_maximo == "Risco_Veto"
    ]
    veto_note = (
        f"· Atenção — Variáveis com Veto Decisório: {', '.join(vetoed_labels[:6])}"
        if vetoed_labels
        else "· Nenhuma variável com nível de Veto absoluto foi detectada no subconjunto selecionado."
    )
    c.setFillColor(colors.HexColor("#B91C1C") if vetoed_labels else GREEN_BADGE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(60, box_top - 80, _latin1_safe(veto_note[:95]))

    # Nota de revisão institucional idêntica ao Manual_Governança.pdf
    note_y = box_top - box_h - 28
    c.setFillColor(TEXT_DARK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(44, note_y, _latin1_safe("Revisão desta matriz:"))
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica", 8.5)
    c.drawString(
        142,
        note_y,
        _latin1_safe(
            "a cada mudança regulatória relevante do Banco Central ou da ANPD, ou nova variável"
        ),
    )
    c.drawString(
        44,
        note_y - 14,
        _latin1_safe(
            "submetida à análise jurídica. · Governança e Auditoria de Vieses em Modelos de Risco de Crédito, Instituto de"
        ),
    )
    c.drawString(
        44,
        note_y - 28,
        _latin1_safe("Ciência e Tecnologia Itaú (ICTi) / UFRN."),
    )

    c.restoreState()


def build_governance_manual_pdf(
    report: ReportResponse,
    categories: List[CategoryRead],
    all_variables: List[VariableRead],
    model_name: str = "",
) -> bytes:
    """Gera o arquivo PDF completo no estilo visual do Manual_Governança.pdf."""
    title = (model_name or "").strip() or "Modelo de Risco de Crédito V2"
    labels_by_id: Dict[str, str] = {v.id: v.label for v in all_variables}
    for v in report.selected_variables:
        labels_by_id[v.id] = v.label

    cat_desc_map: Dict[str, str] = {c.label: c.description for c in categories if c.description}
    for k, desc in DEFAULT_CATEGORY_DESCRIPTIONS.items():
        cat_desc_map.setdefault(k, desc)

    # Agrupa variáveis selecionadas por categoria preservando ordem consistente
    grouped: "OrderedDict[str, List[VariableRead]]" = OrderedDict()
    for v in report.selected_variables:
        cat_label = v.categoria_label or "Outras Variáveis"
        grouped.setdefault(cat_label, []).append(v)

    if not grouped:
        grouped["Variáveis Selecionadas"] = []

    # Pré-calcula a paginação de cada categoria para montar o Sumário com páginas exatas
    # Páginas:
    # 1: Capa
    # 2: Sumário
    # 3: Divisor Parte I
    # 4..K: Tabelas por categoria
    # K+1: Divisor Parte II
    # K+2: Metas de Conformidade + Métricas de Equidade
    # K+3: Mitigação de Viés no Pipeline
    category_page_chunks: List[Tuple[int, str, str, List[VariableRead], bool]] = []
    part1_toc: List[Tuple[int, str, int]] = []

    current_page = 4
    sec_idx = 1
    for cat_label, vars_in_cat in grouped.items():
        cat_desc = cat_desc_map.get(
            cat_label,
            "Variáveis avaliadas quanto ao nexo causal, base legal autorizadora e risco de atuação como proxy.",
        )
        chunks = _paginate_category_variables(vars_in_cat, labels_by_id) or [[]]
        part1_toc.append((sec_idx, cat_label, current_page))
        for chunk_idx, chunk in enumerate(chunks):
            category_page_chunks.append(
                (sec_idx, cat_label, cat_desc, chunk, chunk_idx > 0)
            )
            current_page += 1
        sec_idx += 1

    part2_divider_page = current_page
    conformity_page = part2_divider_page + 1
    mitigation_page = part2_divider_page + 2
    total_pages = mitigation_page

    sec_conformity = sec_idx
    sec_equity = sec_idx + 1
    sec_mitigation = sec_idx + 2

    part2_toc: List[Tuple[int, str, int]] = [
        (sec_conformity, "Metas de Conformidade Regulatória", conformity_page),
        (sec_equity, "Métricas de Auditoria de Equidade", conformity_page),
        (sec_mitigation, "Mitigação de Viés no Pipeline", mitigation_page),
    ]

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Manual de Governança — {title}")
    c.setAuthor("ICTi · Governança de Variáveis")

    # Página 1: Capa
    _draw_cover_page(c, report, title)
    c.showPage()

    # Página 2: Sumário
    _draw_toc_page(c, part1_toc, part2_toc, total_pages, title)
    c.showPage()

    # Página 3: Divisor Parte I
    _draw_section_divider(
        c,
        bg_color=ORANGE,
        roman="I",
        part_label="P A R T E   I",
        title_lines=["A matriz,", "variável a variável"],
        subtitle_lines=[
            "CEP pode ser proxy de raça. GPA pode ser proxy de elite.",
            "Aqui está, grupo a grupo, por que cada variável entra ou",
            "fica de fora, com a base legal exata.",
        ],
        accent_circle_color=NAVY,
        accent_left=True,
    )
    c.showPage()

    # Páginas 4..K: Tabelas por categoria
    pg = 4
    for s_num, cat_label, cat_desc, chunk, is_cont in category_page_chunks:
        _draw_category_table_page(
            c,
            page_num=pg,
            total_pages=total_pages,
            model_name=title,
            section_num=s_num,
            category_title=cat_label,
            category_desc=cat_desc,
            variables=chunk,
            labels_by_id=labels_by_id,
            is_continuation=is_cont,
        )
        c.showPage()
        pg += 1

    # Página K+1: Divisor Parte II
    _draw_section_divider(
        c,
        bg_color=GREEN_DARK,
        roman="II",
        part_label="P A R T E   I I",
        title_lines=["Fundamentação legal", "e auditoria técnica"],
        subtitle_lines=[
            "Aqui a conformidade regulatória vira meta mensurável,",
            "métrica recalculada e técnica de correção quando o",
            "resultado foge do esperado.",
        ],
        accent_circle_color=GOLD,
        accent_left=False,
    )
    c.showPage()

    # Página K+2: Metas de Conformidade + Métricas de Equidade
    _draw_conformity_and_equity_page(
        c,
        page_num=conformity_page,
        total_pages=total_pages,
        model_name=title,
        sec_conformity_num=sec_conformity,
        sec_equity_num=sec_equity,
        variables=report.selected_variables,
    )
    c.showPage()

    # Página K+3: Mitigação de Viés no Pipeline
    _draw_mitigation_page(
        c,
        page_num=mitigation_page,
        total_pages=total_pages,
        model_name=title,
        sec_mitigation_num=sec_mitigation,
        report=report,
    )
    c.showPage()

    c.save()
    return buf.getvalue()
