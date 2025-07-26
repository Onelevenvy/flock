from typing import Any, Sequence

from sqlmodel import Session, select

from app.db.models import (ProvidersListWithToolsOut, Tool,
                           ToolOutIdWithAndName, ToolProvider,
                           ToolProviderUpdate, ToolProviderWithToolsListOut)


def create_tool_provider(session: Session, tool_provider: ToolProvider) -> ToolProvider:
    """创建工具提供者"""
    db_provider = ToolProvider.model_validate(tool_provider)
    # 移除 api_key 相关操作
    session.add(db_provider)
    session.commit()
    session.refresh(db_provider)
    return db_provider


def get_tool_provider(session: Session, tool_provider_id: int) -> ToolProvider | None:
    """获取工具提供者"""
    return session.get(ToolProvider, tool_provider_id)


def get_tool_provider_with_tools(
    session: Session, tool_provider_id: int
) -> ToolProviderWithToolsListOut | None:
    """获取工具提供者及其工具列表"""
    provider = session.get(ToolProvider, tool_provider_id)
    if not provider:
        return None

    tools = [
        ToolOutIdWithAndName(
            id=tool.id,
            name=tool.name,
            description=tool.description or "",
            display_name=tool.display_name,
            input_parameters=tool.input_parameters,
            is_online=tool.is_online,
        )
        for tool in provider.tools
    ]

    return ToolProviderWithToolsListOut(
        id=provider.id,
        provider_name=provider.provider_name,
        display_name=provider.display_name,
        mcp_endpoint_url=provider.mcp_endpoint_url,
        mcp_server_id=provider.mcp_server_id,
        mcp_connection_type=provider.mcp_connection_type,
        icon=provider.icon,
        description=provider.description,
        credentials=provider.credentials,
        is_available=provider.is_available,
        tools=tools,
    )


def get_tool_provider_list_with_tools(
    session: Session,
) -> ProvidersListWithToolsOut | None:
    """获取所有工具提供者及其工具列表"""
    providers = session.exec(
        select(ToolProvider).order_by(ToolProvider.provider_name)
    ).all()
    if not providers:
        return None

    provider_list = []
    for provider in providers:
        tools = [
            ToolOutIdWithAndName(
                id=tool.id,
                name=tool.name,
                description=tool.description or "",
                display_name=tool.display_name,
                input_parameters=tool.input_parameters,
                is_online=tool.is_online,
            )
            for tool in provider.tools
        ]

        provider_list.append(
            ToolProviderWithToolsListOut(
                id=provider.id,
                provider_name=provider.provider_name,
                display_name=provider.display_name,
                mcp_endpoint_url=provider.mcp_endpoint_url,
                mcp_server_id=provider.mcp_server_id,
                mcp_connection_type=provider.mcp_connection_type,
                icon=provider.icon,
                tool_type=provider.tool_type,
                description=provider.description,
                credentials=provider.credentials,
                is_available=provider.is_available,
                tools=tools,
            )
        )

    return ProvidersListWithToolsOut(providers=provider_list)


def update_tool_provider(
    session: Session, tool_provider_id: int, tool_provider_update: ToolProviderUpdate
) -> ToolProvider | None:
    """更新工具提供者"""
    db_provider = session.get(ToolProvider, tool_provider_id)
    if not db_provider:
        return None

    update_data = tool_provider_update.model_dump(exclude_unset=True)
    # 移除 api_key 相关操作

    for field, value in update_data.items():
        setattr(db_provider, field, value)

    session.add(db_provider)
    session.commit()
    session.refresh(db_provider)
    return db_provider


def delete_tool_provider(
    session: Session, tool_provider_id: int
) -> ToolProvider | None:
    """删除工具提供者"""
    db_provider = session.get(ToolProvider, tool_provider_id)
    if not db_provider:
        return None

    session.delete(db_provider)
    session.commit()
    return db_provider


def sync_provider_tools(
    session: Session, provider_id: int, config_tools: Sequence[dict[str, Any]]
) -> list[Tool]:
    """同步工具提供者的工具配置到数据库"""
    provider = session.get(ToolProvider, provider_id)
    if not provider:
        return []

    # 获取现有工具
    existing_tools = {tool.name: tool for tool in provider.tools}
    synced_tools = []

    # 更新或创建工具
    for tool_config in config_tools:
        tool_name = tool_config["name"]
        if tool_name in existing_tools:
            # 更新现有工具
            tool = existing_tools[tool_name]
            for key, value in tool_config.items():
                setattr(tool, key, value)
        else:
            # 创建新工具
            tool = Tool(provider_id=provider_id, **tool_config)
            session.add(tool)
        synced_tools.append(tool)

    # 删除不再存在的工具
    for tool in provider.tools:
        if tool.name not in {t["name"] for t in config_tools}:
            session.delete(tool)

    session.commit()
    return synced_tools
