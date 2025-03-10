from pathlib import Path
from typing import Any, Dict, Optional

from langchain_core.runnables import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)
from app.core.workflow.utils.db_utils import get_model_info


class MCPConfigValidator:
    """MCP配置验证器"""

    @staticmethod
    def validate_stdio_config(config: Dict[str, Any]) -> Optional[str]:
        """验证stdio类型配置"""
        if not isinstance(config, dict):
            return "Config must be a dictionary"

        required_fields = {"command", "args", "transport"}
        missing_fields = required_fields - set(config.keys())
        if missing_fields:
            return f"Missing required fields: {missing_fields}"

        if config["transport"] != "stdio":
            return "Transport must be 'stdio' for stdio config"

        if not isinstance(config["args"], list):
            return "Args must be a list"

        # 验证Python文件路径是否存在
        if config["command"] == "python":
            script_path = config["args"][0]
            if not Path(script_path).is_file():
                return f"Python script not found: {script_path}"

        return None

    @staticmethod
    def validate_sse_config(config: Dict[str, Any]) -> Optional[str]:
        """验证sse类型配置"""
        if not isinstance(config, dict):
            return "Config must be a dictionary"

        required_fields = {"url", "transport"}
        missing_fields = required_fields - set(config.keys())
        if missing_fields:
            return f"Missing required fields: {missing_fields}"

        if config["transport"] != "sse":
            return "Transport must be 'sse' for sse config"

        if not isinstance(config["url"], str):
            return "URL must be a string"

        if not config["url"].startswith(("http://", "https://")):
            return "URL must start with http:// or https://"

        return None

    @classmethod
    def validate_mcp_config(cls, config: Dict[str, Dict[str, Any]]) -> None:
        """验证整个MCP配置"""
        if not isinstance(config, dict):
            raise ValueError("MCP config must be a dictionary")

        if not config:
            raise ValueError("MCP config cannot be empty")

        for server_name, server_config in config.items():
            if not isinstance(server_config, dict):
                raise ValueError(
                    f"Server config for {server_name} must be a dictionary"
                )

            if "transport" not in server_config:
                raise ValueError(f"Missing transport in {server_name} config")

            transport = server_config["transport"]
            if transport == "stdio":
                error = cls.validate_stdio_config(server_config)
            elif transport == "sse":
                error = cls.validate_sse_config(server_config)
            else:
                error = f"Unsupported transport type: {transport}"

            if error:
                raise ValueError(f"Invalid config for {server_name}: {error}")


class MCPBaseNode:
    def __init__(
        self,
        node_id: str,
        model_name: str,
        input: str,
        mcp_config: Dict[str, Any],
    ):
        self.node_id = node_id
        self.input = input
        # 验证MCP配置
        try:
            MCPConfigValidator.validate_mcp_config(mcp_config)
            self.mcp_config = mcp_config
        except ValueError as e:
            raise ValueError(f"Invalid MCP config: {str(e)}")

        self.model_info = get_model_info(model_name)

        try:
            self.model = model_provider_manager.init_model(
                provider_name=self.model_info["provider_name"],
                model=self.model_info["ai_model_name"],
                temperature=0.01,  # MCP工具调用需要低温度
                api_key=self.model_info["api_key"],
                base_url=self.model_info["base_url"],
            )
        except ValueError:
            raise ValueError(f"Model {model_name} is not supported as a chat model.")


class MCPNode(MCPBaseNode):
    """Perform MCP Node actions with multiple servers"""

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        history = state.get("history", [])
        messages = state.get("messages", [])
        state.get("all_messages", [])

        input_text = (
            parse_variables(self.input, state["node_outputs"]) if self.input else None
        )
        # 使用MultiServerMCPClient处理多个MCP服务
        async with MultiServerMCPClient(self.mcp_config) as client:
            # 创建agent并获取工具
            agent = create_react_agent(self.model, client.get_tools())

            # 处理用户输入

            result = await agent.ainvoke({"messages": input_text})

            # 更新node_outputs
            new_output = {self.node_id: {"response": result["messages"][-1].content}}
            state["node_outputs"] = update_node_outputs(
                state["node_outputs"], new_output
            )

            return_state: ReturnWorkflowTeamState = {
                "history": history + result["messages"],
                "messages": result["messages"],
                "all_messages": messages + result["messages"],
                "node_outputs": state["node_outputs"],
            }

            return return_state
