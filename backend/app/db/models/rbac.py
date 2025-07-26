from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlmodel import Field, Relationship, SQLModel


# =================================================================
# 1. 枚举类型 (Enums) - 保持不变
# =================================================================
class ResourceType(str, Enum):
    """资源类型枚举"""

    TEAM = "team"
    MEMBER = "member"
    SKILL = "skill"
    UPLOAD = "upload"
    GRAPH = "graph"
    SUBGRAPH = "subgraph"
    API_KEY = "api_key"
    MODEL = "model"
    SYSTEM = "system"

    TOOL_PROVIDER = "tool_provider"
    TOOL = "tool"


class ActionType(str, Enum):
    """操作类型枚举"""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    MANAGE = "manage"  # 代表所有权限


class AccessScope(str, Enum):
    """访问范围枚举"""

    GLOBAL = "global"  # 全局
    GROUP = "group"  # 组内
    PERSONAL = "personal"  # 个人


# =================================================================
# 2. 核心实体模型 (Core Entities)
# =================================================================


# ============== USER =========================
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = None
    language: str = Field(default="en-US")


class User(UserBase, table=True):
    """用户模型 - 对应 users 表"""

    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str

    # 与角色和组的多对多关系
    roles: List["Role"] = Relationship(back_populates="users", link_model="UserRole")
    groups: List["Group"] = Relationship(back_populates="users", link_model="UserGroup")

    # 【新增】作为管理员所管理的组
    owned_groups: List["Group"] = Relationship(back_populates="admin")


# ============== GROUP (部门/用户组) =========================
class GroupBase(SQLModel):
    name: str = Field(unique=True, index=True)
    description: str | None = None
    parent_id: int | None = Field(default=None, foreign_key="group.id")
    # 【新增】管理员ID
    admin_id: int | None = Field(default=None, foreign_key="user.id")


class Group(GroupBase, table=True):
    """组/部门模型 - 对应 groups 表"""

    id: int | None = Field(default=None, primary_key=True)

    # 与父级组的自关联关系
    parent: Optional["Group"] = Relationship(
        back_populates="children", sa_relationship_kwargs={"remote_side": "Group.id"}
    )
    children: List["Group"] = Relationship(back_populates="parent")

    # 【新增】与管理员用户的关系
    admin: Optional[User] = Relationship(back_populates="owned_groups")

    # 与用户和角色的多对多关系
    users: List["User"] = Relationship(back_populates="groups", link_model="UserGroup")
    roles: List["Role"] = Relationship(back_populates="groups", link_model="GroupRole")


# ============== ROLE (角色) =========================
class RoleBase(SQLModel):
    name: str = Field(unique=True, index=True)
    description: str | None = None
    is_system_role: bool = False


class Role(RoleBase, table=True):
    """角色模型 - 对应 roles 表"""

    id: int | None = Field(default=None, primary_key=True)

    users: List["User"] = Relationship(back_populates="roles", link_model="UserRole")
    groups: List["Group"] = Relationship(back_populates="roles", link_model="GroupRole")
    permissions: List["RolePermission"] = Relationship(back_populates="role")


# ============== RESOURCE (资源) =========================
class ResourceBase(SQLModel):
    name: str = Field(unique=True, index=True)
    description: str | None = None
    type: ResourceType = Field(sa_column=Column(String, nullable=False))


class Resource(ResourceBase, table=True):
    """资源模型 - 对应 resources 表"""

    id: int | None = Field(default=None, primary_key=True)
    role_permissions: List["RolePermission"] = Relationship(back_populates="resource")


# ============== ACTION (操作) =========================
class ActionBase(SQLModel):
    name: ActionType = Field(unique=True, index=True)
    description: str | None = None


class Action(ActionBase, table=True):
    """操作模型 - 对应 actions 表"""

    id: int | None = Field(default=None, primary_key=True)
    role_permissions: List["RolePermission"] = Relationship(back_populates="action")


# =================================================================
# 3. 关系模型 (Association / Link Models)
# =================================================================


class UserRole(SQLModel, table=True):
    """用户-角色 关联表 (多对多)"""

    user_id: int | None = Field(default=None, foreign_key="user.id", primary_key=True)
    role_id: int | None = Field(default=None, foreign_key="role.id", primary_key=True)


class UserGroup(SQLModel, table=True):
    """用户-组 关联表 (多对多)"""

    user_id: int | None = Field(default=None, foreign_key="user.id", primary_key=True)
    group_id: int | None = Field(default=None, foreign_key="group.id", primary_key=True)


class GroupRole(SQLModel, table=True):
    """【新增】组-角色 关联表 (多对多)"""

    group_id: int | None = Field(default=None, foreign_key="group.id", primary_key=True)
    role_id: int | None = Field(default=None, foreign_key="role.id", primary_key=True)


class RolePermission(SQLModel, table=True):
    """角色-权限 定义表 (核心) - 对应 role_permissions 表"""

    __tablename__ = "role_permissions"

    id: int | None = Field(default=None, primary_key=True)
    role_id: int = Field(foreign_key="role.id")
    resource_id: int = Field(foreign_key="resource.id")
    action_id: int = Field(foreign_key="action.id")
    scope: AccessScope = Field(default=AccessScope.GLOBAL)

    role: Role = Relationship(back_populates="permissions")
    resource: Resource = Relationship(back_populates="role_permissions")
    action: Action = Relationship(back_populates="role_permissions")


# =================================================================
# 4. 审计日志模型 (Audit Log) - 保持不变
# =================================================================
class RBACAuditLog(SQLModel, table=True):
    """RBAC相关操作的审计日志"""

    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
        )
    )
    actor_id: int = Field(foreign_key="user.id")
    action: str
    target_type: str
    target_id: int
    details: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))


# =================================================================
# 5. API数据模型 (Pydantic-like Schemas for FastAPI)
# =================================================================


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int


class GroupCreate(GroupBase):
    pass


class GroupOut(GroupBase):
    id: int
    children: List["GroupOut"] = []


GroupOut.model_rebuild()
