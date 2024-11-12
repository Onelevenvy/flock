import json
from typing import Any

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


def event_to_response(event: StreamEvent) -> ChatResponse | None:
    """Convert event to ChatResponse"""

    kind = event["event"]
    id = event["run_id"]

    # node_name = event.get("metadata", {}).get("langgraph_node", "")
    # name = event.get("name", "")
    # print("---------------------------")

    # print("event kind:", kind)
    # print("name:", name)
    # print("node_name data:", node_name)

    if kind == "on_chat_model_stream":
        name = event["metadata"]["langgraph_node"]
        message_chunk: AIMessageChunk = event["data"]["chunk"]
        type = get_message_type(message_chunk)
        content: str = ""
        if isinstance(message_chunk.content, list):
            for c in message_chunk.content:
                if isinstance(c, str):
                    content += c
                elif isinstance(c, dict):
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
        name = event["metadata"]["langgraph_node"]
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
        # If tool is , KnowledgeBase then serialise the documents in artifact
        documents: list[dict[str, Any]] = []
        if tool_output and tool_output.name == "KnowledgeBase":
            docs: list[Document] = tool_output.artifact
            for doc in docs:
                documents.append(
                    {
                        # "score": doc.metadata["score"],
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

    # elif kind == "on_parser_end":
    #     content: str = event["data"]["output"].get("task")
    #     next = event["data"]["output"].get("next")
    #     name = event["metadata"]["langgraph_node"]
    #     return ChatResponse(
    #         type=get_message_type(event["data"]["input"]),
    #         id=id,
    #         name=name,
    #         content=content,
    #         next=next,
    #     )

    elif kind == "on_chain_end":
        output = event["data"]["output"]

        # 只处理 AnswerNode 的输出
        name = event.get("name", "")
        if name and name.startswith("answer"):
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
                # 这里可能需要额外的逻辑来确定是否应该返回这个消息　　ＴＯＤＯ
                return ChatResponse(
                    type="ai",
                    id=id,
                    name=name,
                    content=output.content,
                )
    elif kind == "on_chain_stream":
        output = event["data"]["chunk"]
        # 只处理 Retrieval Node 的输出
        name = event.get("name", "")
        if name and name.startswith("retrieval"):
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
                # 这里可能需要额外的逻辑来确定是否应该返回这个消息　ＴＯＤＯ
                return ChatResponse(
                    type="tool",
                    id=id,
                    name=name,
                    content=output.content,
                )
        if name and name.startswith("crewai"):
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
                # 这里可能需要额外的逻辑来确定是否应该返回这个消息　　ＴＯＤＯ
                return ChatResponse(
                    type="ai",
                    id=id,
                    name=name,
                    content=output.content,
                )
        if (
            name
            and name.startswith("classifier")
            and isinstance(output, dict)
            and "node_outputs" in output
        ):
            for _, outputs in output["node_outputs"].items():
                if "category_name" in outputs:
                    return ChatResponse(
                        type="ai",
                        id=id,
                        name=name,
                        content=outputs["category_name"],
                    )

    return None
