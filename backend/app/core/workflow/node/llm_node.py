from collections.abc import Sequence
from typing import Any

from langchain_core.messages import AIMessage, AnyMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableConfig, RunnableSerializable
from langchain_core.tools import BaseTool

from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)
from app.core.workflow.utils.db_utils import get_model_info


class LLMBaseNode:
    def __init__(
        self,
        node_id: str,
        model_name: str,
        tools: Sequence[BaseTool],
        temperature: float,
        system_prompt: str,
        agent_name: str,
    ):
        self.node_id = node_id
        self.system_prompt = system_prompt
        self.agent_name = agent_name
        self.model_info = get_model_info(model_name)
        try:
            self.model = model_provider_manager.init_model(
                provider_name=self.model_info["provider_name"],
                model=self.model_info["ai_model_name"],
                temperature=temperature,
                api_key=self.model_info["api_key"],
                base_url=self.model_info["base_url"],
            )

            if len(tools) >= 1 and hasattr(self.model, "bind_tools"):
                self.model = self.model.bind_tools(tools)

        except ValueError:
            raise ValueError(f"Model {model_name} is not supported as a chat model.")


class LLMNode(LLMBaseNode):
    """Perform LLM Node actions"""

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:

        if "node_outputs" not in state:
            state["node_outputs"] = {}
        history = state.get("history", [])
        messages = state.get("messages", [])
        all_messages = state.get("all_messages", [])
        if self.system_prompt:
            # First parse variables, then escape any remaining curly braces
            parsed_system_prompt = (
                parse_variables(self.system_prompt, state["node_outputs"])
                .replace("{", "{{")
                .replace("}", "}}")
            )
            prompt = ChatPromptTemplate.from_messages(
                [
                    ("system", parsed_system_prompt),
                    MessagesPlaceholder(variable_name="messages"),
                ]
            )
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = (
                prompt | self.model
            )
        else:
            chain: RunnableSerializable[dict[str, Any], AnyMessage] = self.model
        # 检查消息是否包含图片
        if (
            all_messages
            and isinstance(all_messages[-1].content, list)
            and any(
                isinstance(item, dict)
                and "type" in item
                and item["type"] in ["text", "image_url"]
                for item in all_messages[-1].content
            )
        ):

            from langchain_core.messages import HumanMessage

            # 创建新的临时状态用于处理图片消息
            temp_state = [HumanMessage(content=all_messages[-1].content, name="user")]

            result: AIMessage = await self.model.ainvoke(temp_state, config)
        else:
            # 普通消息保持原有处理方式
            result: AIMessage = await chain.ainvoke(all_messages, config)

        # 更新 node_outputs
        new_output = {self.node_id: {"response": result.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowTeamState = {
            "history": history + [result],
            "messages": [result] if result.tool_calls else [],
            "all_messages": messages + [result],
            "node_outputs": state["node_outputs"],
        }
        return return_state
