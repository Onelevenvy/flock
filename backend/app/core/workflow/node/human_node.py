from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command, interrupt
from app.models import InterruptDecision
from ...state import ReturnWorkflowTeamState, WorkflowTeamState, update_node_outputs


# class HumanInteractionType(str, Enum):
#     """人机交互类型"""

#     APPROVAL = "approval"  # 审批流程（包含批准和拒绝）
#     FEEDBACK = "feedback"  # 反馈流程


class HumanNode:
    """通用的人机交互节点，支持审批流程和反馈流程"""

    # 定义固定的交互选项
    HUMAN_APPROVE = "human_approve"
    HUMAN_REJECT = "human_reject"
    HUMAN_FEEDBACK = "human_feedback"

    def __init__(
        self,
        node_id: str,
        interaction_type: InterruptDecision, 
        routes: dict[str, str],  # 路由配置
        title: str | None = None,  # 自定义标题
    ):
        """
        初始化人机交互节点

        Args:
            node_id: 节点ID
            interaction_type: 交互类型（APPROVAL 或 FEEDBACK）
            routes: 不同操作的路由配置
                对于 APPROVAL 类型:
                {
                    "human_approve": "approved_node_id",
                    "human_reject": "rejected_node_id"
                }
                对于 FEEDBACK 类型:
                {
                    "human_feedback": "feedback_node_id"
                }
            title: 交互界面的标题
        """
        self.node_id = node_id
        self.interaction_type = interaction_type
        self.routes = routes
        self.title = title or (
            "Human Approval Required"
            if interaction_type == InterruptDecision.HUMAN_NODE_APPROVAL
            else "Human Feedback Required"
        )

        # 验证路由配置
        if interaction_type == InterruptDecision.HUMAN_NODE_APPROVAL:
            if not (self.HUMAN_APPROVE in routes and self.HUMAN_REJECT in routes):
                raise ValueError(
                    f"Approval flow requires both '{self.HUMAN_APPROVE}' and '{self.HUMAN_REJECT}' routes"
                )
            invalid_routes = set(routes.keys()) - {
                self.HUMAN_APPROVE,
                self.HUMAN_REJECT,
            }
            if invalid_routes:
                raise ValueError(f"Invalid routes for approval flow: {invalid_routes}")
        else:  # FEEDBACK
            if self.HUMAN_FEEDBACK not in routes:
                raise ValueError(
                    f"Feedback flow requires '{self.HUMAN_FEEDBACK}' route"
                )
            invalid_routes = set(routes.keys()) - {self.HUMAN_FEEDBACK}
            if invalid_routes:
                raise ValueError(f"Invalid routes for feedback flow: {invalid_routes}")

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState | Command[str]:
        """处理人机交互工作流"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # 获取最后一条消息用于展示
        last_message = None
        if state.get("all_messages"):
            last_message = state["all_messages"][-1]

        # 准备交互数据
        interaction_data = {
            "message": last_message.content if last_message else "",
            "type": last_message.type if last_message else "none",
            "tool_calls": (
                last_message.tool_calls if hasattr(last_message, "tool_calls") else None
            ),
        }

        # 根据交互类型设置可用选项
        options = (
            [self.HUMAN_APPROVE, self.HUMAN_REJECT]
            if self.interaction_type == InterruptDecision.HUMAN_NODE_APPROVAL
            else [self.HUMAN_FEEDBACK]
        )

        # 使用 interrupt 等待人工输入
        human_response = interrupt(
            {
                "title": self.title,
                "context": interaction_data,
                "options": options,
                "interaction_type": self.interaction_type,  # 添加交互类型信息
            }
        )

        action = human_response.get("action")
        content = human_response.get("content", "")

        match action:
            case self.HUMAN_APPROVE:
                if last_message and hasattr(last_message, "tool_calls"):
                    tool_message = ToolMessage(
                        content="Approved by human reviewer",
                        name=last_message.tool_calls[0]["name"],
                        tool_call_id=last_message.tool_calls[0]["id"],
                    )
                    messages = [tool_message]
                else:
                    messages = [AIMessage(content="Approved by human reviewer")]

                new_output = {
                    self.node_id: {
                        "action": "approve",
                        "response": "Approved by human reviewer",
                    }
                }

            case self.HUMAN_REJECT:
                reject_message = HumanMessage(
                    content=f"Rejected by human reviewer: {content}"
                )
                messages = [reject_message]
                new_output = {
                    self.node_id: {
                        "action": "reject",
                        "response": f"Rejected: {content}",
                    }
                }

            case self.HUMAN_FEEDBACK:
                feedback_message = HumanMessage(content=f"Human feedback: {content}")
                messages = [feedback_message]
                new_output = {
                    self.node_id: {
                        "action": "feedback",
                        "response": content,
                    }
                }

            case _:
                raise ValueError(f"Unknown action: {action}")

        # 更新节点输出
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)

        # 根据action获取下一个节点
        next_node = self.routes.get(action)
        if next_node:
            return Command(
                goto=next_node,
                update={
                    "messages": messages,
                    "history": state.get("history", []) + messages,
                    "all_messages": state.get("all_messages", []) + messages,
                    "node_outputs": state["node_outputs"],
                },
            )

        return_state: ReturnWorkflowTeamState = {
            "messages": messages,
            "history": state.get("history", []) + messages,
            "all_messages": state.get("all_messages", []) + messages,
            "node_outputs": state["node_outputs"],
        }

        return return_state
