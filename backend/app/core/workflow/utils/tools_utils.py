from functools import cache

from langchain.tools import BaseTool
from langchain.tools.retriever import create_retriever_tool

from app.core.rag.qdrant import QdrantStore
from app.core.tools import managed_tools


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
