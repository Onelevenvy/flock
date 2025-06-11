import logging
from typing import Annotated, Literal

from langchain_core.documents import Document
from langchain_core.prompts import (BasePromptTemplate, PromptTemplate,
                                    format_document)
from langchain_core.retrievers import BaseRetriever
from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)


class RetrieverTool(BaseTool):
    name: str = "KnowledgeBase"
    description: str = "Query documents for answers."
    response_format: Literal["content", "content_and_artifact"] = "content_and_artifact"

    retriever: BaseRetriever
    document_prompt: BasePromptTemplate | PromptTemplate
    document_separator: str

    def _run(
        self, query: Annotated[str, "query to look up in retriever"]
    ) -> tuple[str, list[Document]]:
        """Retrieve documents from knowledge base."""
        logger.debug(f"Retrieving documents for query: {query}")
        docs = self.retriever.invoke(query, config={"callbacks": self.callbacks})
        logger.debug(f"Retrieved {len(docs)} documents")

        if not docs:
            logger.warning("No documents retrieved")
            return "", []

        result_string = self.document_separator.join(
            [format_document(doc, self.document_prompt) for doc in docs]
        )
        logger.debug(
            f"Formatted result string (first 100 chars): {result_string[:100]}..."
        )
        return result_string, docs


def create_retriever_tool_custom_modified(
    retriever: BaseRetriever,
    document_prompt: BasePromptTemplate | None = None,
    document_separator: str = "\n\n",
) -> BaseTool:
    document_prompt = document_prompt or PromptTemplate.from_template("{page_content}")
    return RetrieverTool(
        retriever=retriever,
        document_prompt=document_prompt,
        document_separator=document_separator,
    )
