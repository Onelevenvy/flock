from typing import Any, Dict

from langgraph.graph import StateGraph

from app.core.workflow.node.state import ReturnTeamState, TeamState


class SubgraphNode:
    def __init__(self, subgraph: StateGraph):
        self.subgraph = subgraph

    async def work(self, state: TeamState, config: Dict[str, Any]) -> ReturnTeamState:
        # 转换输入状态
        subgraph_input = self._transform_input(state)

        # 运行subgraph
        subgraph_output = await self.subgraph.ainvoke(subgraph_input, config)

        # 转换输出状态
        return self._transform_output(state, subgraph_output)

    def _transform_input(self, state: TeamState) -> TeamState:
        # 这里我们可以选择性地传递一些状态给子图
        # 例如，我们可能只想传递最后一条消息和部分历史记录
        return {
            "messages": state.get("messages", [])[-1:],  # 只传递最后一条消息
            "history": state.get("history", [])[-5:],  # 传递最后5条历史记录
            "team": state.get("team", {}),  # 传递团队信息
            "node_outputs": state.get("node_outputs", {}),  # 传递节点输出
        }

    def _transform_output(
        self, original_state: TeamState, subgraph_output: TeamState
    ) -> ReturnTeamState:
        # 合并原始状态和子图输出
        return_state: ReturnTeamState = {
            "history": original_state.get("history", [])
            + subgraph_output.get("history", []),
            "messages": subgraph_output.get("messages", []),
            "all_messages": original_state.get("all_messages", [])
            + subgraph_output.get("all_messages", []),
            "node_outputs": {
                **original_state.get("node_outputs", {}),
                **subgraph_output.get("node_outputs", {}),
            },
        }

        # 如果子图修改了team或next，我们也应该更新这些
        if "team" in subgraph_output:
            return_state["team"] = subgraph_output["team"]
        if "next" in subgraph_output:
            return_state["next"] = subgraph_output["next"]

        return return_state
