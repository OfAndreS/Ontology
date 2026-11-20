"""Roteador de variáveis de crédito, riscos e auditoria."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    HistoryItemRead,
    User,
    VariableDetailRead,
    VariableHistory,
    VariablePayload,
    VariableRead,
)
from app.security import get_current_user
from app.services.ontology_service import OntologyService

router = APIRouter(prefix="/api/variables", tags=["variables"])


def _get_variable_history(session: Session, variable_uri: str) -> List[HistoryItemRead]:
    rows = session.exec(
        select(VariableHistory)
        .where(VariableHistory.variable_uri == variable_uri)
        .order_by(VariableHistory.created_at.desc())
    ).all()
    return [
        HistoryItemRead(
            id=str(row.public_id),
            action=row.action,
            author_name=row.author_name,
            created_at=row.created_at,
        )
        for row in rows
    ]


def _record_variable_history(session: Session, variable_uri: str, action: str, user: User) -> None:
    session.add(
        VariableHistory(
            variable_uri=variable_uri,
            action=action,
            author_id=user.id,
            author_name=user.name or user.username,
        )
    )
    session.commit()


@router.get("", response_model=List[VariableRead])
def list_variables(
    q: str = Query(default=""),
    category_id: str = Query(default=""),
    nivel_risco: str = Query(default=""),
    sensivel: Optional[bool] = Query(default=None),
    is_proxy: Optional[bool] = Query(default=None),
    status_curadoria: str = Query(default="", alias="status"),
    _: User = Depends(get_current_user),
) -> List[VariableRead]:
    svc = OntologyService()
    return svc.list_variables(
        q=q,
        category_id=category_id,
        nivel_risco=nivel_risco,
        sensivel=sensivel,
        is_proxy=is_proxy,
        status=status_curadoria,
    )


@router.get("/{var_id}", response_model=VariableDetailRead)
def get_variable(
    var_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> VariableDetailRead:
    svc = OntologyService()
    detail = svc.get_variable_detail(var_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variável não encontrada.")
    detail.history = _get_variable_history(session, detail.uri)
    return detail


@router.post("", response_model=VariableDetailRead, status_code=status.HTTP_201_CREATED)
def create_variable(
    payload: VariablePayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> VariableDetailRead:
    svc = OntologyService()
    try:
        saved = svc.save_variable(payload, target_id=None)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _record_variable_history(session, saved.uri, "Variável cadastrada", current_user)
    saved.history = _get_variable_history(session, saved.uri)
    return saved


@router.put("/{var_id}", response_model=VariableDetailRead)
def update_variable(
    var_id: str,
    payload: VariablePayload,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> VariableDetailRead:
    svc = OntologyService()
    try:
        saved = svc.save_variable(payload, target_id=var_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    _record_variable_history(session, saved.uri, "Variável atualizada", current_user)
    saved.history = _get_variable_history(session, saved.uri)
    return saved


@router.delete("/{var_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variable(
    var_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> None:
    svc = OntologyService()
    try:
        deleted = svc.delete_variable(var_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    histories = session.exec(
        select(VariableHistory).where(VariableHistory.variable_uri == deleted.uri)
    ).all()
    for row in histories:
        session.delete(row)
    session.commit()
