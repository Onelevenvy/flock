import importlib
import logging
import os
from functools import cache
from typing import Any

from langchain.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from pydantic import BaseModel
from sqlmodel import select

from app.core.database import get_session
from app.core.mcp.mcp_manage import MCPManager
from app.core.security import decrypt_token
from app.db.models import Tool, ToolProvider, ToolType

logger = logging.getLogger(__name__)


def get_tool_provider_credentials(tool_provider_name: str) -> dict:
    session = next(get_session())
    try:
        tool_provider = session.exec(
            select(ToolProvider).where(ToolProvider.provider_name == tool_provider_name)
        ).first()
        if tool_provider and tool_provider.credentials:
            return tool_provider.credentials
    finally:
        session.close()
    return {}


def get_tool_provider_credential_value(
    tool_provider_name: str, credential_key: str
) -> str:
    credentials = get_tool_provider_credentials(tool_provider_name)
    if credentials:
        return decrypt_token(credentials.get(credential_key, {}).get("value", ""))
    return ""


class ToolInfo(BaseModel):
    name: str
    description: str
    display_name: str
    input_parameters: dict[str, Any]
    tool_definition: dict[str, Any] | None = None
    managed: bool = False
    tool: BaseTool | None = None
    is_online: bool = True  # 新增字段，默认为在线


class ToolProviderInfo(BaseModel):
    provider_name: str
    display_name: str
    icon: str
    description: str
    credentials: dict[str, Any]
    tools: list[ToolInfo]
    # 新增字段
    mcp_endpoint_url: str | None = None
    mcp_server_id: str | None = None
    mcp_connection_type: str | None = None
    is_available: bool | None = False  # 允许 None 值，默认为 False
    tool_type: ToolType = ToolType.BUILTIN


class ToolManager:
    def __init__(self):
        self.providers: dict[str, ToolProviderInfo] = {}
        self.load_all_providers()

    @staticmethod
    def get_tool_folders(base_dir):
        return [
            f
            for f in os.listdir(base_dir)
            if os.path.isdir(os.path.join(base_dir, f)) and not f.startswith("__")
        ]

    @staticmethod
    def get_credentials_from_folder(folder_path, folder_name):
        credentials = {}
        provider_info = {
            "description": f"{folder_name}工具集合",
            "icon": folder_name,
            "is_available": True,  # 默认可用
            "tool_type": ToolType.BUILTIN,  # 默认为内置工具
        }
        credentials_path = os.path.join(folder_path, "credentials.py")
        if os.path.exists(credentials_path):
            try:
                module = importlib.import_module(
                    f"app.core.tools.{folder_name}.credentials"
                )
                if hasattr(module, "get_credentials"):
                    credentials = module.get_credentials()
                if hasattr(module, "get_provider_info"):
                    provider_info = module.get_provider_info()
            except Exception as e:
                logger.warning(f"Failed to import credentials for {folder_name}: {e}")
        return credentials, provider_info

    @staticmethod
    def get_tools_from_folder(folder_name):
        tools = []
        try:
            init_module = importlib.import_module(f"app.core.tools.{folder_name}")
            if hasattr(init_module, "__all__"):
                for tool_var in getattr(init_module, "__all__"):
                    try:
                        tool_instance = getattr(init_module, tool_var, None)
                        if tool_instance is None:
                            logger.error(f"Tool {tool_var} in {folder_name} is None")
                            continue

                        # Use the original variable name as name
                        name = tool_var
                        # Use the tool's name attribute as display_name, or format the variable name if not available
                        display_name = getattr(
                            tool_instance, "name", tool_var.replace("_", " ").title()
                        )
                        description = getattr(tool_instance, "description", "")
                        input_parameters = {}

                        if hasattr(tool_instance, "args_schema") and hasattr(
                            tool_instance.args_schema, "__fields__"
                        ):
                            for k, v in tool_instance.args_schema.__fields__.items():
                                # Convert Python type to string type
                                type_str = (
                                    str(v.annotation)
                                    if hasattr(v, "annotation")
                                    else "string"
                                )
                                if "str" in type_str.lower():
                                    field_type = "string"
                                elif "int" in type_str.lower():
                                    field_type = "integer"
                                elif (
                                    "float" in type_str.lower()
                                    or "decimal" in type_str.lower()
                                ):
                                    field_type = "number"
                                elif "bool" in type_str.lower():
                                    field_type = "boolean"
                                elif (
                                    "list" in type_str.lower()
                                    or "array" in type_str.lower()
                                ):
                                    field_type = "array"
                                elif (
                                    "dict" in type_str.lower()
                                    or "object" in type_str.lower()
                                ):
                                    field_type = "object"
                                else:
                                    field_type = "string"

                                # Get description from field_info if available
                                field_description = k
                                if hasattr(v, "description"):
                                    field_description = v.description
                                elif hasattr(v, "field_info") and hasattr(
                                    v.field_info, "description"
                                ):
                                    field_description = v.field_info.description

                                input_parameters[k] = {
                                    "type": field_type,
                                    "required": True,  # Set all fields as required
                                    "description": field_description,
                                }

                        # 检查工具是否有在线状态属性
                        is_online = True
                        if hasattr(tool_instance, "is_online"):
                            is_online = tool_instance.is_online

                        tool_info = ToolInfo(
                            name=name,
                            description=description,
                            display_name=display_name,
                            input_parameters=input_parameters,
                            tool_definition={},
                            managed=True,
                            tool=tool_instance,
                            is_online=is_online,  # 设置在线状态
                        )
                        tools.append(tool_info)
                        logger.info(
                            f"Successfully loaded tool {name} from {folder_name}"
                        )
                    except Exception as e:
                        logger.error(
                            f"Failed to load tool {tool_var} from {folder_name}: {str(e)}"
                        )
            else:
                logger.warning(f"No __all__ defined in {folder_name}")
        except Exception as e:
            logger.error(f"Failed to import tools from {folder_name}: {str(e)}")
        return tools

    def load_all_providers(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        tools_dir = os.path.abspath(os.path.join(base_dir, "."))
        tool_folders = self.get_tool_folders(tools_dir)

        # 先从数据库获取现有的providers
        session = next(get_session())
        try:
            existing_providers = {
                provider.provider_name: provider
                for provider in session.exec(select(ToolProvider)).all()
            }
        finally:
            session.close()

        for folder in tool_folders:
            folder_path = os.path.join(tools_dir, folder)
            credentials, provider_info = self.get_credentials_from_folder(
                folder_path, folder
            )
            provider_name = folder
            description = provider_info.get("description", f"{folder}工具集合")
            display_name = provider_info.get("display_name", folder)
            icon = provider_info.get("icon", folder)
            tools = self.get_tools_from_folder(folder)

            # 获取新增字段的值
            mcp_endpoint_url = provider_info.get("mcp_endpoint_url")
            mcp_server_id = provider_info.get("mcp_server_id")
            mcp_connection_type = provider_info.get("mcp_connection_type")
            is_available = provider_info.get("is_available", False)
            tool_type = provider_info.get("tool_type", ToolType.BUILTIN)

            # 如果数据库中已存在该provider，使用数据库中的信息
            if provider_name in existing_providers:
                db_provider = existing_providers[provider_name]
                credentials = db_provider.credentials or credentials

                # 使用数据库中的新字段值（如果存在）
                if db_provider.mcp_endpoint_url:
                    mcp_endpoint_url = db_provider.mcp_endpoint_url
                if db_provider.mcp_server_id:
                    mcp_server_id = db_provider.mcp_server_id
                if db_provider.mcp_connection_type:
                    mcp_connection_type = db_provider.mcp_connection_type
                is_available = db_provider.is_available
                if hasattr(db_provider, "tool_type") and db_provider.tool_type:
                    tool_type = db_provider.tool_type

            self.providers[provider_name] = ToolProviderInfo(
                provider_name=provider_name,
                display_name=display_name,
                icon=icon,
                description=description,
                credentials=credentials,
                tools=tools,
                # 添加新字段
                mcp_endpoint_url=mcp_endpoint_url,
                mcp_server_id=mcp_server_id,
                mcp_connection_type=mcp_connection_type,
                is_available=is_available,
                tool_type=tool_type,
            )

    def get_all_providers(self) -> dict[str, ToolProviderInfo]:
        return self.providers

    def get_all_tools(self) -> dict[str, ToolInfo]:
        """获取所有工具，使用provider_name:tool_name作为键以避免同名工具冲突

        Returns:
            dict[str, ToolInfo]: 包含所有工具的字典，键为"provider_name:tool_name"格式
        """
        all_tools = {}

        for provider_name, provider in self.providers.items():
            for tool in provider.tools:
                # 使用provider_name:tool_name作为键
                combined_key = f"{provider_name}:{tool.name}"
                all_tools[combined_key] = tool

        return all_tools

    def get_tool_credentials_function(self, provider_name: str) -> dict[str, Any]:
        """获取工具提供商的credentials_function返回的测试参数

        Args:
            provider_name: 提供商名称

        Returns:
            dict: 包含工具名称和测试参数的字典，格式为：
                {
                    "tool_name": "工具名称",
                    "input_parameters": {
                        "参数1": "值1",
                        "参数2": "值2",
                    }
                }
        """
        try:
            module = importlib.import_module(
                f"app.core.tools.{provider_name}.credentials"
            )
            if hasattr(module, "credentials_function"):
                return module.credentials_function()
        except Exception as e:
            logger.warning(
                f"Failed to get credentials_function for {provider_name}: {e}"
            )

        # 如果没有找到credentials_function或发生异常，返回空字典
        return {"tool_name": "", "input_parameters": {}}

    @cache
    def get_builtin_tool_by_name(self, tool_name: str) -> BaseTool:
        """根据工具名称获取工具实例。只支持provider_name:tool_name格式的组合键。

        Args:
            tool_name: 工具名称，必须是provider_name:tool_name格式（如'qingyan:assistant'）

        Returns:
            BaseTool: 工具实例

        Raises:
            ValueError: 如果找不到指定的工具或格式不正确
        """
        # 获取所有工具
        all_tools = self.get_all_tools()

        # 直接查找组合键
        if tool_name in all_tools:
            tool = all_tools[tool_name].tool
            if tool is None:
                raise ValueError(f"Tool instance is None for tool: {tool_name}")
            return tool

        # 如果不是组合键格式，尝试解析
        if ":" not in tool_name:
            raise ValueError(
                f"Invalid tool name format: {tool_name}. Must be in 'provider_name:tool_name' format"
            )

        # 解析provider_name:tool_name格式
        provider_name, simple_tool_name = tool_name.split(":", 1)

        # 检查提供商是否存在
        if provider_name in self.providers:
            provider_info = self.providers[provider_name]
            # 在提供商的工具列表中查找指定名称的工具
            for tool_info in provider_info.tools:
                if tool_info.name == simple_tool_name:
                    if tool_info.tool is None:
                        raise ValueError(
                            f"Tool instance is None for tool: {simple_tool_name} in provider: {provider_name}"
                        )
                    return tool_info.tool

        raise ValueError(f"Unknown tool: {tool_name}")

    async def get_tool_by_tool_id(self, tool_id: int) -> BaseTool:
        """根据工具ID获取工具实例。

        Args:
            tool_id: 工具ID


        Returns:
            BaseTool: 工具实例

        Raises:
            ValueError: 如果找不到指定的工具
        """

        session = next(get_session())

        try:
            # 获取工具及其提供商信息
            tool = session.exec(select(Tool).where(Tool.id == tool_id)).first()
            if not tool:
                raise ValueError(f"Tool not found with id: {tool_id}")

            # 获取提供商信息
            provider = session.exec(
                select(ToolProvider).where(ToolProvider.id == tool.provider_id)
            ).first()
            if not provider:
                raise ValueError(f"Tool provider not found for tool id: {tool_id}")

            # 根据提供商类型处理不同的工具获取方式
            if provider.tool_type == ToolType.MCP:

                # 使用MCP工具缓存获取工具
                if not provider.mcp_server_id:
                    raise ValueError(
                        f"MCP server ID not found for provider: {provider.provider_name}"
                    )

                # 获取MCP工具列表
                try:
                    client = MultiServerMCPClient(
                        {
                            provider.mcp_server_id: {
                                # Make sure you start your weather server on port 8000
                                "url": provider.mcp_endpoint_url,
                                "transport": provider.mcp_connection_type,
                            }
                        }
                    )
                    mcp_tools = await client.get_tools()
                except Exception as e:
                    raise ValueError(f"Failed to get MCP tools: {str(e)}")

                # 在MCP工具列表中查找指定名称的工具
                for mcp_tool in mcp_tools:
                    if mcp_tool.name == tool.name:
                        return mcp_tool

                raise ValueError(
                    f"Tool '{tool.name}' not found in MCP provider: {provider.mcp_server_id}"
                )
            else:
                # 处理内置工具和API工具
                # 构造组合键格式
                combined_key = f"{provider.provider_name}:{tool.name}"

                # 使用组合键调用get_builtin_tool_by_name
                try:
                    return self.get_builtin_tool_by_name(combined_key)
                except ValueError as e:
                    raise ValueError(f"Failed to get tool with id {tool_id}: {str(e)}")

        finally:
            session.close()

    async def get_tool_by_tool_id_list(self, tool_ids: list[int]) -> list[BaseTool]:
        """
        批量根据工具ID列表获取工具实例列表。

        Args:
            tool_ids: 工具ID列表

        Returns:
            list[BaseTool]: 工具实例列表，按输入的tool_ids顺序返回

        Raises:
            ValueError: 如果找不到指定的工具
        """

        if not tool_ids:
            return []

        session = next(get_session())
        tools_result = [None] * len(tool_ids)  # 预分配结果列表，保持原始顺序

        try:
            # 步骤 1: 批量获取数据库信息
            tools = session.exec(select(Tool).where(Tool.id.in_(tool_ids))).all()
            tool_map = {tool.id: tool for tool in tools}

            provider_ids = list(set(tool.provider_id for tool in tools))
            providers = session.exec(
                select(ToolProvider).where(ToolProvider.id.in_(provider_ids))
            ).all()
            provider_map = {provider.id: provider for provider in providers}

            # 步骤 2: 按类型分组工具请求
            mcp_tools_by_provider = {}  # provider_id -> [(index, tool_id, tool)]
            builtin_tools = []  # [(index, tool_id, provider_name, tool_name)]
            mcp_provider_ids_to_query = []  # 将要查询的MCP提供商ID列表

            for index, tool_id in enumerate(tool_ids):
                if tool_id not in tool_map:
                    raise ValueError(f"Tool not found with id: {tool_id}")

                tool = tool_map[tool_id]
                provider = provider_map.get(tool.provider_id)

                if not provider:
                    raise ValueError(f"Tool provider not found for tool id: {tool_id}")

                if provider.tool_type == ToolType.MCP:
                    if provider.id not in mcp_tools_by_provider:
                        mcp_tools_by_provider[provider.id] = []
                        mcp_provider_ids_to_query.append(provider.id)  # 在这里填充列表
                    mcp_tools_by_provider[provider.id].append((index, tool_id, tool))
                else:
                    builtin_tools.append(
                        (index, tool_id, provider.provider_name, tool.name)
                    )

            # 步骤 3: 处理MCP工具 (这就是您关心的 if 块)
            if mcp_provider_ids_to_query:
                # a. 对 MCPManager 进行一次清晰的调用，并行获取所有工具
                tools_by_server_dict = await MCPManager.get_all_mcp_tools_by_server(
                    provider_map, mcp_provider_ids_to_query
                )

                # b. 用返回的字典构建精确的查找表 {server_id: {tool_name: tool_instance}}
                mcp_tool_lookup = {}
                for server_id, tool_list in tools_by_server_dict.items():
                    mcp_tool_lookup[server_id] = {tool.name: tool for tool in tool_list}

                # c. 精确地分发结果到 tools_result 列表的正确位置
                for provider_id, tool_items in mcp_tools_by_provider.items():
                    provider = provider_map[provider_id]
                    provider_server_id = provider.mcp_server_id

                    for index, tool_id, requested_tool in tool_items:
                        requested_tool_name = requested_tool.name
                        found_tool = mcp_tool_lookup.get(provider_server_id, {}).get(
                            requested_tool_name
                        )

                        if found_tool:
                            tools_result[index] = found_tool
                        else:
                            raise ValueError(
                                f"Tool '{requested_tool_name}' not found in provider '{provider.provider_name}'"
                            )

            # 步骤 4: 处理内置工具
            for index, tool_id, provider_name, tool_name in builtin_tools:
                combined_key = f"{provider_name}:{tool_name}"
                try:
                    tools_result[index] = self.get_builtin_tool_by_name(combined_key)
                except ValueError as e:
                    raise ValueError(f"Failed to get tool with id {tool_id}: {str(e)}")

            # 步骤 5: 最终检查并返回结果
            if None in tools_result:
                missing_indices = [
                    i for i, tool in enumerate(tools_result) if tool is None
                ]
                missing_ids = [tool_ids[i] for i in missing_indices]
                raise ValueError(
                    f"Failed to find all requested tools. Missing IDs: {missing_ids}"
                )

            return tools_result

        finally:
            session.close()

    def get_tool_by_tool_id_sync(self, tool_id: int) -> BaseTool:
        """根据工具ID获取工具实例。

        Args:
            tool_id: 工具ID


        Returns:
            BaseTool: 工具实例

        Raises:
            ValueError: 如果找不到指定的工具
        """

        session = next(get_session())

        try:
            # 获取工具及其提供商信息
            tool = session.exec(select(Tool).where(Tool.id == tool_id)).first()
            if not tool:
                raise ValueError(f"Tool not found with id: {tool_id}")

            # 获取提供商信息
            provider = session.exec(
                select(ToolProvider).where(ToolProvider.id == tool.provider_id)
            ).first()
            if not provider:
                raise ValueError(f"Tool provider not found for tool id: {tool_id}")

            # 根据提供商类型处理不同的工具获取方式
            if provider.tool_type == ToolType.MCP:

                # 使用MCP工具缓存获取工具
                if not provider.mcp_server_id:
                    raise ValueError(
                        f"MCP server ID not found for provider: {provider.provider_name}"
                    )

                # 获取MCP工具列表
                try:
                    client = MultiServerMCPClient(
                        {
                            provider.mcp_server_id: {
                                # Make sure you start your weather server on port 8000
                                "url": provider.mcp_endpoint_url,
                                "transport": provider.mcp_connection_type,
                            }
                        }
                    )
                    mcp_tools = client.get_tools()
                except Exception as e:
                    raise ValueError(f"Failed to get MCP tools: {str(e)}")

                # 在MCP工具列表中查找指定名称的工具
                for mcp_tool in mcp_tools:
                    if mcp_tool.name == tool.name:
                        return mcp_tool

                raise ValueError(
                    f"Tool '{tool.name}' not found in MCP provider: {provider.mcp_server_id}"
                )
            else:
                # 处理内置工具和API工具
                # 构造组合键格式
                combined_key = f"{provider.provider_name}:{tool.name}"

                # 使用组合键调用get_builtin_tool_by_name
                try:
                    return self.get_builtin_tool_by_name(combined_key)
                except ValueError as e:
                    raise ValueError(f"Failed to get tool with id {tool_id}: {str(e)}")

        finally:
            session.close()


_tool_manager = ToolManager()
get_all_tool_providers = _tool_manager.get_all_providers
get_all_tools = _tool_manager.get_all_tools
get_tool_by_name = _tool_manager.get_builtin_tool_by_name
get_tool_by_tool_id = _tool_manager.get_tool_by_tool_id
get_tool_by_tool_id_sync = _tool_manager.get_tool_by_tool_id_sync
get_tool_by_tool_id_list = _tool_manager.get_tool_by_tool_id_list

# 导出工具凭据函数
get_tool_credentials_function = _tool_manager.get_tool_credentials_function
