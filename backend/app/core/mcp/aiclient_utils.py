# aiclient_utils.py 或 tool_manager.py 顶部

import asyncio
from typing import Dict, List

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools


class CustomMultiServerMCPClient(MultiServerMCPClient):
    """
    一个增强版的客户端，它能并行获取工具，并按服务器ID对结果进行分组。
    """

    async def get_tools_by_server(self) -> Dict[str, List[BaseTool]]:
        """
        并行获取所有服务器的工具，并以字典形式返回，键为服务器ID。
        """
        tasks = []
        server_names = []
        for server_name, connection in self.connections.items():
            server_names.append(server_name)
            task = asyncio.create_task(load_mcp_tools(None, connection=connection))
            tasks.append(task)

        list_of_tool_lists = await asyncio.gather(*tasks)
        result_dict = dict(zip(server_names, list_of_tool_lists))
        return result_dict
