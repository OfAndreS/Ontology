"""Ponto de entrada da aplicação FastAPI."""

from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.bootstrap import ensure_default_admin, seed_fuseki_if_empty
from app.config import settings
from app.database import create_db_and_tables, engine
from app.routers import auth, catalog_meta, categories, laws, variables

logger = logging.getLogger(__name__)


def _run_startup_bootstrap() -> None:
    if settings.skip_bootstrap:
        return

    settings.upload_path.mkdir(parents=True, exist_ok=True)
    create_db_and_tables()
    with Session(engine) as session:
        ensure_default_admin(session)

    # Aguarda brevemente o Fuseki ficar acessível quando subindo via Docker Compose
    for attempt in range(1, 11):
        try:
            seed_fuseki_if_empty()
            return
        except Exception as exc:
            logger.warning("Tentativa %d/10 de seed no Fuseki falhou: %s", attempt, exc)
            time.sleep(2)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _run_startup_bootstrap()
    yield


app = FastAPI(
    title="MyOnt Governança de Variáveis — API Unificada",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(variables.router)
app.include_router(categories.router)
app.include_router(laws.router)
app.include_router(catalog_meta.router)


@app.get("/api/health")
def health():
    return {"ok": True}
