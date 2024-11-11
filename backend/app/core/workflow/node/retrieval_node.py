import logging
import uuid

from app.core.rag.qdrant import QdrantStore
from app.core.tools.retriever_tool import create_retriever_tool_custom_modified

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from app.core.workflow.node.state import (
    ReturnTeamState,
    TeamState,
    parse_variables,
    update_node_outputs,
)


class RetrievalNode:
    def __init__(self, node_id: str, query: str, user_id: int, kb_id: int):
        self.node_id = node_id
        self.query = query
        self.qdrant_store = QdrantStore()
        self.user_id = user_id
        self.kb_id = kb_id

    async def work(self, state: TeamState, config: RunnableConfig) -> ReturnTeamState:

        if "node_outputs" not in state:
            state["node_outputs"] = {}

        if self.query:
            parsed_input_schema = parse_variables(self.query, state["node_outputs"])
            retrieval_result = self._retrieval_work(parsed_input_schema)
            result = ToolMessage(
                content=retrieval_result,
                # name="KnowledgeBase",
                name="KnowledRetrievel",
                tool_call_id=str(uuid.uuid4()),
            )
        else:
            messages = state.get("all_messages", [])
            result = AIMessage(
                content=messages[-1].content if messages else "No answer available."
            )

        # 更新 node_outputs
        new_output = {self.node_id: {"response": result.content}}
        state["node_outputs"] = update_node_outputs(state["node_outputs"], new_output)
        return_state: ReturnTeamState = {
            "history": state.get("history", []) + [result],
            "messages": [result],
            "all_messages": state.get("all_messages", []) + [result],
            "node_outputs": state["node_outputs"],
        }
        return return_state

    def _retrieval_work(self, qry):

        retriever = self.qdrant_store.retriever(self.user_id, self.kb_id)

        retriever_tool = create_retriever_tool_custom_modified(retriever)

        result_string, docs = retriever_tool._run(qry)

        logger.info(f"Retriever tool result: {result_string[:100]}...")
        return result_string
