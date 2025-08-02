from collections.abc import Sequence

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool

from app.core.model_providers.model_provider_manager import \
    model_provider_manager
from app.core.state import (ReturnWorkflowState, WorkflowState,
                            parse_variables, update_node_outputs)
from app.core.workflow.utils.db_utils import get_model_info


class LLMBaseNode:
    def __init__(
        self,
        node_id: str,
        model_name: str,
        tools: Sequence[BaseTool],
        temperature: float,
        system_prompt: str,
        user_prompt: str,
        agent_name: str,
    ):
        self.node_id = node_id
        self.system_prompt = system_prompt
        self.user_prompt = user_prompt
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
                try:
                    self.model = self.model.bind_tools(tools)
                except ValueError:
                    raise ValueError(f"Model {model_name} bind tools failed.")

        except ValueError:
            raise ValueError(f"Model {model_name} is not supported as a chat model.")


class LLMNode(LLMBaseNode):
    """Perform LLM Node actions"""

    async def work(
        self, state: WorkflowState, config: RunnableConfig
    ) -> ReturnWorkflowState:

        if "node_outputs" not in state:
            state["node_outputs"] = {}
        history_messages = state.get("messages", [])

        final_prompt_for_model = []
        if self.system_prompt:
            parsed_system_prompt = (
                parse_variables(self.system_prompt, state["node_outputs"])
                .replace("{", "{{")
                .replace("}", "}}")
            )
            final_prompt_for_model.append(SystemMessage(content=parsed_system_prompt))

        if not self.user_prompt:
            raise ValueError(
                "No input found in llm node, Please check your node settings."
            )

        parsed_user_prompt = (
            parse_variables(self.user_prompt, state["node_outputs"])
            .replace("{", "{{")
            .replace("}", "}}")
        )
        human_message_input = HumanMessage(content=parsed_user_prompt, name="user")

        #  图片类的支持，待优化，暂时占位
        # if (
        #     history_messages
        #     and isinstance(history_messages[-1].content, list)
        #     and any(
        #         isinstance(item, dict)
        #         and "type" in item
        #         and item["type"] in ["text", "image_url"]
        #         for item in history_messages[-1].content
        #     )
        # ):

        #     temp_state = [
        #         HumanMessage(content=history_messages[-1].content, name="user")
        #     ]

        #     result: AIMessage = await self.model.ainvoke(temp_state, config)

        if not history_messages:

            messages_to_invoke = final_prompt_for_model + [human_message_input]
            result: AIMessage = await self.model.ainvoke(messages_to_invoke, config)

            messages_for_return = messages_to_invoke + [result]
        else:

            messages_to_invoke = history_messages + [human_message_input]
            result: AIMessage = await self.model.ainvoke(messages_to_invoke, config)

            messages_for_return = [human_message_input] + [result]

        new_output = {self.node_id: {"response": result.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnWorkflowState = {
            "messages": messages_for_return,
            "node_outputs": state["node_outputs"],
        }
        return return_state
