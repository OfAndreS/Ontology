"""Configuração de conexão e sessão PostgreSQL via SQLModel."""

from typing import Generator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

engine = create_engine(settings.database_url, echo=False, pool_pre_ping=True)


def create_db_and_tables(target_engine=None) -> None:
    """Garante os schemas `auth` e `core` (em PostgreSQL) e cria as tabelas."""
    db_engine = target_engine or engine
    if db_engine.dialect.name == "postgresql":
        with db_engine.begin() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
    SQLModel.metadata.create_all(db_engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
