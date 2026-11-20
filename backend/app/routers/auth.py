"""Roteador de autenticação JWT e gestão de usuários (Administrador)."""

from datetime import datetime, timezone
from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    LoginRequest,
    TokenResponse,
    User,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    user_to_read,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    identifier = payload.username.strip()
    user = session.exec(
        select(User).where(
            (User.username == identifier) | (User.email == identifier),
            User.deleted_at.is_(None),
        )
    ).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha inválidos.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Contate o administrador.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user)
    return TokenResponse(access_token=token, user=user_to_read(user))


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return user_to_read(current_user)


@router.get("/users", response_model=List[UserRead])
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
) -> List[UserRead]:
    users = session.exec(
        select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())
    ).all()
    return [user_to_read(u) for u in users]


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
) -> UserRead:
    username = payload.username.strip()
    email = payload.email.strip().lower()

    dup = session.exec(
        select(User).where(
            ((User.username == username) | (User.email == email)) & User.deleted_at.is_(None)
        )
    ).first()
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com este username ou e-mail.",
        )

    user = User(
        username=username,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user_to_read(user)


@router.patch("/users/{public_id}", response_model=UserRead)
def update_user(
    public_id: uuid.UUID,
    payload: UserUpdate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(require_admin),
) -> UserRead:
    user = session.exec(
        select(User).where(User.public_id == public_id, User.deleted_at.is_(None))
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.email is not None:
        email = payload.email.strip().lower()
        conflict = session.exec(
            select(User).where(
                User.email == email,
                User.id != user.id,
                User.deleted_at.is_(None),
            )
        ).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já em uso.")
        user.email = email
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.role is not None:
        if user.id == current_admin.id and payload.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você não pode remover seu próprio papel de administrador.",
            )
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == current_admin.id and not payload.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você não pode desativar sua própria conta.",
            )
        user.is_active = payload.is_active

    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user_to_read(user)


@router.delete("/users/{public_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    public_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_admin: User = Depends(require_admin),
) -> None:
    user = session.exec(
        select(User).where(User.public_id == public_id, User.deleted_at.is_(None))
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode excluir sua própria conta.",
        )

    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    session.add(user)
    session.commit()
