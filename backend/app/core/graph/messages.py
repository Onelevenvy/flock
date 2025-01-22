import json
from typing import Any, Dict

from langchain_core.documents import Document
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    HumanMessage,
    HumanMessageChunk,
    ToolCall,
    ToolMessage,
    ToolMessageChunk,
)
from langchain_core.runnables.schema import StreamEvent
from pydantic import BaseModel


def get_node_label(node_id: str, nodes: list[Dict[str, Any]] | None = None) -> str:
    """Get node label from node id"""
    if not nodes:
        return node_id
    for node in nodes:
        if node["id"] == node_id:
            return node["data"].get("label", node_id)
    return node_id


class ChatResponse(BaseModel):
    type: str  # ai | human | tool
    id: str
    name: str
    content: str | None = None
    imgdata: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_output: str | None = None
    documents: str | None = None
    next: str | None = None


def get_message_type(message: Any) -> str | None:
    """Return the message's type"""
    if isinstance(message, HumanMessage) or isinstance(message, HumanMessageChunk):
        return "human"
    elif isinstance(message, AIMessage) or isinstance(message, AIMessageChunk):
        return "ai"
    elif isinstance(message, ToolMessage) or isinstance(message, ToolMessageChunk):
        return "tool"
    else:
        return None


def event_to_response(
    event: StreamEvent, nodes: list[Dict[str, Any]] | None = None
) -> ChatResponse | None:
    """Convert event to ChatResponse"""

    kind = event["event"]
    id = event["run_id"]

    if kind == "on_chat_model_stream":
        node_id = event["metadata"]["langgraph_node"]
        name = get_node_label(node_id, nodes) if nodes else node_id
        message_chunk: AIMessageChunk = event["data"]["chunk"]
        type = get_message_type(message_chunk)
        content: str = ""
        if isinstance(message_chunk.content, list):
            for c in message_chunk.content:
                if isinstance(c, str):
                    content += c
                elif isinstance(c, dict):
                    if c.get("type") == "text":
                        content += c.get("text", "")
        else:
            content = message_chunk.content
        tool_calls = message_chunk.tool_calls
        if content and type:
            return ChatResponse(
                type=type, id=id, name=name, content=content, tool_calls=tool_calls
            )
    elif kind == "on_chat_model_end":
        message: AIMessage = event["data"]["output"]
        node_id = event["metadata"]["langgraph_node"]
        name = get_node_label(node_id, nodes) if nodes else node_id
        tool_calls = message.tool_calls
        if tool_calls:
            return ChatResponse(
                type="tool",
                id=id,
                name=name,
                tool_calls=tool_calls,
            )

    elif kind == "on_tool_end":
        tool_output: ToolMessage | None = event["data"].get("output")
        tool_name = event["name"]
        # If tool is KnowledgeBase then serialise the documents in artifact
        documents: list[dict[str, Any]] = []
        if tool_output and tool_output.name == "KnowledgeBase":
            docs: list[Document] = tool_output.artifact
            for doc in docs:
                documents.append(
                    {
                        "content": doc.page_content,
                    }
                )
        if tool_output:
            return ChatResponse(
                type="tool",
                id=id,
                name=tool_name,
                tool_output=json.dumps(tool_output.content),
                documents=json.dumps(documents),
            )

    elif kind == "on_chain_end":
        output = event["data"]["output"]
        node_id = event.get("name", "")
        name = get_node_label(node_id, nodes) if nodes else node_id

        # 只处理 AnswerNode 的输出
        if node_id and node_id.startswith("answer"):
            if isinstance(output, dict):
                if "messages" in output and output["messages"]:
                    last_message = output["messages"][-1]
                    if isinstance(last_message, AIMessage):
                        return ChatResponse(
                            type="ai",
                            id=id,
                            name=name,
                            content=last_message.content,
                        )
            elif isinstance(output, AIMessage):
                return ChatResponse(
                    type="ai",
                    id=id,
                    name=name,
                    content=output.content,
                )
    elif kind == "on_chain_stream":
        output = event["data"]["chunk"]
        node_id = event.get("name", "")
        name = get_node_label(node_id, nodes) if nodes else node_id

        if node_id and node_id.startswith("retrieval"):
            if isinstance(output, dict):
                if "messages" in output and output["messages"]:
                    last_message = output["messages"][-1]
                    if isinstance(last_message, ToolMessage):
                        return ChatResponse(
                            type="tool",
                            id=id,
                            name=name,
                            tool_output=json.dumps(
                                last_message.content,
                            ),
                        )
            elif isinstance(output, AIMessage):
                return ChatResponse(
                    type="tool",
                    id=id,
                    name=name,
                    content=output.content,
                )
        elif node_id and node_id.startswith("crewai"):
            if isinstance(output, dict):
                if "messages" in output and output["messages"]:
                    last_message = output["messages"][-1]
                    if isinstance(last_message, AIMessage):
                        return ChatResponse(
                            type="ai",
                            id=id,
                            name=name,
                            content=last_message.content,
                        )
            elif isinstance(output, AIMessage):
                return ChatResponse(
                    type="ai",
                    id=id,
                    name=name,
                    content=output.content,
                )
        elif (
            node_id
            and node_id.startswith("classifier")
            and isinstance(output, dict)
            and "node_outputs" in output
        ):
            for _, outputs in output["node_outputs"].items():
                if "category_name" in outputs:
                    res = outputs["category_name"]
                    return ChatResponse(
                        type="ai",
                        id=id,
                        name=name,
                        content=f"用户意图：{res}",
                    )
        elif node_id and node_id.startswith("code"):
            if isinstance(output, dict):
                if "messages" in output and output["messages"]:
                    last_message = output["messages"][-1]
                    if isinstance(last_message, ToolMessage):
                        return ChatResponse(
                            type="tool",
                            id=id,
                            name=name,
                            tool_output=json.dumps(
                                last_message.content,
                            ),
                        )
            elif isinstance(output, AIMessage):
                return ChatResponse(
                    type="tool",
                    id=id,
                    name=name,
                    content=output.content,
                )

    return None
