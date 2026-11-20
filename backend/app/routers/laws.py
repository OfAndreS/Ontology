"""Roteador de normas, dispositivos legais, upload/download de PDFs e histórico."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models import (
    HistoryItemRead,
    LawAttachment,
    LawCreate,
    LawHistory,
    LawRead,
    LawUpdate,
    User,
)
from app.security import get_current_user
from app.services.ontology_service import OntologyService

router = APIRouter(prefix="/api/laws", tags=["laws"])


def _enrich_law(law: LawRead, session: Session) -> LawRead:
    att = session.exec(
        select(LawAttachment).where(LawAttachment.norm_uri == law.uri)
    ).first()
    if att:
        law.pdf_name = att.pdf_name
        law.pdf_url = f"/api/laws/{law.slug}/download-pdf"

    hist_rows = session.exec(
        select(LawHistory)
        .where(LawHistory.norm_uri == law.uri)
        .order_by(LawHistory.created_at.desc())
    ).all()
    law.history = [
        HistoryItemRead(
            id=str(h.public_id),
            action=h.action,
            author_name=h.author_name,
            created_at=h.created_at,
        )
        for h in hist_rows
    ]
    return law


def _record_law_history(session: Session, norm_uri: str, action: str, user: User) -> None:
    session.add(
        LawHistory(
            norm_uri=norm_uri,
            action=action,
            author_id=user.id,
            author_name=user.name or user.username,
        )
    )
    session.commit()


def _safe_remove_file(pdf_path: str) -> None:
    try:
        p = Path(pdf_path)
        if p.exists() and p.is_file():
            p.unlink()
    except OSError:
        pass


@router.get("", response_model=List[LawRead])
def list_laws(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> List[LawRead]:
    laws = OntologyService().list_laws()
    attachments: Dict[str, LawAttachment] = {
        a.norm_uri: a for a in session.exec(select(LawAttachment)).all()
    }
    for law in laws:
        att = attachments.get(law.uri)
        if att:
            law.pdf_name = att.pdf_name
            law.pdf_url = f"/api/laws/{law.slug}/download-pdf"
    return laws


@router.get("/{identifier}", response_model=LawRead)
def get_law(
    identifier: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> LawRead:
    law = OntologyService().get_law(identifier)
    if not law:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Norma não encontrada.")
    return _enrich_law(law, session)


@router.post("", response_model=LawRead, status_code=status.HTTP_201_CREATED)
def create_law(
    payload: LawCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LawRead:
    try:
        law = OntologyService().create_law(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _record_law_history(session, law.uri, "Norma cadastrada", current_user)
    return _enrich_law(law, session)


@router.patch("/{identifier}", response_model=LawRead)
def update_law(
    identifier: str,
    payload: LawUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LawRead:
    try:
        law = OntologyService().update_law(identifier, payload)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    _record_law_history(session, law.uri, "Norma atualizada", current_user)
    return _enrich_law(law, session)


@router.delete("/{identifier}", status_code=status.HTTP_204_NO_CONTENT)
def delete_law(
    identifier: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> None:
    try:
        deleted = OntologyService().delete_law(identifier)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    att = session.exec(select(LawAttachment).where(LawAttachment.norm_uri == deleted.uri)).first()
    if att:
        _safe_remove_file(att.pdf_path)
        session.delete(att)

    histories = session.exec(select(LawHistory).where(LawHistory.norm_uri == deleted.uri)).all()
    for row in histories:
        session.delete(row)

    session.commit()


@router.post("/{identifier}/upload-pdf", response_model=LawRead)
async def upload_law_pdf(
    identifier: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LawRead:
    law = OntologyService().get_law(identifier)
    if not law:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Norma não encontrada.")

    filename = Path(file.filename or "norma.pdf").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos PDF (.pdf) são permitidos.",
        )

    content = await file.read()
    target_dir = settings.upload_path / law.slug
    target_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{filename}"
    target_path = target_dir / stored_name
    target_path.write_bytes(content)

    att = session.exec(select(LawAttachment).where(LawAttachment.norm_uri == law.uri)).first()
    if att:
        _safe_remove_file(att.pdf_path)
        att.pdf_name = filename
        att.pdf_path = str(target_path)
        att.uploaded_by = current_user.id
        att.updated_at = datetime.now(timezone.utc)
        action = f"PDF atualizado ({filename})"
    else:
        att = LawAttachment(
            norm_uri=law.uri,
            norm_slug=law.slug,
            pdf_name=filename,
            pdf_path=str(target_path),
            uploaded_by=current_user.id,
        )
        action = f"PDF anexado ({filename})"

    session.add(att)
    session.commit()
    _record_law_history(session, law.uri, action, current_user)
    return _enrich_law(law, session)


@router.get("/{identifier}/download-pdf")
def download_law_pdf(
    identifier: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> FileResponse:
    law = OntologyService().get_law(identifier)
    if not law:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Norma não encontrada.")

    att = session.exec(select(LawAttachment).where(LawAttachment.norm_uri == law.uri)).first()
    if not att or not Path(att.pdf_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhum PDF anexado para esta norma.",
        )

    return FileResponse(
        path=att.pdf_path,
        media_type="application/pdf",
        filename=att.pdf_name,
    )


@router.delete("/{identifier}/pdf", response_model=LawRead)
def delete_law_pdf(
    identifier: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> LawRead:
    law = OntologyService().get_law(identifier)
    if not law:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Norma não encontrada.")

    att = session.exec(select(LawAttachment).where(LawAttachment.norm_uri == law.uri)).first()
    if not att:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Norma não possui PDF anexado.")

    removed_name = att.pdf_name
    _safe_remove_file(att.pdf_path)
    session.delete(att)
    session.commit()
    _record_law_history(session, law.uri, f"PDF removido ({removed_name})", current_user)
    return _enrich_law(law, session)
