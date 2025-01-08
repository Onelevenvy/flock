from typing import Any, Literal
from uuid import uuid4
from langgraph.graph import END
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from app.models import InterruptDecision, InterruptType
from app.core.state import ReturnWorkflowTeamState, WorkflowTeamState
from langgraph.types import Command, interrupt


class HumanNode:
    """人机交互节点,支持工具调用审查、输出审查和上下文输入三种交互模式"""

    def __init__(
        self,
        node_id: str,
        routes: dict[str, str],  # 路由配置
        title: str | None = None,  # 自定义标题
        interaction_type: InterruptType = InterruptType.TOOL_REVIEW,  # 交互类型
    ):
        self.node_id = node_id
        self.routes = routes
        self.title = title
        self.interaction_type = interaction_type
        self.history = None
        self.messages = None
        self.all_messages = None
        self.last_message = None

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState | Command[str]:
        self.history = state.get("history", [])
        self.messages = state.get("messages", [])
        self.all_messages = state.get("all_messages", [])

        # 获取最后一条消息
        self.last_message = state["all_messages"][-1]

        # 根据不同的交互类型构建中断数据
        interrupt_data = {
            "title": self.title,
            "interaction_type": self.interaction_type,
        }

        if self.interaction_type == InterruptType.TOOL_REVIEW:
            if (
                not hasattr(self.last_message, "tool_calls")
                or not self.last_message.tool_calls
            ):
                return state
            tool_call = self.last_message.tool_calls
            interrupt_data.update(
                {
                    "question": "请审查此工具调用:",
                    "tool_call": tool_call,
                }
            )
        elif self.interaction_type == InterruptType.OUTPUT_REVIEW:
            interrupt_data.update(
                {
                    "question": "请审查此输出:",
                    "content": self.last_message.content,
                }
            )
        elif self.interaction_type == InterruptType.CONTEXT_INPUT:
            interrupt_data.update(
                {
                    "question": "请提供更多信息:",
                }
            )

        # 执行中断
        human_review = interrupt(interrupt_data)

        # 从中断响应中获取action和data
        action = human_review["action"]
        review_data = human_review.get("data")

        # 根据不同的交互类型处理响应
        if self.interaction_type == InterruptType.TOOL_REVIEW:
            return self._handle_tool_review(action, review_data)
        elif self.interaction_type == InterruptType.OUTPUT_REVIEW:
            return self._handle_output_review(action, review_data)
        elif self.interaction_type == InterruptType.CONTEXT_INPUT:
            return self._handle_context_input(action, review_data)
        else:
            raise ValueError(f"Unknown interaction type: {self.interaction_type}")

    def _handle_tool_review(self, action: str, review_data: Any) -> Command[str]:

        tool_call = self.last_message.tool_calls[-1]
        match action:
            case InterruptDecision.APPROVED:
                # 批准工具调用,直接执行

                next_node = self.routes.get("approved", "run_tool")
                return Command(goto=next_node)

            case InterruptDecision.REJECTED:
                # 拒绝工具调用,添加拒绝消息

                result = [
                    ToolMessage(
                        tool_call_id=tool_call["id"],
                        content="Rejected by user. Continue assisting.",
                    )
                ]
                if review_data:
                    result.append(
                        HumanMessage(content=review_data, name="user", id=str(uuid4()))
                    )

                return_state: ReturnWorkflowTeamState = {
                    "history": self.history + result,
                    "messages": result,
                    "all_messages": self.all_messages + result,
                }
                next_node = self.routes.get("rejected", "call_llm")
                return Command(goto=next_node, update=return_state)

            case InterruptDecision.UPDATE:
                # 更新工具调用参数

                updated_message = {
                    "role": "ai",
                    "content": self.last_message.content,
                    "tool_calls": [
                        {
                            "id": tool_call["id"],
                            "name": tool_call["name"],
                            "args": review_data,
                        }
                    ],
                    "id": self.last_message.id,
                }
                next_node = self.routes.get("update", "run_tool")
                return Command(goto=next_node, update={"messages": [updated_message]})

            case _:
                raise ValueError(f"Unknown action for tool review: {action}")

    def _handle_output_review(self, action: str, review_data: Any) -> Command[str]:
        match action:
            case InterruptDecision.APPROVED:
                next_node = self.routes.get("approved", "")

                return Command(goto=next_node)

            case InterruptDecision.REVIEW:
                result = HumanMessage(content=review_data, name="user", id=str(uuid4()))
                next_node = self.routes.get("review", "call_llm")
                return_state: ReturnWorkflowTeamState = {
                    "history": self.history + [result],
                    "messages": [result],
                    "all_messages": self.all_messages + [result],
                }
                return Command(goto=next_node, update=return_state)

            case _:
                raise ValueError(f"Unknown action for output review: {action}")

    def _handle_context_input(self, action: str, review_data: Any) -> Command[str]:
        if action == InterruptDecision.CONTINUE:
            result = HumanMessage(content=review_data, name="user", id=str(uuid4()))
            next_node = self.routes.get("continue", "call_llm")
            return_state: ReturnWorkflowTeamState = {
                "history": self.history + [result],
                "messages": [result],
                "all_messages": self.all_messages + [result],
            }
            return Command(goto=next_node, update=return_state)
        else:
            raise ValueError(f"Unknown action for context input: {action}")
