"""Roteador de categorias temáticas de variáveis (Decisão 08)."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.models import CategoryCreate, CategoryRead, CategoryUpdate, User
from app.security import get_current_user, require_admin
from app.services.ontology_service import OntologyService

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=List[CategoryRead])
def list_categories(_: User = Depends(get_current_user)) -> List[CategoryRead]:
    return OntologyService().list_categories()


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: str, _: User = Depends(get_current_user)) -> CategoryRead:
    cat = OntologyService().get_category(category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada.")
    return cat


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    _: User = Depends(require_admin),
) -> CategoryRead:
    try:
        return OntologyService().create_category(payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: str,
    payload: CategoryUpdate,
    _: User = Depends(require_admin),
) -> CategoryRead:
    try:
        return OntologyService().update_category(category_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: str, _: User = Depends(require_admin)) -> None:
    try:
        OntologyService().delete_category(category_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
