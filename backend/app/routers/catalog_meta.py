"""Roteador de vocabulários, conceitos Schema.org e relatório preventivo."""

from typing import List

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.models import (
    ExternalConceptRead,
    ReportRequest,
    ReportResponse,
    User,
    VocabulariesRead,
)
from app.security import get_current_user
from app.services.ontology_service import OntologyService
from app.services.report_pdf_service import build_governance_manual_pdf

router = APIRouter(prefix="/api", tags=["catalog-meta"])


@router.get("/vocabularies", response_model=VocabulariesRead)
def get_vocabularies(_: User = Depends(get_current_user)) -> VocabulariesRead:
    return OntologyService().get_vocabularies()


@router.get("/concepts", response_model=List[ExternalConceptRead])
def list_concepts(
    q: str = Query(default=""),
    _: User = Depends(get_current_user),
) -> List[ExternalConceptRead]:
    return OntologyService().list_concepts(q=q)


@router.post("/report", response_model=ReportResponse)
def generate_report(
    payload: ReportRequest,
    _: User = Depends(get_current_user),
) -> ReportResponse:
    return OntologyService().build_report(
        variable_ids=payload.variable_ids,
        model_name=payload.model_name,
    )


@router.post("/report/pdf")
def generate_report_pdf(
    payload: ReportRequest,
    _: User = Depends(get_current_user),
) -> Response:
    svc = OntologyService()
    report = svc.build_report(
        variable_ids=payload.variable_ids,
        model_name=payload.model_name,
    )
    categories = svc.list_categories()
    all_variables = svc.list_variables()
    pdf_bytes = build_governance_manual_pdf(
        report=report,
        categories=categories,
        all_variables=all_variables,
        model_name=payload.model_name,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="manual-governanca-preventiva.pdf"'
        },
    )
