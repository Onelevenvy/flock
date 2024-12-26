from typing import Any, Literal
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command, interrupt

from ...state import ReturnWorkflowTeamState, WorkflowTeamState, update_node_outputs


class HumanNode:
    """通用的人机交互节点，支持审批、拒绝和反馈等交互模式"""

    def __init__(self, node_id: str):
        self.node_id = node_id

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState | Command[str]:
        """
        处理人机交互工作流

        支持三种交互模式:
        1. human_approve - 人工审批，可以继续执行或修改后执行
        2. human_reject - 人工拒绝，可以终止流程或返回上一步
        3. human_feedback - 人工反馈，提供额外信息或建议
        """
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

        # 使用 interrupt 等待人工输入
        human_response = interrupt(
            {
                "title": "Human Review Required",
                "context": interaction_data,
                "options": ["approve", "reject", "feedback"],
            }
        )

        action = human_response.get("action")
        content = human_response.get("content", "")
        next_node = human_response.get("next_node", None)

        match action:
            case "approve":
                # 如果是工具调用的审批
                if last_message and hasattr(last_message, "tool_calls"):
                    tool_message = ToolMessage(
                        content="Approved by human reviewer",
                        name=last_message.tool_calls[0]["name"],
                        tool_call_id=last_message.tool_calls[0]["id"],
                    )
                    messages = [tool_message]
                else:
                    # 普通消息审批
                    messages = [AIMessage(content="Approved by human reviewer")]

                new_output = {
                    self.node_id: {
                        "action": "approve",
                        "response": "Approved by human reviewer",
                    }
                }

            case "reject":
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

            case "feedback":
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

        # 如果指定了下一个节点，使用 Command 进行跳转
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

        # 否则返回正常的状态更新
        return_state: ReturnWorkflowTeamState = {
            "messages": messages,
            "history": state.get("history", []) + messages,
            "all_messages": state.get("all_messages", []) + messages,
            "node_outputs": state["node_outputs"],
        }

        return return_state
