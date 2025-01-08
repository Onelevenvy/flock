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

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState | Command[str]:
        # 获取最后一条消息
        last_message = state["all_messages"][-1]

        # 根据不同的交互类型构建中断数据
        interrupt_data = {
            "title": self.title,
            "interaction_type": self.interaction_type,
        }

        if self.interaction_type == InterruptType.TOOL_REVIEW:
            if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
                return {"messages": [], "all_messages": state["all_messages"]}
            tool_call = last_message.tool_calls[-1]
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
                    "content": last_message.content,
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
            return self._handle_tool_review(action, review_data, last_message)
        elif self.interaction_type == InterruptType.OUTPUT_REVIEW:
            return self._handle_output_review(action, review_data, last_message)
        elif self.interaction_type == InterruptType.CONTEXT_INPUT:
            return self._handle_context_input(action, review_data)
        else:
            raise ValueError(f"Unknown interaction type: {self.interaction_type}")

    def _handle_tool_review(
        self, action: str, review_data: Any, last_message: Any
    ) -> Command[str]:
        match action:
            case InterruptDecision.APPROVED:
                # 批准工具调用,直接执行
                next_node = self.routes.get("approved", "run_tool")
                return Command(goto=next_node)

            case InterruptDecision.REJECTED:
                # 拒绝工具调用,添加拒绝消息
                reject_message = {
                    "role": "human",
                    "content": review_data if review_data else "Tool call rejected",
                    "id": str(uuid4()),
                }
                next_node = self.routes.get("rejected", "call_llm")
                return Command(goto=next_node, update={"messages": [reject_message]})

            case InterruptDecision.UPDATE:
                # 更新工具调用参数
                updated_message = {
                    "role": "ai",
                    "content": last_message.content,
                    "tool_calls": [
                        {
                            "id": str(uuid4()),
                            "name": last_message.tool_calls[-1]["name"],
                            "args": review_data,
                        }
                    ],
                    "id": last_message.id,
                }
                next_node = self.routes.get("update", "run_tool")
                return Command(goto=next_node, update={"messages": [updated_message]})

            case InterruptDecision.FEEDBACK:
                # 添加反馈消息
                tool_message = {
                    "role": "tool",
                    "content": review_data,
                    "name": "feedback",
                    "tool_call_id": str(uuid4()),
                }
                next_node = self.routes.get("feedback", "call_llm")
                return Command(goto=next_node, update={"messages": [tool_message]})

            case _:
                raise ValueError(f"Unknown action for tool review: {action}")

    def _handle_output_review(
        self, action: str, review_data: Any, last_message: Any
    ) -> Command[str]:
        match action:
            case InterruptDecision.APPROVED:  
                next_node = self.routes.get("approved", END)
                return Command(goto=next_node)

            case InterruptDecision.REVIEW:
                feedback_message = {
                    "role": "human",
                    "content": review_data,
                    "id": str(uuid4()),
                }
                next_node = self.routes.get("review", "call_llm")
                return Command(goto=next_node, update={"messages": [feedback_message]})

            case InterruptDecision.EDIT:
                edited_message = {
                    "role": "ai",
                    "content": review_data,
                    "id": last_message.id,
                }
                next_node = self.routes.get("edit", "call_llm")
                return Command(goto=next_node, update={"messages": [edited_message]})

            case _:
                raise ValueError(f"Unknown action for output review: {action}")

    def _handle_context_input(self, action: str, review_data: Any) -> Command[str]:
        if action == InterruptDecision.CONTINUE:
            context_message = {
                "role": "human",
                "content": review_data,
                "id": str(uuid4()),
            }
            next_node = self.routes.get("continue", "call_llm")
            return Command(goto=next_node, update={"messages": [context_message]})
        else:
            raise ValueError(f"Unknown action for context input: {action}")
