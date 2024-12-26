import json
from typing import Any
from uuid import uuid4

from langchain_core.documents import Document
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.base import CheckpointTuple
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection

from app.core.config import settings
from app.core.graph.messages import ChatResponse


def convert_checkpoint_tuple_to_messages(
    checkpoint_tuple: CheckpointTuple,
) -> list[ChatResponse]:
    """
    Convert a checkpoint tuple to a list of ChatResponse messages.

    Args:
        checkpoint_tuple (CheckpointTuple): The checkpoint tuple to convert.

    Returns:
        list[ChatResponse]: A list of formatted messages.
    """
    checkpoint = checkpoint_tuple.checkpoint
    all_messages: list[AnyMessage] = (
        checkpoint["channel_values"]["all_messages"]
        + checkpoint["channel_values"]["messages"]
    )
    formatted_messages: list[ChatResponse] = []
    for message in all_messages:
        if isinstance(message, HumanMessage):
            content = ""
            imgdata = None

            if isinstance(message.content, list):
                for c in message.content:
                    if isinstance(c, dict):
                        if c.get("type") == "text":
                            content += c.get("text", "")
                        elif c.get("type") == "image_url":
                            imgdata = c.get("image_url", {}).get("url")
            else:
                content = message.content

            formatted_messages.append(
                ChatResponse(
                    type="human",
                    id=message.id,
                    name=message.name,
                    content=content,
                    imgdata=imgdata,
                )
            )
        elif (
            isinstance(message, AIMessage)
            and message.id
            and message.name
            and isinstance(message.content, str)
        ):
            formatted_messages.append(
                ChatResponse(
                    type="ai",
                    id=message.id,
                    name=message.name,
                    tool_calls=message.tool_calls,
                    content=message.content,
                )
            )
        elif isinstance(message, ToolMessage) and message.name:
            documents: list[dict[str, Any]] = []
            if message.name == "KnowledgeBase":
                docs: list[Document] = message.artifact
                for doc in docs:
                    documents.append(
                        {
                            "score": doc.metadata["score"],
                            "content": doc.page_content,
                        }
                    )
            formatted_messages.append(
                ChatResponse(
                    type="tool",
                    id=message.tool_call_id,
                    name=message.name,
                    tool_output=json.dumps(message.content),
                    documents=json.dumps(documents),
                )
            )
        else:
            continue

    last_message = all_messages[-1]
    if last_message.type == "ai" and last_message.tool_calls:
        # Check if any tool in last message is asking for human input
        for tool_call in last_message.tool_calls:
            if tool_call["name"] == "ask-human":
                formatted_messages.append(
                    ChatResponse(
                        type="interrupt",
                        name="human",
                        tool_calls=last_message.tool_calls,
                        id=str(uuid4()),
                    )
                )
                break
        else:
            formatted_messages.append(
                ChatResponse(
                    type="interrupt",
                    name="interrupt",
                    tool_calls=last_message.tool_calls,
                    id=str(uuid4()),
                )
            )
    return formatted_messages


async def get_checkpoint_tuples(thread_id: str) -> CheckpointTuple | None:
    """
    Retrieve the latest checkpoint tuple for a given thread ID.

    Args:
        thread_id (str): The ID of the thread.

    Returns:
        CheckpointTuple: The latest checkpoint tuple.
    """
    async with await AsyncConnection.connect(
        settings.PG_DATABASE_URI, **settings.SQLALCHEMY_CONNECTION_KWARGS
    ) as conn:
        checkpointer = AsyncPostgresSaver(conn=conn)
        checkpoint_tuple = await checkpointer.aget_tuple(
            {"configurable": {"thread_id": thread_id}}
        )
        return checkpoint_tuple
