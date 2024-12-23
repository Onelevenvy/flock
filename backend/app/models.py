from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from pydantic import BaseModel, model_validator
from pydantic import Field as PydanticField
from sqlalchemy import ARRAY, JSON, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import PrimaryKeyConstraint, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.core.graph.messages import ChatResponse
from app.core.security import security_manager


class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: int | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str


# ===============USER========================


class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = None
    language: str = Field(default="en-US")


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str


# TODO replace email str with EmailStr when sqlmodel supports it
class UserCreateOpen(SQLModel):
    email: str
    password: str
    full_name: str | None = None


# Properties to receive via API on update, all are optional
# TODO replace email str with EmailStr when sqlmodel supports it
class UserUpdate(UserBase):
    email: str | None = None  # type: ignore
    password: str | None = None


# TODO replace email str with EmailStr when sqlmodel supports it
class UserUpdateMe(SQLModel):
    full_name: str | None = None
    email: str | None = None


class UpdatePassword(SQLModel):
    current_password: str
    new_password: str


class UpdateLanguageMe(SQLModel):
    language: str = Field(default="en-US")


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str
    teams: list["Team"] = Relationship(back_populates="owner")
    skills: list["Skill"] = Relationship(back_populates="owner")
    uploads: list["Upload"] = Relationship(back_populates="owner")
    graphs: list["Graph"] = Relationship(back_populates="owner")
    language: str = Field(default="en-US")


# Properties to return via API, id is always required
class UserOut(UserBase):
    id: int


class UsersOut(SQLModel):
    data: list[UserOut]
    count: int


# ==============TEAM=========================


class TeamBase(SQLModel):
    name: str = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    description: str | None = None
    # 增加team的图标
    icon: str | None = None


class TeamCreate(TeamBase):
    workflow: str


class TeamUpdate(TeamBase):
    name: str | None = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$", default=None)  # type: ignore[assignment]


class ChatMessageType(str, Enum):
    human = "human"
    ai = "ai"


class ChatMessage(BaseModel):
    type: ChatMessageType
    content: str
    imgdata: str | None = None  # 添加 imgdata 字段


class InterruptDecision(Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    REPLIED = "replied"


class Interrupt(BaseModel):
    decision: InterruptDecision
    tool_message: str | None = None


class TeamChat(BaseModel):
    messages: list[ChatMessage]
    interrupt: Interrupt | None = None


class TeamChatPublic(BaseModel):
    message: ChatMessage | None = None
    interrupt: Interrupt | None = None

    @model_validator(mode="after")
    def check_either_field(cls: Any, values: Any) -> Any:
        message, interrupt = values.message, values.interrupt
        if not message and not interrupt:
            raise ValueError('Either "message" or "interrupt" must be provided.')
        return values


class Team(TeamBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(regex=r"^[a-zA-Z0-9_-]{1,64}$", unique=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="teams")
    members: list["Member"] = Relationship(
        back_populates="belongs", sa_relationship_kwargs={"cascade": "delete"}
    )
    workflow: str  # TODO:
    threads: list["Thread"] = Relationship(
        back_populates="team", sa_relationship_kwargs={"cascade": "delete"}
    )
    graphs: list["Graph"] = Relationship(
        back_populates="team", sa_relationship_kwargs={"cascade": "delete"}
    )
    apikeys: list["ApiKey"] = Relationship(
        back_populates="team", sa_relationship_kwargs={"cascade": "delete"}
    )


# Properties to return via API, id is always required
class TeamOut(TeamBase):
    id: int
    owner_id: int
    workflow: str


class TeamsOut(SQLModel):
    data: list[TeamOut]
    count: int


# =============Threads===================


class ThreadBase(SQLModel):
    query: str


class ThreadCreate(ThreadBase):
    pass


class ThreadUpdate(ThreadBase):
    query: str | None = None  # type: ignore[assignment]
    updated_at: datetime | None = None


class Thread(ThreadBase, table=True):
    id: UUID | None = Field(
        default_factory=uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )
    updated_at: datetime | None = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=func.now(),
            onupdate=func.now(),
            server_default=func.now(),
        )
    )
    team_id: int | None = Field(default=None, foreign_key="team.id", nullable=False)
    team: Team | None = Relationship(back_populates="threads")
    checkpoints: list["Checkpoint"] = Relationship(
        back_populates="thread", sa_relationship_kwargs={"cascade": "delete"}
    )
    checkpoint_blobs: list["CheckpointBlobs"] = Relationship(
        back_populates="thread", sa_relationship_kwargs={"cascade": "delete"}
    )

    writes: list["Write"] = Relationship(
        back_populates="thread", sa_relationship_kwargs={"cascade": "delete"}
    )


class ThreadOut(SQLModel):
    id: UUID
    query: str
    updated_at: datetime


class ThreadRead(ThreadOut):
    messages: list[ChatResponse]


class ThreadsOut(SQLModel):
    data: list[ThreadOut]
    count: int


# ==============MEMBER=========================


class MemberSkillsLink(SQLModel, table=True):
    member_id: int | None = Field(
        default=None, foreign_key="member.id", primary_key=True
    )
    skill_id: int | None = Field(default=None, foreign_key="skill.id", primary_key=True)


class MemberUploadsLink(SQLModel, table=True):
    member_id: int | None = Field(
        default=None, foreign_key="member.id", primary_key=True
    )
    upload_id: int | None = Field(
        default=None, foreign_key="upload.id", primary_key=True
    )


class MemberBase(SQLModel):
    name: str = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    backstory: str | None = None
    role: str
    type: str  # one of: leader, worker, freelancer
    owner_of: int | None = None
    position_x: float
    position_y: float
    source: int | None = None
    provider: str = ""
    model: str = ""
    api_key: str | None = None
    base_url: str | None = None

    temperature: float = 0.1
    interrupt: bool = False


class MemberCreate(MemberBase):
    pass


class MemberUpdate(MemberBase):
    name: str | None = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$", default=None)  # type: ignore[assignment]
    backstory: str | None = None
    role: str | None = None  # type: ignore[assignment]
    type: str | None = None  # type: ignore[assignment]
    belongs_to: int | None = None
    position_x: float | None = None  # type: ignore[assignment]
    position_y: float | None = None  # type: ignore[assignment]
    skills: list["Skill"] | None = None
    uploads: list["Upload"] | None = None
    provider: str | None = None  # type: ignore[assignment]
    model: str | None = None  # type: ignore[assignment]
    api_key: str | None = None
    base_url: str | None = None

    temperature: float | None = None  # type: ignore[assignment]
    interrupt: bool | None = None  # type: ignore[assignment]


class Member(MemberBase, table=True):
    __table_args__ = (
        UniqueConstraint("name", "belongs_to", name="unique_team_and_name"),
    )
    id: int | None = Field(default=None, primary_key=True)
    belongs_to: int | None = Field(default=None, foreign_key="team.id", nullable=False)
    belongs: Team | None = Relationship(back_populates="members")
    skills: list["Skill"] = Relationship(
        back_populates="members",
        link_model=MemberSkillsLink,
    )
    uploads: list["Upload"] = Relationship(
        back_populates="members",
        link_model=MemberUploadsLink,
    )


class MemberOut(MemberBase):
    id: int
    belongs_to: int
    owner_of: int | None
    skills: list["Skill"]
    uploads: list["Upload"]


class MembersOut(SQLModel):
    data: list[MemberOut]
    count: int


# ===============SKILL========================


class SkillBase(SQLModel):
    name: str
    description: str
    display_name: str | None = None
    managed: bool = False
    tool_definition: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    input_parameters: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSON)  # 用于存储输入参数
    )
    credentials: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSON)  # 新增字段,用于存储凭证信息
    )


class SkillCreate(SkillBase):
    tool_definition: dict[str, Any]  # Tool definition is required if not managed
    managed: bool = Field(default=False, const=False)  # Managed must be False
    credentials: dict[str, Any] | None = None  # 新增字段


class SkillUpdate(SkillBase):
    name: str | None = None  # type: ignore[assignment]
    description: str | None = None  # type: ignore[assignment]
    managed: bool | None = None  # type: ignore[assignment]
    tool_definition: dict[str, Any] | None = None
    credentials: dict[str, Any] | None = None  # 新增字段


class Skill(SkillBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    members: list["Member"] = Relationship(
        back_populates="skills",
        link_model=MemberSkillsLink,
    )
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="skills")


class SkillsOut(SQLModel):
    data: list["SkillOut"]
    count: int


class SkillOut(SkillBase):
    id: int


class ToolDefinitionValidate(SQLModel):
    tool_definition: dict[str, Any]


# ==============CHECKPOINT=====================


class Checkpoint(SQLModel, table=True):
    __tablename__ = "checkpoints"
    __table_args__ = (
        PrimaryKeyConstraint("thread_id", "checkpoint_id", "checkpoint_ns"),
    )
    thread_id: UUID = Field(foreign_key="thread.id", primary_key=True)
    checkpoint_ns: str = Field(
        sa_column=Column(
            "checkpoint_ns", String, nullable=False, server_default="", primary_key=True
        ),
    )
    checkpoint_id: UUID = Field(primary_key=True)
    parent_checkpoint_id: UUID | None
    type: str | None
    checkpoint: dict[Any, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    metadata_: dict[Any, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"),
    )
    thread: Thread = Relationship(back_populates="checkpoints")
    created_at: datetime | None = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=func.now(),
            server_default=func.now(),
        )
    )


class CheckpointBlobs(SQLModel, table=True):
    __tablename__ = "checkpoint_blobs"
    __table_args__ = (
        PrimaryKeyConstraint("thread_id", "checkpoint_ns", "channel", "version"),
    )
    thread_id: UUID = Field(foreign_key="thread.id", primary_key=True)
    checkpoint_ns: str = Field(
        sa_column=Column(
            "checkpoint_ns", String, nullable=False, server_default="", primary_key=True
        ),
    )
    channel: str = Field(primary_key=True)
    version: str = Field(primary_key=True)
    type: str
    blob: bytes | None
    thread: Thread = Relationship(back_populates="checkpoint_blobs")


class CheckpointOut(SQLModel):
    thread_id: UUID
    checkpoint_id: UUID
    checkpoint: bytes
    created_at: datetime


class Write(SQLModel, table=True):
    __tablename__ = "checkpoint_writes"
    __table_args__ = (
        PrimaryKeyConstraint(
            "thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx"
        ),
    )
    thread_id: UUID = Field(foreign_key="thread.id", primary_key=True)
    checkpoint_ns: str = Field(
        sa_column=Column(
            "checkpoint_ns", String, nullable=False, server_default="", primary_key=True
        ),
    )
    checkpoint_id: UUID = Field(primary_key=True)
    task_id: UUID = Field(primary_key=True)
    idx: int = Field(primary_key=True)
    channel: str
    type: str | None
    blob: bytes
    thread: Thread = Relationship(back_populates="writes")


# ==============Uploads=====================


class UploadBase(SQLModel):
    name: str
    description: str
    file_type: str  # 新��字段，用于储文件类型
    web_url: str | None = None  # 新增字段，用于存储网页 URL


class UploadCreate(UploadBase):
    chunk_size: int
    chunk_overlap: int


class UploadUpdate(UploadBase):
    name: str | None = None
    description: str | None = None
    last_modified: datetime
    file_type: str | None = None
    web_url: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None


class UploadStatus(str, Enum):
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    FAILED = "Failed"


class Upload(UploadBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="uploads")
    members: list["Member"] = Relationship(
        back_populates="uploads",
        link_model=MemberUploadsLink,
    )
    last_modified: datetime = Field(default_factory=lambda: datetime.now())
    status: UploadStatus = Field(
        sa_column=Column(SQLEnum(UploadStatus), nullable=False)
    )
    chunk_size: int
    chunk_overlap: int


class UploadOut(UploadBase):
    id: int
    name: str
    last_modified: datetime
    status: UploadStatus
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    file_type: str
    web_url: str | None
    chunk_size: int
    chunk_overlap: int


class UploadsOut(SQLModel):
    data: list[UploadOut]
    count: int


# ==============Models=====================


class ModelProviderBase(SQLModel):
    provider_name: str = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$", unique=True)
    base_url: str | None = None
    api_key: str | None = None
    icon: str | None = None
    description: str


class ModelProviderCreate(ModelProviderBase):
    pass


class ModelProviderUpdate(ModelProviderBase):
    provider_name: str | None = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$", default=None, unique=True)  # type: ignore[assignment]
    description: str | None = None


class ModelProvider(ModelProviderBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    provider_name: str = Field(max_length=64)
    base_url: str | None = Field(default=None)
    api_key: str | None = Field(default=None)
    icon: str | None = Field(default=None)
    description: str | None = Field(default=None, max_length=256)

    @property
    def encrypted_api_key(self) -> str | None:
        """返回加密的API密钥，用于API响应"""
        if self.api_key:
            return self.api_key  # 已经是加密的
        return None

    @property
    def decrypted_api_key(self) -> str | None:
        """获取解密后的API密钥，用于内部业务逻辑"""
        if self.api_key:
            return security_manager.decrypt_api_key(self.api_key)
        return None

    def set_api_key(self, value: str | None) -> None:
        """设置并加密API密钥"""
        if value:
            self.api_key = security_manager.encrypt_api_key(value)
        else:
            self.api_key = None

    # Relationship with Model
    models: list["Models"] = Relationship(
        back_populates="provider", cascade_delete="all, delete-orphan"
    )


class ModelCategory(str, Enum):
    LLM = "llm"
    CHAT = "chat"
    TEXT_EMBEDDING = "text-embedding"
    RERANK = "rerank"
    SPEECH_TO_TEXT = "speech-to-text"
    TEXT_TO_SPEECH = "text-to-speech"


class ModelCapability(str, Enum):
    VISION = "vision"


class ModelsBase(SQLModel):
    ai_model_name: str = PydanticField(pattern=r"^[a-zA-Z0-9/_:.-]{1,64}$", unique=True)
    provider_id: int
    categories: list[ModelCategory] = Field(sa_column=Column(ARRAY(String)))
    capabilities: list[ModelCapability] = Field(
        sa_column=Column(ARRAY(String)), default=[]
    )


class Models(ModelsBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ai_model_name: str = Field(max_length=128)
    provider_id: int = Field(foreign_key="modelprovider.id")
    categories: list[ModelCategory] = Field(sa_column=Column(ARRAY(String)))
    capabilities: list[ModelCapability] = Field(
        sa_column=Column(ARRAY(String)), default=[]
    )
    meta_: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"),
    )
    # Relationship with ModelProvider
    provider: ModelProvider = Relationship(back_populates="models")


# Properties to return via API
class ModelProviderOut(SQLModel):
    id: int
    provider_name: str
    base_url: str | None
    api_key: str | None
    icon: str | None
    description: str | None

    class Config:
        from_attributes = True


class ModelOut(SQLModel):
    id: int
    ai_model_name: str
    categories: list[ModelCategory]
    capabilities: list[ModelCapability]
    provider: ModelProviderOut


class ModelsOut(SQLModel):
    data: list[ModelOut]
    count: int


class ModelOutIdWithAndName(SQLModel):
    id: int
    ai_model_name: str
    categories: list[ModelCategory]
    capabilities: list[ModelCapability]


class ModelProviderWithModelsListOut(SQLModel):
    id: int
    provider_name: str
    base_url: str | None
    api_key: str | None
    icon: str | None
    description: str | None
    models: list[ModelOutIdWithAndName]


class ProvidersListWithModelsOut(SQLModel):
    providers: list[ModelProviderWithModelsListOut]


# ==============Graph=====================


class GraphBase(SQLModel):
    name: str = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    description: str | None = None
    config: dict[Any, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    metadata_: dict[Any, Any] = Field(
        default_factory=dict,
        sa_column=Column("metadata", JSONB, nullable=False, server_default="{}"),
    )


class GraphCreate(GraphBase):
    created_at: datetime
    updated_at: datetime


class GraphUpdate(GraphBase):
    name: str | None = None
    updated_at: datetime


class Graph(GraphBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="graphs")
    team_id: int = Field(foreign_key="team.id", nullable=False)
    team: Team = Relationship(back_populates="graphs")
    created_at: datetime | None = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=func.now(),
            server_default=func.now(),
        )
    )
    updated_at: datetime | None = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=func.now(),
            onupdate=func.now(),
            server_default=func.now(),
        )
    )


class GraphOut(GraphBase):
    id: int


class GraphsOut(SQLModel):
    data: list[GraphOut]
    count: int


# ==============Api Keys=====================
class ApiKeyBase(SQLModel):
    description: str | None = "Default API Key Description"


class ApiKeyCreate(ApiKeyBase):
    pass


class ApiKey(ApiKeyBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_key: str
    short_key: str
    team_id: int | None = Field(default=None, foreign_key="team.id", nullable=False)
    team: Team | None = Relationship(back_populates="apikeys")
    created_at: datetime | None = Field(
        default_factory=lambda: datetime.now(ZoneInfo("UTC"))
    )


class ApiKeyOut(ApiKeyBase):
    id: int | None = Field(default=None, primary_key=True)
    key: str
    created_at: datetime


class ApiKeyOutPublic(ApiKeyBase):
    id: int
    short_key: str
    created_at: datetime


class ApiKeysOutPublic(SQLModel):
    data: list[ApiKeyOutPublic]
    count: int
