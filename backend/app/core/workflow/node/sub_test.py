import json
from typing import Any, Dict

from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, StateGraph

from app.core.workflow.node.llm_node import LLMNode
from app.core.workflow.node.state import ReturnTeamState, TeamState
from app.core.workflow.node.subgraph_node import SubgraphNode


# 1. 创建子图配置和节点
def create_subgraph_from_config(config: Dict[str, Any]) -> StateGraph:
    subgraph = StateGraph(TeamState)

    # 添加节点
    for node in config["nodes"]:
        if node["type"] == "llm":
            subgraph.add_node(
                node["id"],
                RunnableLambda(
                    LLMNode(
                        node_id=node["id"],
                        provider="openai",  # 假设使用OpenAI，您可以根据需要修改
                        model=node["data"]["model"],
                        tools=[],  # 这里可以添加工具如果需要
                        openai_api_key="XXXXXXX",  # 请替换为实际的API密钥
                        openai_api_base="https://open.bigmodel.cn/api/paas/v4",  # 可以根据需要修改
                        temperature=node["data"]["temperature"],
                        system_prompt=node["data"]["systemMessage"],
                        agent_name=node["data"]["customName"],
                    ).work
                ),
            )

    # 添加边
    start_node = None
    end_edges = []
    for edge in config["edges"]:
        if edge["source"] == "start":
            start_node = edge["target"]
        elif edge["target"] == "end":
            end_edges.append(edge["source"])
        else:
            subgraph.add_edge(edge["source"], edge["target"])

    # 设置入口点
    if start_node:
        subgraph.set_entry_point(start_node)
    else:
        raise ValueError("No start node found in the configuration")

    # 添加到END的边
    for source in end_edges:
        subgraph.add_edge(source, END)

    return subgraph.compile()


# 2. 创建SubgraphNode
async def test_subgraph_node():
    # 加载子图配置
    with open("backend/app/core/workflow/node/subconfig.json", "r") as f:
        subconfig = json.load(f)

    # 创建子图
    subgraph = create_subgraph_from_config(subconfig["config"])

    # 创建SubgraphNode
    subgraph_node = SubgraphNode(subgraph)

    # 3. 模拟工作流程
    initial_state: TeamState = {
        "messages": [
            {"role": "user", "content": "Let's play a word game,我先来恭喜发财"}
        ],
        "history": [],
        "all_messages": [],
        "node_outputs": {},
    }

    config: Dict[str, Any] = {}  # 这里可以添加任何必要的配置

    # 运行SubgraphNode
    result: ReturnTeamState = await subgraph_node.work(initial_state, config)

    # 打印结果
    print("Subgraph Node Result:")
    print(result)


# 运行测试
if __name__ == "__main__":
    import asyncio

    asyncio.run(test_subgraph_node())
    print("Test completed successfully!")
