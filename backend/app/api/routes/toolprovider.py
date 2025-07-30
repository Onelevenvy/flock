from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.deps import SessionDep
from app.core.auth.tool_provider_auth import authenticate_tool_provider
from app.core.mcp.mcp_manage import MCPManager
from app.curd.toolprovider import (create_tool_provider, get_tool_provider,
                                   get_tool_provider_list_with_tools,
                                   get_tool_provider_with_tools,
                                   update_tool_provider)
from app.db.models import (MCPProviderOut, ProvidersListWithToolsOut,
                           ToolProvider, ToolProviderCreate, ToolProviderOut,
                           ToolProviderUpdate, ToolProviderWithToolsListOut,
                           ToolType)

router = APIRouter()


class MCPProviderCreate(BaseModel):
    provider_name: str
    mcp_endpoint_url: str
    mcp_server_id: str
    mcp_connection_type: str
    icon: str = None


class MCPConnectionTest(BaseModel):
    mcp_endpoint_url: str
    mcp_server_id: str
    mcp_connection_type: str


class MCPProviderUpdate(BaseModel):
    provider_name: str = None
    mcp_endpoint_url: str = None
    # mcp_server_id 不允许更新
    mcp_connection_type: str = None
    icon: str = None


@router.post("/", response_model=ToolProvider)
def create_provider(tool_provider: ToolProviderCreate, session: SessionDep):

    provider = create_tool_provider(session, tool_provider)
    if provider.credentials:
        provider.encrypt_credentials()
        session.add(provider)
        session.commit()
    return provider


@router.get("/{tool_provider_id}", response_model=ToolProviderOut)
def read_provider(tool_provider_id: int, session: SessionDep) -> Any:
    """
    Get provider by ID.
    """

    provider = get_tool_provider(session, tool_provider_id)
    if not provider:
        raise HTTPException(
            status_code=404,
            detail="The provider with this ID does not exist in the system",
        )
    if provider.credentials:
        provider.decrypt_credentials()

    response = ToolProviderOut(
        id=provider.id,
        provider_name=provider.provider_name,
        mcp_endpoint_url=provider.mcp_endpoint_url,
        mcp_server_id=provider.mcp_server_id,
        mcp_connection_type=provider.mcp_connection_type,
        icon=provider.icon,
        description=provider.description,
        credentials=provider.credentials,
        is_available=provider.is_available,
    )
    return response


@router.get(
    "/withtools/{tool_provider_id}", response_model=ToolProviderWithToolsListOut
)
def read_provider_with_tools(tool_provider_id: int, session: SessionDep):

    provider = get_tool_provider_with_tools(session, tool_provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="ToolProvider not found")

    if provider.credentials:
        provider.decrypt_credentials()

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
        tools=provider.tools,
    )


@router.get("/", response_model=ProvidersListWithToolsOut)
def read_provider_list_with_tools(session: SessionDep):

    providers = get_tool_provider_list_with_tools(session)
    if providers is None:
        raise HTTPException(status_code=404, detail="ToolProvider not found")

    for provider in providers.providers:
        if isinstance(provider, ToolProvider) and provider.credentials:
            provider.decrypt_credentials()

    return providers


@router.put("/{tool_provider_id}", response_model=ToolProviderOut)
def update_provider(
    tool_provider_id: int, provider_update: ToolProviderUpdate, session: SessionDep
) -> Any:
    """
    Update a provider.
    """

    provider = update_tool_provider(session, tool_provider_id, provider_update)
    if not provider:
        raise HTTPException(
            status_code=404,
            detail="The provider with this ID does not exist in the system",
        )

    if provider.credentials:
        provider.encrypt_credentials()
        session.add(provider)
        session.commit()

    # if provider.credentials:
    #     provider.decrypt_credentials()

    return ToolProviderOut(
        id=provider.id,
        display_name=provider.display_name,
        provider_name=provider.provider_name,
        mcp_endpoint_url=provider.mcp_endpoint_url,
        mcp_server_id=provider.mcp_server_id,
        mcp_connection_type=provider.mcp_connection_type,
        icon=provider.icon,
        description=provider.description,
        credentials=provider.credentials,
        is_available=provider.is_available,
        tool_type=provider.tool_type,
    )


# 添加删除工具提供者的端点
@router.delete("/{tool_provider_id}", response_model=ToolProviderOut)
async def delete_provider(tool_provider_id: int, session: SessionDep):
    """
    删除工具提供者
    """

    provider = session.get(ToolProvider, tool_provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Tool provider not found")

    # 删除提供者的所有工具
    for tool in provider.tools:
        session.delete(tool)

    # 删除提供者
    session.delete(provider)
    session.commit()

    return ToolProviderOut(
        id=provider.id,
        provider_name=provider.provider_name,
        display_name=provider.display_name,
        description=provider.description,
        is_available=provider.is_available,
        tool_type=provider.tool_type,
        credentials=provider.credentials,
        icon=provider.icon,
        mcp_endpoint_url=provider.mcp_endpoint_url,
        mcp_server_id=provider.mcp_server_id,
        mcp_connection_type=provider.mcp_connection_type,
    )


@router.post("/{tool_provider_id}/authenticate")
async def authenticate_provider(tool_provider_id: int, session: SessionDep):
    """
    对工具提供商进行鉴权或刷新工具列表
    """

    # 获取提供商信息
    provider = get_tool_provider(session, tool_provider_id)
    if not provider:
        raise HTTPException(
            status_code=404,
            detail="The provider with this ID does not exist in the system",
        )

    # 根据工具提供者类型选择不同的处理方式
    if provider.tool_type == ToolType.MCP:
        # MCP类型直接刷新工具列表，不需要鉴权
        if not provider.mcp_server_id:
            return {"success": False, "message": "MCP服务器ID未配置"}

        try:

            client = await MCPManager.initialize_mcp_client(
                {
                    provider.mcp_server_id: {
                        "url": provider.mcp_endpoint_url,
                        "transport": provider.mcp_connection_type,
                    }
                }
            )
            tools_list = await client.get_tools()
            # 更新提供者状态为可用
            provider.is_available = True
            session.add(provider)

            # 使用MCPManager中的sync_provider_tools同步工具到数据库
            from app.curd.toolprovider import sync_provider_tools

            # 准备工具配置
            tools_config = []
            for tool in tools_list:
                # 处理 args_schema，确保它是一个字典
                args_schema = tool.args_schema
                if hasattr(args_schema, "model_dump"):
                    args_schema = args_schema.model_dump()

                # 处理 args 属性
                input_params = getattr(tool, "args", {})
                if hasattr(input_params, "model_dump"):
                    input_params = input_params.model_dump()

                tool_config = {
                    "name": tool.name,
                    "description": tool.description,
                    "display_name": getattr(tool, "display_name", tool.name),
                    "managed": False,
                    "tool_definition": args_schema,  # 确保是字典
                    "input_parameters": input_params,  # 确保是字典
                    "is_online": True,
                }
                tools_config.append(tool_config)

            # 同步工具配置到数据库
            sync_provider_tools(session, provider.id, tools_config)

            session.commit()

            return {"success": True, "message": "工具列表刷新成功"}
        except Exception as e:
            import logging

            logging.error(f"刷新工具列表失败: {str(e)}")

            # 刷新失败，将提供商标记为不可用
            provider.is_available = False
            session.add(provider)

            # 将所有工具设置为离线
            for tool in provider.tools:
                tool.is_online = False
                session.add(tool)

            session.commit()

            return {"success": False, "message": f"刷新工具列表失败: {str(e)}"}
    elif provider.tool_type == ToolType.BUILTIN:
        # BUILTIN类型需要进行鉴权
        success, message = await authenticate_tool_provider(session, tool_provider_id)
        if success:
            return {"success": True, "message": message}
        else:
            return {"success": False, "message": message}
    else:
        raise HTTPException(
            status_code=400,
            detail="不支持的工具提供者类型",
        )


# 新增 MCP 相关 API 路由
@router.post("/mcp", response_model=MCPProviderOut)
async def create_mcp_provider(mcp_provider: MCPProviderCreate, session: SessionDep):
    """
    创建 MCP 工具提供者并同步工具
    """

    try:
        # 使用默认值补充其他字段
        display_name = (
            mcp_provider.provider_name
        )  # 使用 provider_name 作为默认的 display_name
        description = f"MCP 工具提供者: {mcp_provider.provider_name}"  # 生成默认描述

        provider, _ = await MCPManager.create_mcp_provider(
            session=session,
            provider_name=mcp_provider.provider_name,
            mcp_endpoint_url=mcp_provider.mcp_endpoint_url,
            mcp_server_id=mcp_provider.mcp_server_id,
            mcp_connection_type=mcp_provider.mcp_connection_type,
            icon=mcp_provider.icon,
            display_name=display_name,
            description=description,
        )

        return MCPProviderOut(
            id=provider.id,
            provider_name=provider.provider_name,
            mcp_endpoint_url=provider.mcp_endpoint_url,
            mcp_server_id=provider.mcp_server_id,
            mcp_connection_type=provider.mcp_connection_type,
            icon=provider.icon,
        )
    except Exception as e:
        import logging

        logging.error(f"创建 MCP 工具提供者失败: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"创建 MCP 工具提供者失败: {str(e)}",
        )


@router.put("/mcp/{tool_provider_id}", response_model=MCPProviderOut)
async def update_mcp_provider(
    tool_provider_id: int, mcp_provider: MCPProviderUpdate, session: SessionDep
):
    """
    更新 MCP 工具提供者并同步工具
    """

    try:
        # 获取当前提供者
        current_provider = session.get(ToolProvider, tool_provider_id)
        if not current_provider:
            raise HTTPException(
                status_code=404,
                detail="The provider with this ID does not exist in the system",
            )

        # 确保是 MCP 类型的提供者
        if current_provider.tool_type != ToolType.MCP:
            raise HTTPException(
                status_code=400,
                detail="只能更新 MCP 类型的工具提供者",
            )

        # 使用默认值补充其他字段
        display_name = (
            mcp_provider.provider_name if mcp_provider.provider_name else None
        )

        provider, _ = await MCPManager.update_mcp_provider(
            session=session,
            provider_id=tool_provider_id,
            provider_name=mcp_provider.provider_name,
            mcp_endpoint_url=mcp_provider.mcp_endpoint_url,
            mcp_connection_type=mcp_provider.mcp_connection_type,
            icon=mcp_provider.icon,
            display_name=display_name,
        )

        return MCPProviderOut(
            id=provider.id,
            provider_name=provider.provider_name,
            mcp_endpoint_url=provider.mcp_endpoint_url,
            mcp_server_id=provider.mcp_server_id,
            mcp_connection_type=provider.mcp_connection_type,
            icon=provider.icon,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        import logging

        logging.error(f"更新 MCP 工具提供者失败: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"更新 MCP 工具提供者失败: {str(e)}",
        )


@router.post("/mcp/test-connection", response_model=Dict[str, Any])
async def test_mcp_connection(connection_test: MCPConnectionTest, session: SessionDep):
    """
    测试 MCP 连接
    """
    try:
        success, message, tools = await MCPManager.test_mcp_connection(
            mcp_endpoint_url=connection_test.mcp_endpoint_url,
            mcp_server_id=connection_test.mcp_server_id,
            mcp_connection_type=connection_test.mcp_connection_type,
        )

        return {
            "success": success,
            "message": message,
            "tools": tools.get(connection_test.mcp_server_id, []) if success else [],
        }
    except Exception as e:
        import logging

        logging.error(f"MCP 连接测试失败: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"MCP 连接测试失败: {str(e)}",
        )


@router.post("/mcp/{tool_provider_id}/sync", response_model=Dict[str, Any])
async def sync_mcp_tools(tool_provider_id: int, session: SessionDep):
    """
    同步 MCP 工具
    """

    try:
        provider = get_tool_provider(session, tool_provider_id)
        if not provider:
            raise HTTPException(
                status_code=404,
                detail="The provider with this ID does not exist in the system",
            )

        # 确保是 MCP 类型的提供者
        if provider.tool_type != ToolType.MCP:
            raise HTTPException(
                status_code=400,
                detail="只能同步 MCP 类型的工具提供者",
            )

        if not all(
            [
                provider.mcp_endpoint_url,
                provider.mcp_server_id,
                provider.mcp_connection_type,
            ]
        ):
            raise HTTPException(
                status_code=400,
                detail="MCP 配置信息不完整",
            )

        # 更新 MCP 工具
        _, synced_tools = await MCPManager.update_mcp_provider(
            session=session,
            provider_id=tool_provider_id,
        )

        return {
            "success": True,
            "message": f"成功同步 {len(synced_tools)} 个 MCP 工具",
            "tools_count": len(synced_tools),
            "tools": [
                {
                    "name": tool.name,
                    "display_name": tool.display_name,
                    "description": tool.description,
                }
                for tool in synced_tools
            ],
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import logging

        logging.error(f"同步 MCP 工具失败: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"同步 MCP 工具失败: {str(e)}",
        )
