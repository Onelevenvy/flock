import logging
import os

from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.core.model_providers.model_provider_manager import \
    model_provider_manager
from app.curd import users
from app.db.models import (AccessScope, ActionType, Group, ModelProvider,
                           Models, Resource, ResourceType, Role, RoleAccess,
                           User, UserCreate)

logger = logging.getLogger(__name__)


def get_url():
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "flock123456")
    server = os.getenv("POSTGRES_SERVER", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "flock")
    return f"postgresql+psycopg://{user}:{password}@{server}:{port}/{db}"


def init_default_roles_and_groups(session: Session, superuser: User) -> None:
    """Initialize default roles and groups"""
    # 创建默认角色
    admin_role = session.exec(select(Role).where(Role.name == "admin")).first()
    if not admin_role:
        admin_role = Role(
            name="admin", description="管理员角色，拥有所有权限", is_system_role=True
        )
        session.add(admin_role)

    normal_role = session.exec(select(Role).where(Role.name == "普通用户")).first()
    if not normal_role:
        normal_role = Role(
            name="普通用户",
            description="普通用户角色，具有基本访问权限",
            is_system_role=True,
            parent_role_id=None,
        )
        session.add(normal_role)

    # 创建默认用户组
    admin_group = session.exec(select(Group).where(Group.name == "管理员组")).first()
    if not admin_group:
        admin_group = Group(
            name="管理员组",
            description="管理员用户组，拥有所有权限",
            is_system_group=True,
            admin_id=superuser.id,  # 设置超级用户为管理员组的管理员
        )
        session.add(admin_group)

    default_group = session.exec(
        select(Group).where(Group.name == "默认用户组")
    ).first()
    if not default_group:
        default_group = Group(
            name="默认用户组",
            description="默认用户组，所有新用户默认加入此组",
            is_system_group=True,
            admin_id=superuser.id,  # 设置超级用户为默认组的管理员
        )
        session.add(default_group)

    session.flush()  # 确保所有对象都有ID

    # 将普通用户角色关联到默认用户组
    if normal_role and default_group and normal_role.group_id != default_group.id:
        normal_role.group_id = default_group.id
        session.add(normal_role)

    # 将管理员角色关联到管理员组
    if admin_role and admin_group and admin_role.group_id != admin_group.id:
        admin_role.group_id = admin_group.id
        session.add(admin_role)

    # 创建默认资源类型
    for resource_type in ResourceType:
        resource = session.exec(
            select(Resource).where(
                Resource.name == f"{resource_type.value}_resource",
                Resource.resource_id == None,
            )
        ).first()

        if not resource:
            resource = Resource(
                name=f"{resource_type.value}_resource",
                description=f"Default resource for {resource_type.value}",
                type=resource_type,
                resource_id=None,  # 这是资源类型级别的权限
            )
            session.add(resource)

    session.flush()

    # 设置默认权限
    # 管理员角色获得所有资源的所有权限
    for resource in session.exec(select(Resource)).all():
        for action in ActionType:
            role_access = session.exec(
                select(RoleAccess).where(
                    RoleAccess.role_id == admin_role.id,
                    RoleAccess.resource_id == resource.id,
                    RoleAccess.action == action,
                )
            ).first()

            if not role_access:
                role_access = RoleAccess(
                    role_id=admin_role.id,
                    resource_id=resource.id,
                    action=action,
                    scope=AccessScope.GLOBAL,
                )
                session.add(role_access)

    # 普通用户角色获得基本权限
    for resource in session.exec(select(Resource)).all():
        # 普通用户只能读取和执行
        for action in [ActionType.READ, ActionType.EXECUTE]:
            role_access = session.exec(
                select(RoleAccess).where(
                    RoleAccess.role_id == normal_role.id,
                    RoleAccess.resource_id == resource.id,
                    RoleAccess.action == action,
                )
            ).first()

            if not role_access:
                role_access = RoleAccess(
                    role_id=normal_role.id,
                    resource_id=resource.id,
                    action=action,
                    scope=AccessScope.PERSONAL,  # 普通用户只能访问自己的资源
                )
                session.add(role_access)

    # 将超级用户添加到管理员组和角色
    if superuser:
        # 添加到管理员角色
        if admin_role not in superuser.roles:
            superuser.roles.append(admin_role)

        # 添加到管理员组
        if admin_group not in superuser.groups:
            superuser.groups.append(admin_group)

    session.commit()


engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
# engine = create_engine(get_url())


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/tiangolo/full-stack-fastapi-template/issues/28


from app.core.tools.tool_manager import get_all_tool_providers
from app.db.models import Tool, ToolProvider, ToolType


def init_db(session: Session) -> None:
    # 创建超级用户
    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            full_name="admin",
            is_superuser=True,
        )
        user = users.create_user(session=session, user_create=user_in)

    # 初始化默认角色和用户组
    init_default_roles_and_groups(session, user)

    # 获取或创建skill资源类型
    skill_resource = session.exec(
        select(Resource).where(
            Resource.name == f"{ResourceType.SKILL.value}_resource",
            Resource.resource_id == None,
        )
    ).first()

    if not skill_resource:
        skill_resource = Resource(
            name=f"{ResourceType.SKILL.value}_resource",
            description=f"Default resource for {ResourceType.SKILL.value}",
            type=ResourceType.SKILL,
            resource_id=None,
        )
        session.add(skill_resource)
        session.flush()

    # 现在处理skills
    providers = get_all_tool_providers()
    for provider_name, provider_info in providers.items():
        db_provider = session.exec(
            select(ToolProvider).where(ToolProvider.provider_name == provider_name)
        ).first()

        # 根据credentials判断是否需要鉴权
        needs_auth = provider_info.credentials and provider_info.credentials != {}

        # 不需要鉴权的provider默认可用，需要鉴权的默认不可用
        is_available = not needs_auth

        if db_provider:
            db_provider.icon = provider_info.icon
            db_provider.description = provider_info.description
            db_provider.display_name = provider_info.display_name
            # 保留原有字段
            if hasattr(provider_info, "mcp_endpoint_url"):
                db_provider.mcp_endpoint_url = provider_info.mcp_endpoint_url
            if hasattr(provider_info, "mcp_server_id"):
                db_provider.mcp_server_id = provider_info.mcp_server_id
            if hasattr(provider_info, "mcp_connection_type"):
                db_provider.mcp_connection_type = provider_info.mcp_connection_type
            if hasattr(provider_info, "tool_type"):
                db_provider.tool_type = provider_info.tool_type
            else:
                # 默认设置为内置工具
                db_provider.tool_type = ToolType.BUILTIN

            # 如果数据库中没有凭据，则使用配置中的凭据
            if not db_provider.credentials:
                db_provider.credentials = provider_info.credentials

            # 只有在数据库中没有设置is_available时才设置默认值
            # 这样可以保留已经鉴权过的状态
            if db_provider.is_available is None:
                db_provider.is_available = is_available
        else:
            # 创建新的提供者时，设置默认值
            provider_args = {
                "provider_name": provider_name,
                "display_name": provider_info.display_name,
                "icon": provider_info.icon,
                "description": provider_info.description,
                "credentials": provider_info.credentials,
                "is_available": is_available,
                "tool_type": getattr(provider_info, "tool_type", ToolType.BUILTIN),
            }

            # 添加可选字段
            if hasattr(provider_info, "mcp_endpoint_url"):
                provider_args["mcp_endpoint_url"] = provider_info.mcp_endpoint_url
            if hasattr(provider_info, "mcp_server_id"):
                provider_args["mcp_server_id"] = provider_info.mcp_server_id
            if hasattr(provider_info, "mcp_connection_type"):
                provider_args["mcp_connection_type"] = provider_info.mcp_connection_type

            db_provider = ToolProvider(**provider_args)
            session.add(db_provider)
        session.flush()

        # 处理Tool
        existing_tools = session.exec(
            select(Tool).where(Tool.provider_id == db_provider.id)
        ).all()
        existing_tools_dict = {tool.name: tool for tool in existing_tools}

        for tool_info in provider_info.tools:
            tool_name = tool_info.name

            # 根据provider是否可用决定tool的在线状态
            # 不需要鉴权的provider下的tool默认在线
            # 需要鉴权的provider下的tool默认离线
            is_online = db_provider.is_available

            if tool_name in existing_tools_dict:
                existing_tool = existing_tools_dict[tool_name]
                existing_tool.description = tool_info.description
                existing_tool.display_name = tool_info.display_name
                existing_tool.input_parameters = tool_info.input_parameters
                existing_tool.tool_definition = tool_info.tool_definition or {}

                # 只有在数据库中没有设置is_online时才设置默认值
                # 这样可以保留已经鉴权过的状态
                if existing_tool.is_online is None:
                    existing_tool.is_online = is_online

                session.add(existing_tool)
            else:
                # 创建新工具时，设置默认值
                tool_args = {
                    "name": tool_name,
                    "description": tool_info.description,
                    "managed": tool_info.managed,
                    "display_name": tool_info.display_name,
                    "input_parameters": tool_info.input_parameters,
                    "tool_definition": tool_info.tool_definition or {},
                    "provider_id": db_provider.id,
                    "is_online": is_online,  # 根据provider可用性设置
                }
                new_tool = Tool(**tool_args)
                session.add(new_tool)

        # 删除不再存在的tool
        for tool_name in list(existing_tools_dict.keys()):
            if tool_name not in [t.name for t in provider_info.tools]:
                session.delete(existing_tools_dict[tool_name])
    session.commit()


def init_modelprovider_model_db(session: Session) -> None:
    providers = model_provider_manager.get_all_providers()

    # 获取数据库中所有现有的providers
    existing_providers = session.exec(select(ModelProvider)).all()
    existing_provider_names = {p.provider_name for p in existing_providers}

    # 处理现有的和新的providers
    for provider_name in sorted(providers.keys()):
        provider_data = providers[provider_name]

        db_provider = session.exec(
            select(ModelProvider).where(
                ModelProvider.provider_name == provider_data["provider_name"]
            )
        ).first()

        if db_provider:
            db_provider.icon = provider_data["icon"]
            db_provider.description = provider_data["description"]
            if not db_provider.api_key:
                db_provider.set_api_key(provider_data["api_key"])
                # 如果设置了新的API密钥，默认设置为未鉴权（不可用）
                db_provider.is_available = False
        else:
            db_provider = ModelProvider(
                provider_name=provider_data["provider_name"],
                base_url=provider_data["base_url"],
                icon=provider_data["icon"],
                description=provider_data["description"],
                is_available=False,  # 新创建的提供商默认设置为不可用，需要鉴权
            )
            db_provider.set_api_key(provider_data["api_key"])
            session.add(db_provider)

        session.flush()

        supported_models = model_provider_manager.get_supported_models(provider_name)
        existing_models = {
            model.ai_model_name: model
            for model in session.exec(
                select(Models).where(Models.provider_id == db_provider.id)
            )
        }

        for model_info in supported_models:
            # 准备元数据
            meta_ = {}
            if "dimension" in model_info:
                meta_["dimension"] = model_info["dimension"]

            if model_info["name"] in existing_models:
                model = existing_models[model_info["name"]]
                model.categories = model_info["categories"]
                model.capabilities = model_info["capabilities"]
                # 更新元数据
                model.meta_ = meta_
                # 不修改现有模型的is_online状态，保持原状态
            else:
                new_model = Models(
                    ai_model_name=model_info["name"],
                    provider_id=db_provider.id,
                    categories=model_info["categories"],
                    capabilities=model_info["capabilities"],
                    is_online=False,  # 新模型默认为离线，直到提供商鉴权通过
                    meta_=meta_,  # 添加元数据
                )
                session.add(new_model)

        for model_name in set(existing_models.keys()) - set(
            model["name"] for model in supported_models
        ):
            session.delete(existing_models[model_name])

    # 删除不再存在的providers
    providers_to_remove = existing_provider_names - set(providers.keys())
    for provider_name in providers_to_remove:
        provider_to_delete = session.exec(
            select(ModelProvider).where(ModelProvider.provider_name == provider_name)
        ).first()
        if provider_to_delete:
            # 由于设置了cascade="all, delete-orphan"，删除provider时会自动删除关联的models
            session.delete(provider_to_delete)
            logger.info(f"Removed provider {provider_name} and its associated models")

    session.commit()

    # 打印当前数据库状态
    # providers = session.exec(select(ModelProvider).order_by(ModelProvider.id)).all()
    # for provider in providers:
    #     print(f"\nProvider: {provider.provider_name} (ID: {provider.id})")
    #     # print(f"  Base URL: {provider.base_url}")
    #     # print(f"  API Key: {'***************'  if provider.api_key else 'None'}")
    #     # print(f"  Description: {provider.description}")
    #     models = session.exec(
    #         select(Models).where(Models.provider_id == provider.id).order_by(Models.id)
    #     ).all()
    #     for model in models:
    #         print(f"\n  - Model: {model.ai_model_name} (ID: {model.id})")
    #         print(f"    Categories: {', '.join(model.categories)}")
    #         print(f"    Capabilities: {', '.join(model.capabilities)}")
    #         print(f"    Metadata: {model.meta_}")
