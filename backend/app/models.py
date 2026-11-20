"""Modelos operacionais PostgreSQL (SQLModel) e DTOs da API."""

from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional
import uuid

from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Field, SQLModel

RoleType = Literal["admin", "analista"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Tabelas PostgreSQL (schemas auth e core)
# ---------------------------------------------------------------------------


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id: int | None = Field(default=None, primary_key=True)
    public_id: uuid.UUID = Field(default_factory=uuid.uuid4, unique=True, nullable=False)
    username: str = Field(max_length=40, unique=True, index=True, nullable=False)
    name: str = Field(max_length=255, nullable=False)
    email: str = Field(max_length=255, unique=True, index=True, nullable=False)
    password_hash: str = Field(max_length=255, nullable=False)
    role: str = Field(default="analista", max_length=20, nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    last_login_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=utcnow, nullable=False)
    deleted_at: datetime | None = Field(default=None)


class LawAttachment(SQLModel, table=True):
    __tablename__ = "law_attachments"
    __table_args__ = {"schema": "core"}

    id: int | None = Field(default=None, primary_key=True)
    public_id: uuid.UUID = Field(default_factory=uuid.uuid4, unique=True, nullable=False)
    norm_uri: str = Field(max_length=512, unique=True, index=True, nullable=False)
    norm_slug: str = Field(max_length=255, unique=True, index=True, nullable=False)
    pdf_name: str = Field(max_length=255, nullable=False)
    pdf_path: str = Field(max_length=1024, nullable=False)
    uploaded_by: int | None = Field(default=None, foreign_key="auth.users.id")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=utcnow, nullable=False)


class LawHistory(SQLModel, table=True):
    __tablename__ = "law_histories"
    __table_args__ = {"schema": "core"}

    id: int | None = Field(default=None, primary_key=True)
    public_id: uuid.UUID = Field(default_factory=uuid.uuid4, unique=True, nullable=False)
    norm_uri: str = Field(max_length=512, index=True, nullable=False)
    action: str = Field(max_length=255, nullable=False)
    author_id: int | None = Field(default=None, foreign_key="auth.users.id")
    author_name: str = Field(max_length=255, nullable=False)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class VariableHistory(SQLModel, table=True):
    __tablename__ = "variable_histories"
    __table_args__ = {"schema": "core"}

    id: int | None = Field(default=None, primary_key=True)
    public_id: uuid.UUID = Field(default_factory=uuid.uuid4, unique=True, nullable=False)
    variable_uri: str = Field(max_length=512, index=True, nullable=False)
    action: str = Field(max_length=255, nullable=False)
    author_id: int | None = Field(default=None, foreign_key="auth.users.id")
    author_name: str = Field(max_length=255, nullable=False)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


# ---------------------------------------------------------------------------
# DTOs — Autenticação e Usuários
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    id: int
    public_id: uuid.UUID
    username: str
    name: str
    email: str
    role: RoleType
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class UserCreate(BaseModel):
    username: str = PydanticField(min_length=2, max_length=40)
    name: str = PydanticField(min_length=2, max_length=255)
    email: str = PydanticField(min_length=3, max_length=255)
    password: str = PydanticField(min_length=6, max_length=128)
    role: RoleType = "analista"
    is_active: bool = True


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = PydanticField(default=None, min_length=6, max_length=128)
    role: RoleType | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# DTOs — Auditoria
# ---------------------------------------------------------------------------


class HistoryItemRead(BaseModel):
    id: str
    action: str
    author_name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# DTOs — Categorias Temáticas
# ---------------------------------------------------------------------------


class CategoryRead(BaseModel):
    id: str
    uri: str
    slug: str
    label: str
    description: str = ""
    variable_count: int = 0


class CategoryCreate(BaseModel):
    id: str | None = None
    label: str = PydanticField(min_length=2, max_length=120)
    description: str = ""


class CategoryUpdate(BaseModel):
    label: str | None = None
    description: str | None = None


# ---------------------------------------------------------------------------
# DTOs — Normas e Dispositivos Legais
# ---------------------------------------------------------------------------


class LawDeviceInput(BaseModel):
    id: str | None = None
    label: str = PydanticField(min_length=1, max_length=255)
    tipo_dispositivo: str = "Artigo"
    descricao: str = ""


class LawDeviceRead(BaseModel):
    id: str
    uri: str
    label: str
    tipo_dispositivo: str
    descricao: str = ""


class LawCreate(BaseModel):
    id: str | None = None
    label: str = PydanticField(min_length=2, max_length=255)
    tipo_instrumento: str = "Lei"
    descricao: str = ""
    url_fonte: str | None = None
    data_publicacao: str | None = None
    dispositivos: List[LawDeviceInput] = []


class LawUpdate(BaseModel):
    label: str | None = None
    tipo_instrumento: str | None = None
    descricao: str | None = None
    url_fonte: str | None = None
    data_publicacao: str | None = None
    dispositivos: List[LawDeviceInput] | None = None


class LawRead(BaseModel):
    id: str
    uri: str
    slug: str
    label: str
    tipo_instrumento: str
    descricao: str = ""
    url_fonte: str | None = None
    data_publicacao: str | None = None
    pdf_name: str | None = None
    pdf_url: str | None = None
    dispositivos: List[LawDeviceRead] = []
    linked_variables: List[Dict[str, str]] = []
    history: List[HistoryItemRead] = []


# ---------------------------------------------------------------------------
# DTOs — Vocabulários, Conceitos Externos, Variáveis e Relatório
# ---------------------------------------------------------------------------


class VocabItem(BaseModel):
    id: str
    label: str


class LegalBaseVocabItem(BaseModel):
    id: str
    uri: str
    label: str
    kind: Literal["InstrumentoNormativo", "DispositivoLegal"]
    tipo_detalhe: str
    instrumento_id: str | None = None
    instrumento_label: str | None = None


class VocabulariesRead(BaseModel):
    bases_legais: List[LegalBaseVocabItem]
    niveis_risco: List[VocabItem]
    status_curadoria: List[VocabItem]
    tipos_instrumento: List[str]
    tipos_dispositivo: List[str]


class ExternalConceptRead(BaseModel):
    uri: str
    curie: str
    label: str
    comment: str = ""
    ontologia: str = "Schema.org"
    tipo: str = ""
    contexto: str = ""


class RiskInput(BaseModel):
    id: str | None = None
    descricao: str = PydanticField(min_length=1)
    nivel_risco: str = "Risco_Medio"
    demanda_governanca: str = ""
    implicacao_legal: str = ""
    bases_acionadas: List[str] = []


class RiskRead(BaseModel):
    id: str
    uri: str
    descricao: str
    nivel_risco: str
    nivel_label: str
    demanda_governanca: str = ""
    implicacao_legal: str = ""
    bases_acionadas: List[str] = []
    bases_acionadas_labels: List[str] = []


class VariableDescriptions(BaseModel):
    origem: str = ""
    justificativa_legal: str = ""
    explicabilidade: str = ""
    atuacao_proxy: str = ""


class VariablePayload(BaseModel):
    id: str | None = None
    label: str = PydanticField(min_length=1, max_length=255)
    categoria_id: str | None = None
    sensivel: bool = False
    status_curadoria: str = "Status_PendenteRevisaoJuridica"
    bases_autorizadoras: List[str] = []
    conceitos_equivalentes: List[str] = []
    conceitos_baseados: List[str] = []
    proxy_de: List[str] = []
    derivada_de: List[str] = []
    descricoes: VariableDescriptions = PydanticField(default_factory=VariableDescriptions)
    riscos: List[RiskInput] = []


class VariableRef(BaseModel):
    id: str
    label: str


class VariableRead(BaseModel):
    id: str
    uri: str
    label: str
    categoria_id: str | None = None
    categoria_label: str | None = None
    sensivel: bool
    is_proxy: bool
    status_curadoria: str
    status_label: str
    nivel_risco_maximo: str
    nivel_risco_label: str
    bases_autorizadoras: List[str] = []
    bases_autorizadoras_labels: List[str] = []
    bases_restringidas: List[str] = []
    bases_restringidas_labels: List[str] = []
    conceitos_equivalentes: List[str] = []
    conceitos_baseados: List[str] = []
    proxy_de: List[str] = []
    derivada_de: List[str] = []
    descricoes: VariableDescriptions
    riscos: List[RiskRead] = []
    inherited_alerts: List[str] = []


class VariableDetailRead(VariableRead):
    reverse_proxies: List[VariableRef] = []
    derived_children: List[VariableRef] = []
    history: List[HistoryItemRead] = []


class ReportRequest(BaseModel):
    variable_ids: List[str] = []
    model_name: str = ""


class ReportSummary(BaseModel):
    total: int
    vetos_or_maxima: int
    sensiveis: int
    proxies: int
    pendentes: int
    total_riscos: int


class ReportResponse(BaseModel):
    markdown: str
    selected_variables: List[VariableRead]
    summary: ReportSummary
