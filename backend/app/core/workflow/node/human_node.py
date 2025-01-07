from typing import Any, Literal
from uuid import uuid4
from langgraph.graph import END
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import var_child_runnable_config

from app.models import InterruptDecision
from app.core.state import ReturnWorkflowTeamState, WorkflowTeamState
from langgraph.types import Command, interrupt


class HumanNode:
    """专门用于工具调用审查的人机交互节点"""

    # 定义固定的交互选项
    CONTINUE = "continue"  # 批准工具调用
    UPDATE = "update"  # 修改工具调用
    FEEDBACK = "feedback"  # 提供反馈

    def __init__(
        self,
        node_id: str,
        routes: dict[str, str],  # 路由配置
        title: str | None = None,  # 自定义标题
    ):
        self.node_id = node_id

        self.routes = routes
        self.title = title

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState | Command[str]:

        # 获取最后一条消息
        last_message = state["all_messages"][-1]
        # if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
        #     return {"messages": [], "all_messages": state["all_messages"]}

        # tool_call = last_message.tool_calls[-1]

        # 创建中断数据
        interrupt_data = {
            "title": self.title,
            "question": "请审查此工具调用:",
            # "tool_call": tool_call,
            "options": [self.CONTINUE, self.UPDATE, self.FEEDBACK],
        }

        # 执行中断
        human_review = interrupt(interrupt_data)

        # 从中断响应中获取action和data
        action = human_review["action"]  # 使用 action
        review_data = human_review.get("data", None)  # 使用 data

        match action:
            case self.CONTINUE:
                # 批准工具调用,直接执行
                next_node = self.routes.get("continue", "run_tool")
                return Command(goto=next_node)

            case self.UPDATE:
                # 更新工具调用参数
                updated_message = {
                    "role": "ai",
                    "content": last_message.content,
                    "tool_calls": [
                        {
                            "id": str(uuid4()),
                            "name": "interrupt",
                            "args": review_data,  # 使用 review_data
                        }
                    ],
                    "id": last_message.id,
                }
                next_node = self.routes.get("update", "run_tool")
                return Command(goto=next_node, update={"messages": [updated_message]})

            case self.FEEDBACK:
                # 添加反馈消息
                tool_message = {
                    "role": "tool",
                    "content": review_data,  # 使用 review_data
                    "name": "interrupt",
                    "tool_call_id": str(uuid4()),
                }
                next_node = self.routes.get("feedback", "call_llm")
                return Command(goto=next_node, update={"messages": [tool_message]})

            case _:
                raise ValueError(f"Unknown action: {action}")
