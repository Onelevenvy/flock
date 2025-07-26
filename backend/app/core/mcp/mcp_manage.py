import logging
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.tools import BaseTool
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

from langchain_mcp_adapters.client import MultiServerMCPClient

from app.core.mcp.aiclient_utils import CustomMultiServerMCPClient
from app.curd.toolprovider import (create_tool_provider, sync_provider_tools,
                                   update_tool_provider)
from app.db.models import (Tool, ToolProvider, ToolProviderCreate,
                           ToolProviderUpdate, ToolType)


class MCPManager:
    """MCP 工具提供者管理类"""

    @staticmethod
    def _build_mcp_config(
        provider_map: Dict[int, ToolProvider], mcp_provider_ids: list[int]
    ) -> Dict[str, Dict[str, str]]:
        # 这个方法保持不变
        mcp_config = {}
        for provider_id in mcp_provider_ids:
            provider = provider_map.get(provider_id)
            if not provider:
                logger.warning(f"Provider with id {provider_id} not found.")
                continue
            if not provider.mcp_server_id or not provider.mcp_endpoint_url:
                raise ValueError(
                    f"MCP provider '{provider.provider_name}' is missing essential config."
                )
            mcp_config[provider.mcp_server_id] = {
                "url": provider.mcp_endpoint_url,
                "transport": provider.mcp_connection_type,
            }
        return mcp_config

    @staticmethod
    async def get_all_mcp_tools_by_server(
        provider_map: Dict[int, ToolProvider], mcp_provider_ids: list[int]
    ) -> Dict[str, List[BaseTool]]:  # 注意返回类型是字典
        """
        一次性、并行地获取所有指定MCP提供商的工具，并按服务器ID分组返回。
        """
        if not mcp_provider_ids:
            return {}

        mcp_config = MCPManager._build_mcp_config(provider_map, mcp_provider_ids)

        if not mcp_config:
            return {}

        try:
            # 使用我们自己的 CustomMultiServerMCPClient
            client = CustomMultiServerMCPClient(mcp_config)

            logger.info(
                f"Fetching MCP tools in parallel from servers: {list(mcp_config.keys())}"
            )

            # 调用我们自己写的、返回字典的方法
            tools_by_server = await client.get_tools_by_server()
            return tools_by_server

        except Exception as e:
            logger.error(
                f"Failed to get MCP tools from providers. Error: {e}", exc_info=True
            )
            raise ValueError(f"Failed to get MCP tools: {str(e)}")

    @staticmethod
    async def initialize_mcp_client(
        config: Dict[str, Dict[str, str]],
    ) -> MultiServerMCPClient:
        """初始化 MCP 客户端

        Args:
            config: MCP 服务器配置，格式为 {server_id: {transport: str, url: str}}

        Returns:
            MultiServerMCPClient: MCP 客户端实例
        """
        return MultiServerMCPClient(config)

    @classmethod
    async def create_mcp_provider(
        cls,
        session: Session,
        provider_name: str,
        mcp_endpoint_url: str,
        mcp_server_id: str,
        mcp_connection_type: str,
        icon: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[ToolProvider, List[Tool]]:
        """创建 MCP 工具提供者并同步工具

        Args:
            session: 数据库会话
            provider_name: 提供者名称
            mcp_endpoint_url: MCP 端点 URL
            mcp_server_id: MCP 服务器 ID
            mcp_connection_type: MCP 连接类型
            icon: 图标
            display_name: 显示名称（可选，默认使用 provider_name）
            description: 描述（可选，默认生成）

        Returns:
            Tuple[ToolProvider, List[Tool]]: 创建的工具提供者和同步的工具列表
        """
        # 检查 mcp_server_id 是否已存在
        existing_provider = session.exec(
            select(ToolProvider).where(ToolProvider.mcp_server_id == mcp_server_id)
        ).first()

        if existing_provider:
            raise ValueError(f"已存在 mcp_server_id 为 '{mcp_server_id}' 的工具提供者")

        # 设置默认值
        if display_name is None:
            display_name = provider_name
        if description is None:
            description = f"MCP 工具提供者: {provider_name}"

        # 创建 MCP 配置
        mcp_config = {
            mcp_server_id: {
                "transport": mcp_connection_type,
                "url": mcp_endpoint_url,
            }
        }

        # 初始化 MCP 客户端
        client = await cls.initialize_mcp_client(mcp_config)

        # 获取 MCP 工具列表
        tools_list = await client.get_tools()

        if not tools_list:
            raise ValueError(f"无法获取 MCP 服务器 {mcp_server_id} 的工具列表")

        # 创建工具提供者
        provider_create = ToolProviderCreate(
            provider_name=provider_name,
            display_name=display_name,
            mcp_endpoint_url=mcp_endpoint_url,
            mcp_server_id=mcp_server_id,
            mcp_connection_type=mcp_connection_type,
            icon=icon,
            description=description,
            is_available=True,
            tool_type=ToolType.MCP,
            credentials={},  # 为MCP提供空的credentials字典
        )

        provider = create_tool_provider(session, provider_create)

        # 准备工具配置
        tools_config = []
        for tool in tools_list:
            # 直接使用工具对象的属性
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
        synced_tools = sync_provider_tools(session, provider.id, tools_config)

        return provider, synced_tools

    @classmethod
    async def update_mcp_provider(
        cls,
        session: Session,
        provider_id: int,
        provider_name: Optional[str] = None,
        mcp_endpoint_url: Optional[str] = None,
        mcp_connection_type: Optional[str] = None,
        icon: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> Tuple[ToolProvider, List[Tool]]:
        """更新 MCP 工具提供者并同步工具

        Args:
            session: 数据库会话
            provider_id: 提供者 ID
            provider_name: 提供者名称
            mcp_endpoint_url: MCP 端点 URL
            mcp_connection_type: MCP 连接类型
            icon: 图标
            display_name: 显示名称（可选，如果 provider_name 更新了，默认使用 provider_name）

        Returns:
            Tuple[ToolProvider, List[Tool]]: 更新的工具提供者和同步的工具列表
        """
        # 获取当前提供者
        provider = session.get(ToolProvider, provider_id)
        if not provider:
            raise ValueError(f"找不到 ID 为 {provider_id} 的工具提供者")

        # 设置默认值
        if provider_name is not None and display_name is None:
            display_name = provider_name

        # 更新提供者信息
        update_data = {}
        if provider_name is not None:
            update_data["provider_name"] = provider_name
        if display_name is not None:
            update_data["display_name"] = display_name
        if mcp_endpoint_url is not None:
            update_data["mcp_endpoint_url"] = mcp_endpoint_url
        if mcp_connection_type is not None:
            update_data["mcp_connection_type"] = mcp_connection_type
        if icon is not None:
            update_data["icon"] = icon
        update_data["is_available"] = True

        # 创建 ToolProviderUpdate 对象

        provider_update = ToolProviderUpdate(**update_data)

        # 如果没有更新 MCP 相关信息，则只更新基本信息
        if not any(
            key in update_data for key in ["mcp_endpoint_url", "mcp_connection_type"]
        ):
            provider = update_tool_provider(session, provider_id, provider_update)
            return provider, provider.tools

        # 如果更新了 MCP 相关信息，则需要重新获取工具列表
        mcp_endpoint_url = update_data.get(
            "mcp_endpoint_url", provider.mcp_endpoint_url
        )
        mcp_server_id = provider.mcp_server_id  # 使用原有的 mcp_server_id
        mcp_connection_type = update_data.get(
            "mcp_connection_type", provider.mcp_connection_type
        )

        if not all([mcp_endpoint_url, mcp_server_id, mcp_connection_type]):
            raise ValueError("MCP 配置信息不完整")

        # 创建 MCP 配置
        mcp_config = {
            mcp_server_id: {
                "transport": mcp_connection_type,
                "url": mcp_endpoint_url,
            }
        }

        # 初始化 MCP 客户端
        client = await cls.initialize_mcp_client(mcp_config)

        # 获取 MCP 工具列表
        tools_list = await client.get_tools()

        if not tools_list:
            raise ValueError(f"无法获取 MCP 服务器 {mcp_server_id} 的工具列表")

        # 更新提供者
        provider = update_tool_provider(session, provider_id, provider_update)

        # 准备工具配置
        tools_config = []
        for tool in tools_list:
            # 直接使用工具对象的属性
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
        synced_tools = sync_provider_tools(session, provider.id, tools_config)

        return provider, synced_tools

    @classmethod
    async def test_mcp_connection(
        cls,
        mcp_endpoint_url: str,
        mcp_server_id: str,
        mcp_connection_type: str,
    ) -> Tuple[bool, str, Dict[str, List[Any]]]:
        """测试 MCP 连接

        Args:
            mcp_endpoint_url: MCP 端点 URL
            mcp_server_id: MCP 服务器 ID
            mcp_connection_type: MCP 连接类型

        Returns:
            Tuple[bool, str, Dict[str, List[Any]]]:
                (成功标志, 消息, 工具列表)
        """
        try:
            # 创建 MCP 配置
            mcp_config = {
                mcp_server_id: {
                    "transport": mcp_connection_type,
                    "url": mcp_endpoint_url,
                }
            }

            # 初始化 MCP 客户端
            client = await cls.initialize_mcp_client(mcp_config)

            # 获取 MCP 工具列表
            tools_list = await client.get_tools()

            if not tools_list:
                return False, f"无法获取 MCP 服务器 {mcp_server_id} 的工具列表", {}

            tools_dict = {mcp_server_id: tools_list}
            return True, f"MCP 连接测试成功，发现 {len(tools_list)} 个工具", tools_dict
        except Exception as e:
            return False, f"MCP 连接测试失败: {str(e)}", {}
