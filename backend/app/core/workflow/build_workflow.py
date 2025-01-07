import time
from functools import cache
from typing import Any

from langchain.tools import BaseTool
from langchain.tools.retriever import create_retriever_tool
from langchain_core.messages import AIMessage, AnyMessage
from langchain_core.runnables import RunnableLambda
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.graph import CompiledGraph
from langgraph.prebuilt import ToolNode

from app.core.rag.qdrant import QdrantStore
from app.core.tools import managed_tools

from ..state import WorkflowTeamState
from .node.answer_node import AnswerNode
from .node.classifier_node import ClassifierNode
from .node.code.code_node import CodeNode
from .node.crewai_node import CrewAINode
from .node.ifelse.ifelse_node import IfElseNode
from .node.input_node import InputNode
from .node.llm_node import LLMNode
from .node.retrieval_node import RetrievalNode
from .node.subgraph_node import SubgraphNode
from .node.human_node import HumanNode
from app.models import InterruptDecision, InterruptType


def create_subgraph(subgraph_config: dict[str, Any]) -> CompiledGraph:
    subgraph_builder = StateGraph(WorkflowTeamState)

    # 添加subgraph的节点
    for node in subgraph_config["nodes"]:
        node_id = node["id"]
        node_type = node["type"]
        node_data = node["data"]

        if node_type == "answer":
            _add_answer_node(subgraph_builder, node_id, node_data)
        elif node_type == "retrieval":
            _add_retrieval_node(subgraph_builder, node_id, node_data)
        elif node_type == "llm":
            _add_llm_node(
                subgraph_builder,
                node_id,
                node_data,
                subgraph_config["nodes"],
                subgraph_config["edges"],
                False,
                False,
                {},
            )
        elif node_type in ["tool", "toolretrieval"]:
            _add_tool_node(subgraph_builder, node_id, node_type, node_data)

    # 添加subgraph的边
    for edge in subgraph_config["edges"]:
        _add_edge(subgraph_builder, edge, subgraph_config["nodes"], {})

    # 设置入口点并编译subgraph
    subgraph_builder.set_entry_point("InputNode")
    return subgraph_builder.compile()


def validate_config(config: dict[str, Any]) -> bool:
    required_keys = ["id", "name", "nodes", "edges", "metadata"]
    return all(key in config for key in required_keys)


@cache
def get_tool(tool_name: str) -> BaseTool:
    for _, tool in managed_tools.items():
        if tool.display_name == tool_name:
            return tool.tool
    raise ValueError(f"Unknown tool: {tool_name}")


@cache
def get_retrieval_tool(tool_name: str, description: str, owner_id: int, kb_id: int):
    retriever = QdrantStore().retriever(owner_id, kb_id)
    return create_retriever_tool(retriever, name=tool_name, description=description)


# 添加一个全局变量来存储工具名称到节点ID的映射
tool_name_to_node_id: dict[str, str] = {}


def should_continue_tools(state: WorkflowTeamState) -> str:
    messages: list[AnyMessage] = state["messages"]
    if messages and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
        for tool_call in messages[-1].tool_calls:

            tool_name = tool_call["name"].lower()
            for node_id, tools in tool_name_to_node_id.items():
                if tool_name in tools:
                    return node_id
    return "default"


def should_continue_classifier(state: WorkflowTeamState) -> str:
    """专门处理分类器节点的条件判断"""
    if "node_outputs" in state:
        for node_id, outputs in state["node_outputs"].items():
            if "category_id" in outputs:
                return outputs["category_id"]
    return "default"


def should_continue_ifelse(state: WorkflowTeamState) -> str:
    """处理 if-else 节点的条件判断"""
    if "node_outputs" in state:
        for node_id, outputs in state["node_outputs"].items():
            if "result" in outputs:
                return outputs["result"]
    return "false_else"  # 默认返回 ELSE 分支


def _add_classifier_conditional_edges(
    graph_builder, classifier_node_id: str, nodes: list, edges: list
):
    """专门处理分类器节点的条件边"""
    # 获取分类器节点的配置
    classifier_node = next(
        (node for node in nodes if node["id"] == classifier_node_id), None
    )
    if not classifier_node:
        return

    # 构建分类器的条件边字典
    edges_dict = {}

    # 获取所有从分类器出发的边
    classifier_edges = [edge for edge in edges if edge["source"] == classifier_node_id]

    # 为每个分类类别创建条件边
    for edge in classifier_edges:
        target_node = next(
            (node for node in nodes if node["id"] == edge["target"]), None
        )
        if target_node:
            # 检查边的sourceHandle是否匹配任何category_id
            source_handle = edge.get("sourceHandle")
            if source_handle:  # 如果有sourceHandle，使用它作为路由键
                edges_dict[source_handle] = edge["target"]

    # 添加默认路径
    default_edge = next(
        (edge for edge in classifier_edges if edge.get("type") == "default"), None
    )
    edges_dict["default"] = default_edge["target"] if default_edge else END

    # 添加条件边到图中
    if edges_dict:
        graph_builder.add_conditional_edges(
            classifier_node_id, should_continue_classifier, edges_dict
        )


def _add_ifelse_conditional_edges(
    graph_builder, ifelse_node_id: str, nodes: list, edges: list
):
    """处理 if-else 节点的条件边"""
    # 获取 if-else 节点的配置
    ifelse_node = next((node for node in nodes if node["id"] == ifelse_node_id), None)
    if not ifelse_node:
        return

    # 构建条件边字典
    edges_dict = {}

    # 获取所有从 if-else 出发的边
    ifelse_edges = [edge for edge in edges if edge["source"] == ifelse_node_id]

    # 为每个 case 创建条件边
    for edge in ifelse_edges:
        target_node = next(
            (node for node in nodes if node["id"] == edge["target"]), None
        )
        if target_node:
            source_handle = edge.get("sourceHandle")
            if source_handle:  # 如果有 sourceHandle，使用它作为路由键
                edges_dict[source_handle] = edge["target"]

    # 添加默认路径
    default_edge = next(
        (edge for edge in ifelse_edges if edge.get("sourceHandle") == "false"), None
    )
    edges_dict["false"] = default_edge["target"] if default_edge else END

    # 添加条件边到图中
    if edges_dict:
        graph_builder.add_conditional_edges(
            ifelse_node_id, should_continue_ifelse, edges_dict
        )


def initialize_graph(
    build_config: dict[str, Any],
    checkpointer: BaseCheckpointSaver,
    save_graph_img=False,
) -> CompiledGraph:
    global tool_name_to_node_id

    if not validate_config(build_config):
        raise ValueError("Invalid configuration structure")

    try:
        graph_builder = StateGraph(WorkflowTeamState)
        nodes = build_config["nodes"]
        edges = build_config["edges"]

        graph_builder.add_node("InputNode", InputNode)

        # 创建工具名称到节点ID的映射
        tool_name_to_node_id = _create_tool_name_mapping(nodes)

        # Determine graph type
        is_sequential, is_hierarchical = _determine_graph_type(nodes, edges)

        # Create dictionaries for LLM children and conditional edges
        llm_children = _create_llm_children_dict(nodes, edges)
        conditional_edges = _create_conditional_edges_dict(nodes)

        # Add nodes
        for node in nodes:
            node_id = node["id"]
            node_type = node["type"]
            node_data = node["data"]

            if node_type == "crewai":
                _add_crewai_node(graph_builder, node_id, node_type, node_data)
            elif node_type == "subgraph":
                subgraph = create_subgraph(node_data)
                graph_builder.add_node(node_id, subgraph)
            elif node_type == "answer":
                _add_answer_node(graph_builder, node_id, node_data)
            elif node_type == "retrieval":
                _add_retrieval_node(graph_builder, node_id, node_data)
            elif node_type == "llm":
                _add_llm_node(
                    graph_builder,
                    node_id,
                    node_data,
                    nodes,
                    edges,
                    is_sequential,
                    is_hierarchical,
                    llm_children,
                )
            elif node_type in ["tool", "toolretrieval"]:
                _add_tool_node(graph_builder, node_id, node_type, node_data)
            elif node_type == "classifier":
                _add_classifier_node(graph_builder, node_id, node_data)
            elif node_type == "code":
                _add_code_node(graph_builder, node_id, node_data)
            elif node_type == "ifelse":
                _add_ifelse_node(graph_builder, node_id, node_data)
            elif node_type == "human":
                _add_human_node(graph_builder, node_id, node_data)

        # Add edges
        for edge in edges:
            _add_edge(graph_builder, edge, nodes, conditional_edges)

        # Add conditional edges
        _add_conditional_edges(graph_builder, conditional_edges, nodes)

        # 添加分类器节点的条件边
        classifier_nodes = [
            node["id"] for node in nodes if node["type"] == "classifier"
        ]

        for classifier_node_id in classifier_nodes:
            _add_classifier_conditional_edges(
                graph_builder, classifier_node_id, nodes, edges
            )

        if_else_nodes = [node["id"] for node in nodes if node["type"] == "ifelse"]
        for if_else_node_id in if_else_nodes:
            _add_ifelse_conditional_edges(graph_builder, if_else_node_id, nodes, edges)

        # Set entry point and compile graph
        graph_builder.set_entry_point("InputNode")

        # Compile graph
        hitl_config = build_config.get("metadata", {}).get("human_in_the_loop", {})
        interrupt_before = hitl_config.get("interrupt_before", [])
        interrupt_after = hitl_config.get("interrupt_after", [])
        graph = graph_builder.compile(
            checkpointer=checkpointer,
            # interrupt_before=["tool-4"],  # 测试 interrupt ok
            interrupt_before=interrupt_before,
            interrupt_after=interrupt_after,
        )

        # save graph image
        if save_graph_img:
            # if True:
            try:
                img_data = graph.get_graph().draw_mermaid_png()
                with open(f"save_graph_{time.time()}.png", "wb") as f:
                    f.write(img_data)
            except Exception:
                pass

        return graph

    except KeyError as e:
        raise ValueError(f"Invalid configuration: missing key {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to initialize graph: {e}")


# 辅助函数
def _create_tool_name_mapping(nodes):
    tool_name_to_node_id = {}
    for node in nodes:
        if node["type"] == "tool":
            tool_name_to_node_id[node["id"]] = [
                tool.lower() for tool in node["data"]["tools"]
            ]
        if node["type"] == "toolretrieval":
            tool_name_to_node_id[node["id"]] = [
                tool["name"].lower() for tool in node["data"]["tools"]
            ]
    return tool_name_to_node_id


def _determine_graph_type(nodes, edges):
    llm_nodes = [node for node in nodes if node["type"] == "llm"]
    is_sequential = len(llm_nodes) > 1 and all(
        any(
            edge["source"] == node["id"] and edge["target"] == next_node["id"]
            for edge in edges
        )
        for node, next_node in zip(llm_nodes[:-1], llm_nodes[1:], strict=False)
    )
    is_hierarchical = len(llm_nodes) > 1 and not is_sequential
    return is_sequential, is_hierarchical


def _create_llm_children_dict(nodes, edges):
    llm_children = {node["id"]: set() for node in nodes if node["type"] == "llm"}
    for edge in edges:
        source, target = edge["source"], edge["target"]
        if source in llm_children:
            target_node = next((node for node in nodes if node["id"] == target), None)
            if target_node and target_node["type"] == "llm":
                llm_children[source].add(target)
    return llm_children


def _create_conditional_edges_dict(nodes):
    return {
        node["id"]: {"default": {}, "call_tools": {}, "ask-human": {}}
        for node in nodes
        if node["type"] == "llm"
    }


def _add_answer_node(graph_builder, node_id, node_data):
    graph_builder.add_node(
        node_id,
        (
            AnswerNode(
                node_id,
                input_schema=node_data.get("answer", None),
            ).work
        ),
    )


def _add_retrieval_node(graph_builder, node_id, node_data):
    graph_builder.add_node(
        node_id,
        (
            RetrievalNode(
                node_id,
                query=node_data["query"],
                user_id=node_data["usr_id"],
                kb_id=node_data["kb_id"],
            ).work
        ),
    )


def _add_llm_node(
    graph_builder,
    node_id,
    node_data,
    nodes,
    edges,
    is_sequential,
    is_hierarchical,
    llm_children,
):
    model_name = node_data["model"]

    if is_sequential:
        node_class = LLMNode
    elif is_hierarchical:
        if llm_children[node_id]:
            node_class = LLMNode
        else:
            node_class = LLMNode
    else:
        node_class = LLMNode

    tools_to_bind = _get_tools_to_bind(node_id, edges, nodes)

    if node_data.get("type") == "subgraph":
        subgraph = create_subgraph(node_data["subgraph_config"])
        graph_builder.add_node(node_id, SubgraphNode(subgraph).work)
    else:
        graph_builder.add_node(
            node_id,
            RunnableLambda(
                node_class(
                    node_id,
                    model_name=model_name,
                    tools=tools_to_bind,
                    temperature=node_data["temperature"],
                    system_prompt=node_data.get("systemMessage", None),
                    agent_name=node_data.get("label", node_id),
                ).work
            ),
        )


def _get_tools_to_bind(node_id, edges, nodes):
    tools_to_bind = []
    for edge in edges:
        if edge["source"] == node_id:
            target_node = next((n for n in nodes if n["id"] == edge["target"]), None)
            if target_node and target_node["type"] == "tool":
                tools_to_bind.extend(
                    [get_tool(tool_name) for tool_name in target_node["data"]["tools"]]
                )
            if target_node and target_node["type"] == "toolretrieval":
                tools_to_bind.extend(
                    [
                        get_retrieval_tool(
                            tool["name"],
                            tool["description"],
                            tool["usr_id"],
                            tool["kb_id"],
                        )
                        for tool in target_node["data"]["tools"]
                    ]
                )
    return tools_to_bind


def _add_tool_node(graph_builder, node_id, node_type, node_data):
    if node_type == "tool":
        tools = [get_tool(tool_name) for tool_name in node_data["tools"]]
    else:  # toolretrieval
        tools = [
            get_retrieval_tool(
                tool["name"],
                tool["description"],
                tool["usr_id"],
                tool["kb_id"],
            )
            for tool in node_data["tools"]
        ]
    graph_builder.add_node(node_id, ToolNode(tools))


def _add_edge(graph_builder, edge, nodes, conditional_edges):
    source_node = next(node for node in nodes if node["id"] == edge["source"])
    target_node = next(node for node in nodes if node["id"] == edge["target"])

    if source_node["type"] == "start":
        if edge["type"] == "default":
            graph_builder.add_edge(START, "InputNode")
            graph_builder.add_edge("InputNode", edge["target"])
        else:
            raise ValueError("Start node can only have normal edge.")
    elif source_node["type"] == "llm":
        if target_node["type"].startswith("tool"):
            if edge["type"] == "default":
                graph_builder.add_edge(edge["source"], edge["target"])
            else:
                conditional_edges[source_node["id"]]["call_tools"][
                    target_node["id"]
                ] = target_node["id"]
        elif target_node["type"] == "end":
            if edge["type"] == "default":
                graph_builder.add_edge(edge["source"], END)
            else:
                conditional_edges[source_node["id"]]["default"][END] = END
        elif target_node["type"] == "llm":
            if edge["type"] == "default":
                graph_builder.add_edge(edge["source"], edge["target"])
            else:
                conditional_edges[source_node["id"]]["default"][target_node["id"]] = (
                    target_node["id"]
                )
        else:
            if edge["type"] == "default":
                graph_builder.add_edge(edge["source"], edge["target"])
            else:
                conditional_edges[source_node["id"]]["default"][target_node["id"]] = (
                    target_node["id"]
                )
    elif source_node["type"].startswith("tool") and target_node["type"] == "llm":
        graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"].startswith("tool") and target_node["type"] == "human":
        graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"] == "retrieval":
        graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"] == "answer":
        if target_node["type"] == "end":
            graph_builder.add_edge(edge["source"], END)
        else:
            graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"] == "crewai":
        if target_node["type"] == "end":
            graph_builder.add_edge(edge["source"], END)
        else:
            graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"] == "subgraph":
        graph_builder.add_edge(edge["source"], edge["target"])
    elif target_node["type"] == "subgraph":
        graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"] == "code":
        if target_node["type"] == "end":
            graph_builder.add_edge(edge["source"], END)
        else:
            graph_builder.add_edge(edge["source"], edge["target"])
    elif source_node["type"] in [
        "classifier",
        "ifelse",
    ]:  # classifier 必定是conditional_edges 不会有普通边，if else node也一样
        if target_node["type"] == "end":
            graph_builder.add_edge(edge["source"], END)
    elif source_node["type"] == "human":
        if target_node["type"] == "end":
            graph_builder.add_edge(edge["source"], END)
        else:
            graph_builder.add_edge(edge["source"], edge["target"])


def _add_conditional_edges(graph_builder, conditional_edges, nodes):
    """Add conditional edges to graph"""
    for node_id, conditions in conditional_edges.items():
        edges_dict = {
            "default": next(iter(conditions["default"].values()), END),
            **conditions["call_tools"],
        }

        if conditions["ask-human"]:
            edges_dict["ask-human"] = next(iter(conditions["ask-human"].values()))

        if edges_dict != {"default": END}:
            graph_builder.add_conditional_edges(
                node_id, should_continue_tools, edges_dict
            )


def _add_crewai_node(graph_builder, node_id, node_type, node_data):
    """Add a CrewAI node to the graph"""
    # 确保必要的配置存在
    if not node_data.get("agents"):
        raise ValueError("CrewAI node requires agents configuration")
    if not node_data.get("tasks"):
        raise ValueError("CrewAI node requires tasks configuration")

    llm_config = node_data.get("llm_config", {})
    if not llm_config.get("model"):
        raise ValueError("CrewAI node requires llm model configuration")

    process_type = node_data.get("process_type", "sequential")

    # 创建 CrewAI 节点
    crewai_node = CrewAINode(
        node_id=node_id,
        model_name=llm_config["model"],
        agents_config=node_data["agents"],
        tasks_config=node_data["tasks"],
        process_type=process_type,
        manager_config=node_data.get("manager_config", {}),
        config=node_data.get("config", {}),
    )

    # 添加节点到图中
    graph_builder.add_node(node_id, crewai_node.work)

    # 如果是 hierarchical 模式，确保有 manager 配置
    if process_type == "hierarchical" and not node_data.get("manager_config", {}).get(
        "agent"
    ):
        raise ValueError("Hierarchical process requires manager agent configuration")


def _add_classifier_node(graph_builder, node_id, node_data):
    """Add classifier node to graph"""

    graph_builder.add_node(
        node_id,
        ClassifierNode(
            node_id=node_id,
            model_name=node_data["model"],
            categories=node_data["categories"],
            input=node_data.get("input", ""),
        ).work,
    )


def _add_code_node(graph_builder, node_id, node_data):
    """Add code execution node to graph"""
    graph_builder.add_node(
        node_id,
        (
            CodeNode(
                node_id=node_id,
                code=node_data["code"],
                libraries=node_data.get("libraries", []),  # Optional libraries list
                timeout=node_data.get("timeout", 30),  # Default timeout 30 seconds
                memory_limit=node_data.get(
                    "memory_limit", "256m"
                ),  # Default memory limit
            ).work
        ),
    )


def _add_ifelse_node(graph_builder, node_id: str, node_data: dict[str, Any]):
    """Add if-else node to graph"""
    graph_builder.add_node(
        node_id,
        IfElseNode(
            node_id=node_id,
            cases=node_data["cases"],
        ).work,
    )


def _add_human_node(graph_builder, node_id: str, node_data: dict[str, Any]):
    """Add human node to graph"""
    graph_builder.add_node(
        node_id,
        HumanNode(
            node_id=node_id,
            routes=node_data.get("routes", {}),
            title=node_data.get("title"),
            interaction_type=node_data.get(
                "interaction_type", InterruptType.TOOL_REVIEW
            ),
        ).work,
    )
