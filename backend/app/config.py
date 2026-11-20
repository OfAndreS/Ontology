"""Configurações da aplicação via variáveis de ambiente."""

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://myont:myont_dev_password@localhost:5433/myont_platform"
    fuseki_url: str = "http://localhost:3030"
    fuseki_dataset: str = "myont"
    fuseki_user: str = "admin"
    fuseki_password: str = "admin"

    secret_key: str = "change-this-secret-key-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    admin_default_username: str = "admin"
    admin_default_name: str = "Administrador"
    admin_default_email: str = "admin@governanca.local"
    admin_default_password: str = "admin123"

    semantic_dir: str = str(REPO_ROOT / "semantic")
    upload_dir: str = str(BASE_DIR / "uploads" / "laws")
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    skip_bootstrap: bool = False

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def semantic_path(self) -> Path:
        return Path(self.semantic_dir)

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)


settings = Settings()
