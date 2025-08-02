from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent

from app.core.model_providers.model_provider_manager import \
    model_provider_manager
from app.core.state import (ReturnWorkflowState, WorkflowState,
                            parse_variables, update_node_outputs)
from app.core.tools.tool_manager import get_tool_by_tool_id_list
from app.core.workflow.utils.db_utils import get_model_info
from app.core.workflow.utils.tools_utils import get_retrieval_tool


class AgentNode:
    """Agent Node that combines LLM with tools and knowledge bases"""

    def __init__(
        self,
        node_id: str,
        model_name: str,
        temperature: float,
        system_message: str = None,
        user_message: str = None,
        tools: List[str] = None,
        retrieval_tools: List[Dict[str, Any]] = None,
        agent_name: str = None,
    ):
        self.node_id = node_id
        self.system_message = system_message
        self.user_message = user_message
        self.agent_name = agent_name or node_id
        self.model_info = get_model_info(model_name)
        self.system_prompt = system_message
        self.user_prompt = user_message
        self.tools = tools
        self.retrieval_tools = retrieval_tools
        # 准备工具列表
        self.tools_list = []

        try:
            # 创建模型配置
            self.model_config = {
                "provider_name": self.model_info["provider_name"],
                "model": self.model_info["ai_model_name"],
                "temperature": temperature,
                "api_key": self.model_info["api_key"],
                "base_url": self.model_info["base_url"],
            }

            # 初始化模型
            self.llm = model_provider_manager.init_model(**self.model_config)

        except ValueError:
            raise ValueError(f"Model {model_name} is not supported as a chat model.")

    async def bind_tools(self):
        if self.tools:
            tool_id_list = [tool["id"] for tool in self.tools]
            _tools = await get_tool_by_tool_id_list(tool_id_list)
            if _tools:
                self.tools_list.extend(_tools)

        # 添加知识库工具
        if self.retrieval_tools:
            for kb_tool in self.retrieval_tools:
                if isinstance(kb_tool, dict):
                    retrieval_tool = get_retrieval_tool(
                        kb_tool["name"],
                        kb_tool.get("description", ""),
                        kb_tool.get("usr_id", 0),
                        kb_tool.get("kb_id", 0),
                    )
                    if retrieval_tool:
                        self.tools_list.append(retrieval_tool)
                elif isinstance(kb_tool, str):
                    retrieval_tool = get_retrieval_tool(
                        kb_tool,
                        f"Search in knowledge base {kb_tool}",
                        0,
                        0,
                    )
                    if retrieval_tool:
                        self.tools_list.append(retrieval_tool)
        return self.tools_list

    async def work(
        self, state: WorkflowState, config: RunnableConfig
    ) -> ReturnWorkflowState:

        if "node_outputs" not in state:
            state["node_outputs"] = {}
        history_messages = state.get("messages", [])

        system_message_for_history: SystemMessage | None = None
        parsed_system_prompt_str = ""
        if self.system_prompt:
            parsed_system_prompt_str = (
                parse_variables(self.system_prompt, state["node_outputs"])
                .replace("{", "{{")
                .replace("}", "}}")
            )
            system_message_for_history = SystemMessage(content=parsed_system_prompt_str)

        if not self.user_prompt:
            raise ValueError(
                "No input found in agent node, Please check your node settings."
            )
        parsed_user_prompt = (
            parse_variables(self.user_prompt, state["node_outputs"])
            .replace("{", "{{")
            .replace("}", "}}")
        )
        human_message_input = HumanMessage(content=parsed_user_prompt, name="user")

        final_prompt_for_agent = []
        if not history_messages:
            if system_message_for_history:
                final_prompt_for_agent.append(system_message_for_history)
            final_prompt_for_agent.append(human_message_input)
        else:
            final_prompt_for_agent.extend(history_messages)
            final_prompt_for_agent.append(human_message_input)

        if not self.tools_list:
            await self.bind_tools()

        # 创建 Agent 实例
        self.agent = create_react_agent(
            model=self.llm,
            tools=self.tools_list,  # Agent 的指令模板依然使用解析后的字符串
        )

        # 调用 Agent
        agent_result = await self.agent.ainvoke(
            {"messages": final_prompt_for_agent}, config=config
        )

        final_response_message = agent_result["messages"][-1]
        new_output = {self.node_id: {"response": final_response_message.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowState = {
            "messages": agent_result["messages"],
            "node_outputs": state["node_outputs"],
        }

        return return_state
