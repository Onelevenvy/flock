from typing import Any
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, StateGraph

from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)


class SubgraphNode:
    """Node for executing subgraph workflows"""

    def __init__(
        self,
        node_id: str,
        subgraph_config: dict[str, Any],
        input: str = "",
    ):
        self.node_id = node_id
        self.subgraph_config = subgraph_config
        self.input = input
        # 初始化时编译子图
        self.subgraph = self._build_subgraph()

    def _build_subgraph(self):
        """Build and compile subgraph"""
        from app.core.workflow.build_workflow import initialize_graph

        # 使用主图的初始化函数来构建子图
        return initialize_graph(
            self.subgraph_config,
            checkpointer=None,  # 子图不需要checkpointer
            save_graph_img=False,
        )

    async def work(
        self, state: WorkflowTeamState, config: RunnableConfig
    ) -> ReturnWorkflowTeamState:
        """Execute subgraph workflow"""
        if "node_outputs" not in state:
            state["node_outputs"] = {}

        # Parse input variable if exists
        input_text = (
            parse_variables(self.input, state["node_outputs"]) if self.input else ""
        )
        if not input_text and state.get("all_messages"):
            input_text = state["all_messages"][-1].content

        # 获取子图的状态
        subgraph_state = self._get_subgraph_state(state)

        # 如果有输入文本，添加到子图状态
        if input_text:
            subgraph_state["input"] = input_text

        try:
            # 执行子图
            result = await self.subgraph.ainvoke(subgraph_state)

            # 更新父图状态
            self._update_parent_state(state, result)

            # 更新当前节点的输出
            new_output = {
                self.node_id: {
                    "result": result.get("node_outputs", {}),
                    "input": input_text,
                    "status": "success",
                }
            }
            state["node_outputs"] = update_node_outputs(
                state["node_outputs"], new_output
            )

            return_state: ReturnWorkflowTeamState = {
                "history": state.get("history", []) + result.get("history", []),
                "messages": result.get("messages", []),
                "all_messages": state.get("all_messages", [])
                + result.get("all_messages", []),
                "node_outputs": state["node_outputs"],
            }
            return return_state

        except Exception as e:
            # 处理子图执行错误
            error_message = f"Subgraph execution failed: {str(e)}"
            print(f"Error in subgraph {self.node_id}: {error_message}")

            # 更新错误状态到node_outputs
            new_output = {self.node_id: {"error": error_message, "status": "error"}}
            state["node_outputs"] = update_node_outputs(
                state["node_outputs"], new_output
            )
            raise

    def _get_subgraph_state(self, parent_state: WorkflowTeamState) -> WorkflowTeamState:
        """获取子图的状态"""
        if "subgraph_states" not in parent_state:
            parent_state["subgraph_states"] = {}

        if self.node_id not in parent_state["subgraph_states"]:
            parent_state["subgraph_states"][self.node_id] = WorkflowTeamState(
                messages=[],
                history=[],
                all_messages=[],
                node_outputs={},
            )

        return parent_state["subgraph_states"][self.node_id]

    def _update_parent_state(
        self, parent_state: WorkflowTeamState, subgraph_state: WorkflowTeamState
    ) -> None:
        """更新父图状态"""
        # 更新父图的节点输出
        parent_state["node_outputs"].update(
            {
                f"{self.node_id}.{key}": value
                for key, value in subgraph_state.get("node_outputs", {}).items()
            }
        )

        # 保存子图状态
        if "subgraph_states" not in parent_state:
            parent_state["subgraph_states"] = {}
        parent_state["subgraph_states"][self.node_id] = subgraph_state
