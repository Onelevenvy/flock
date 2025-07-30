import re
from enum import Enum
from typing import Any

from pydantic import Field as PydanticField
from pydantic import field_validator
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from .rbac import Group, User


class ToolType(str, Enum):
    BUILTIN = "builtin"
    API = "api"
    MCP = "mcp"


class ToolProviderBase(SQLModel):
    provider_name: str = PydanticField(
        pattern=r"^[\w\u4e00-\u9fa5_-]{1,64}$", unique=True
    )
    mcp_endpoint_url: str | None = None
    mcp_server_id: str | None = None
    mcp_connection_type: str | None = None
    icon: str | None = None
    description: str | None = None
    credentials: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSONB)
    )
    is_available: bool | None = None
    tool_type: ToolType = Field(default=ToolType.BUILTIN)

    @field_validator("mcp_server_id")
    def validate_mcp_server_id(cls, v):
        """验证 mcp_server_id 字段，确保非空值符合正则表达式模式"""
        if v is not None and not re.match(r"^[a-zA-Z0-9_-]{1,24}$", v):
            raise ValueError("mcp_server_id must match pattern ^[a-zA-Z0-9_-]{1,24}$")
        return v


class ToolProviderCreate(ToolProviderBase):
    display_name: str | None = None


class ToolProviderUpdate(ToolProviderBase):
    provider_name: str | None = PydanticField(pattern=r"^[\w\u4e00-\u9fa5_-]{1,64}$", default=None, unique=True)  # type: ignore[assignment]
    display_name: str | None = None
    description: str | None = None
    is_available: bool | None = None


class ToolProvider(ToolProviderBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    provider_name: str = Field(max_length=64)
    display_name: str | None = Field(default=None, max_length=128)
    mcp_endpoint_url: str | None = Field(default=None, unique=True)
    mcp_server_id: str | None = Field(default=None, unique=True)
    mcp_connection_type: str | None = Field(default=None)
    icon: str | None = Field(default=None)
    description: str | None = Field(default=None, max_length=256)
    credentials: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSONB)
    )
    is_available: bool = Field(default=False, nullable=True)

    def encrypt_credentials(self) -> None:
        """Encrypt sensitive values in credentials"""
        if not self.credentials:
            return

        # 在方法内部导入security_manager
        from app.core.security import security_manager

        encrypted_credentials = {}
        for key, cred_info in self.credentials.items():
            if isinstance(cred_info, dict) and "value" in cred_info:
                # Create a new dict to avoid modifying the original
                encrypted_credentials[key] = {
                    **cred_info,
                    "value": (
                        security_manager.encrypt_api_key(cred_info["value"])
                        if cred_info["value"]
                        else ""
                    ),
                }

        # Update credentials with encrypted values
        if encrypted_credentials:
            self.credentials = encrypted_credentials

    def decrypt_credentials(self) -> None:
        """Decrypt sensitive values in credentials"""
        if not self.credentials:
            return

        # 在方法内部导入security_manager
        from app.core.security import security_manager

        decrypted_credentials = {}
        for key, cred_info in self.credentials.items():
            if isinstance(cred_info, dict) and "value" in cred_info:
                # Create a new dict to avoid modifying the original
                decrypted_credentials[key] = {
                    **cred_info,
                    "value": (
                        security_manager.decrypt_api_key(cred_info["value"])
                        if cred_info["value"]
                        else ""
                    ),
                }

        # Update credentials with decrypted values
        if decrypted_credentials:
            self.credentials = decrypted_credentials

    # Relationship with Tool
    tools: list["Tool"] = Relationship(
        back_populates="provider",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class ToolBase(SQLModel):
    name: str = PydanticField(pattern=r"^[a-zA-Z0-9_-]{1,64}$", unique=True)
    description: str
    display_name: str | None = None
    managed: bool = False
    tool_definition: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSONB)
    )
    input_parameters: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSONB)
    )
    provider_id: int
    is_online: bool = False


class ToolCreate(ToolBase):
    tool_definition: dict[str, Any]
    managed: bool = Field(default=False, const=False)


class ToolUpdate(ToolBase):
    name: str | None = None  # type: ignore[assignment]
    description: str | None = None  # type: ignore[assignment]
    managed: bool | None = None  # type: ignore[assignment]
    tool_definition: dict[str, Any] | None = None
    is_online: bool | None = None  # type: ignore[assignment]


class Tool(ToolBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int | None = Field(default=None, foreign_key="user.id")
    group_id: int | None = Field(default=None, foreign_key="group.id")
    provider_id: int = Field(foreign_key="toolprovider.id")
    name: str = Field(max_length=64)
    description: str | None = Field(default=None, max_length=256)
    display_name: str | None = Field(default=None, max_length=128)
    managed: bool = Field(default=False)
    tool_definition: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSONB)
    )
    input_parameters: dict[str, Any] | None = Field(
        default_factory=dict, sa_column=Column(JSONB)
    )
    is_online: bool = Field(default=True, nullable=True)

    members: list["Member"] = Relationship(
        back_populates="tools",
        link_model=MemberSkillsLink,
    )
    # Relationship with ToolProvider
    provider: ToolProvider = Relationship(back_populates="tools")
    owner: User | None = Relationship(back_populates="tools")
    group: Group | None = Relationship(back_populates="tools")


# Properties to return via API
class ToolProviderOut(SQLModel):
    id: int
    provider_name: str
    display_name: str | None
    mcp_endpoint_url: str | None
    mcp_server_id: str | None
    mcp_connection_type: str | None
    icon: str | None
    tool_type: ToolType
    description: str | None
    credentials: dict[str, Any] | None
    is_available: bool | None = None

    class Config:
        from_attributes = True


class MCPProviderOut(SQLModel):
    id: int
    provider_name: str
    mcp_endpoint_url: str
    mcp_server_id: str
    mcp_connection_type: str
    icon: str | None = None

    class Config:
        from_attributes = True


class ToolOut(SQLModel):
    id: int
    name: str
    description: str
    display_name: str | None
    managed: bool
    tool_definition: dict[str, Any] | None
    input_parameters: dict[str, Any] | None
    is_online: bool | None = None
    provider: ToolProviderOut


class ToolsOut(SQLModel):
    data: list[ToolOut]
    count: int


class ToolOutIdWithAndName(SQLModel):
    id: int
    name: str
    description: str
    display_name: str | None
    input_parameters: dict[str, Any] | None
    is_online: bool | None = None


class ToolProviderWithToolsListOut(SQLModel):
    id: int
    provider_name: str
    display_name: str | None
    mcp_endpoint_url: str | None
    mcp_server_id: str | None
    mcp_connection_type: str | None
    icon: str | None
    tool_type: ToolType
    description: str | None
    credentials: dict[str, Any] | None
    is_available: bool | None = None
    tools: list[ToolOutIdWithAndName]


class ProvidersListWithToolsOut(SQLModel):
    providers: list[ToolProviderWithToolsListOut]
