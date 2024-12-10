from collections.abc import Sequence
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, AnyMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableConfig, RunnableSerializable
from langchain_core.tools import BaseTool
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.core.model_providers.model_provider_manager import model_provider_manager
from app.core.workflow.node.state import (
    ReturnTeamState,
    TeamState,
    format_messages,
    parse_variables,
    update_node_outputs,
)


class LLMBaseNode:
    def __init__(
        self,
        node_id: str,
        provider: str,
        model: str,
        tools: Sequence[BaseTool],
        openai_api_key: str,
        openai_api_base: str,
        temperature: float,
        system_prompt: str,
        agent_name: str,
    ):
        self.node_id = node_id
        self.system_prompt = system_prompt
        self.agent_name = agent_name

        try:
            self.model = model_provider_manager.init_model(
                provider, model, temperature, openai_api_key, openai_api_base
            )

            if len(tools) >= 1 and hasattr(self.model, "bind_tools"):
                self.model = self.model.bind_tools(tools)

            # 为最终答案设置一个单独的模型实例
            self.final_answer_model = model_provider_manager.init_model(
                provider, model, 0, openai_api_key, openai_api_base
            )

        except ValueError:
            # 如果 model_provider_manager 无法初始化模型，回退到原来的初始化方法
            if provider in ["zhipuai", "siliconflow"]:
                self.model = ChatOpenAI(
                    model=model,
                    temperature=temperature,
                    openai_api_key=openai_api_key,
                    openai_api_base=openai_api_base,
                )
                if len(tools) >= 1:
                    self.model = self.model.bind_tools(tools)
                self.final_answer_model = self.model

            elif provider in ["openai"]:
                self.model = init_chat_model(
                    model,
                    model_provider=provider,
                    temperature=temperature,
                )
                self.final_answer_model = ChatOpenAI(
                    model=model,
                    temperature=0,
                    streaming=True,
                )
                if len(tools) >= 1:
                    self.model = self.model.bind_tools(tools)
                self.final_answer_model = self.model
            elif provider == "ollama":
                self.model = ChatOllama(
                    model=model,
                    temperature=temperature,
                    base_url=(
                        openai_api_base
                        if openai_api_base
                        else "http://host.docker.internal:11434"
                    ),
                )
                if len(tools) >= 1:
                    self.model = self.model.bind_tools(tools)
                self.final_answer_model = self.model

            else:
                self.model = init_chat_model(
                    model,
                    model_provider=provider,
                    temperature=temperature,
                    streaming=True,
                    openai_api_key=openai_api_key,
                    openai_api_base=openai_api_base,
                )
                if len(tools) >= 1:
                    self.model = self.model.bind_tools(tools)
                self.final_answer_model = self.model


class LLMNode(LLMBaseNode):
    """Perform LLM Node actions"""

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:

        if "node_outputs" not in state:
            state["node_outputs"] = {}

        if self.system_prompt:
            parsed_system_prompt = parse_variables(
                self.system_prompt, state["node_outputs"]
            )
            llm_node_prompts = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        "Perform the task given to you.\n"
                        "If you are unable to perform the task, that's OK, you can ask human for help, or just say that you are unable to perform the task."
                        "Execute what you can to make progress. "
                        "And your role is:" + parsed_system_prompt + "\n"
                        "And your name is:"
                        + self.agent_name
                        + "\n"
                        + "please remember your name\n"
                        "Stay true to your role and use your tools if necessary.\n\n",
                    ),
                    (
                        "human",
                        "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
                    ),
                    MessagesPlaceholder(variable_name="messages"),
                ]
            )

        else:
            llm_node_prompts = ChatPromptTemplate.from_messages(
                [
                    (
                        "system",
                        (
                            "Perform the task given to you.\n"
                            "If you are unable to perform the task, that's OK, you can ask human for help, or just say that you are unable to perform the task."
                            "Execute what you can to make progress. "
                            "Stay true to your role and use your tools if necessary.\n\n"
                        ),
                    ),
                    (
                        "human",
                        "Here is the previous conversation: \n\n {history_string} \n\n Provide your response.",
                    ),
                    MessagesPlaceholder(variable_name="messages"),
                ]
            )
        history = state.get("history", [])
        messages = state.get("messages", [])
        prompt = llm_node_prompts.partial(history_string=format_messages(history))
        chain: RunnableSerializable[dict[str, Any], AnyMessage] = prompt | self.model
        result: AIMessage = await chain.ainvoke(state, config)

        # 更新 node_outputs
        new_output = {self.node_id: {"response": result.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        return_state: ReturnTeamState = {
            "history": history + [result],
            "messages": [result] if result.tool_calls else [],
            "all_messages": messages + [result],
            "node_outputs": state["node_outputs"],
        }
        return return_state
