from typing import Any
from langchain_core.runnables import RunnableConfig
import uuid
from langchain_core.messages import HumanMessage, ToolMessage
from app.core.state import (
    ReturnWorkflowTeamState,
    WorkflowTeamState,
    parse_variables,
    update_node_outputs,
)
from app.core.workflow.utils.db_utils import get_subgraph_by_id


class SubgraphNode:
    """Node for executing subgraph workflows"""

    def __init__(
        self,
        node_id: str,
        subgraph_id: int,
        input: str = "",
    ):
        self.node_id = node_id
        self.input = input
        # 初始化时编译子图
        self.subgraph_config, self.subgraph_name = get_subgraph_by_id(subgraph_id)
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
            parse_variables(self.input, state["node_outputs"]) if self.input else None
        )
        if not input_text and state.get("all_messages"):
            input_text = state["all_messages"][-1].content

        if input_text:

            try:
                # 执行子图
                input_state = {
                    "all_messages": [HumanMessage(content=input_text, name="user")],
                    "messages": [HumanMessage(content=input_text, name="user")],
                    "history": [HumanMessage(content=input_text, name="user")],
                    "node_outputs": state["node_outputs"],
                }
                result = await self.subgraph.ainvoke(input_state)
                subgraph_output = result["all_messages"][-1]
                subgraph_result = ToolMessage(
                    content=subgraph_output.content,
                    name=self.subgraph_name,
                    tool_call_id=str(uuid.uuid4()),
                )
                new_output = {self.node_id: {"response": subgraph_result.content}}
                state["node_outputs"] = update_node_outputs(
                    state["node_outputs"], new_output
                )

                return_state: ReturnWorkflowTeamState = {
                    "node_outputs": state["node_outputs"],
                }
                return return_state

            except Exception as e:
                # 处理子图执行错误
                error_message = f"Subgraph execution failed: {str(e)}"
                print(f"Error in subgraph {self.node_id}: {error_message}")

                new_output = {self.node_id: {"response": error_message}}
                state["node_outputs"] = update_node_outputs(
                    state["node_outputs"], new_output
                )
                raise
        else:
            raise ValueError("No input provided for subgraph node")
