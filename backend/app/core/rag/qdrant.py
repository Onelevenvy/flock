import logging
import math
import re
from collections import Counter
from typing import Callable, List

from langchain_core.documents import Document
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from qdrant_client.http.models import PayloadSelectorExclude, UpdateResult
from qdrant_client.models import Distance, VectorParams

from app.core.config import settings
from app.core.rag.document_processor import load_and_split_document
from app.core.rag.embeddings import get_embedding_model

logger = logging.getLogger(__name__)


class QdrantStore:
    def __init__(self) -> None:
        self.collection_name = settings.QDRANT_COLLECTION
        # self.url = "http://localhost:6333"
        self.url = settings.QDRANT_URL
        self.embedding_model = get_embedding_model(settings.EMBEDDING_MODEL)

        logger.debug(f"Initializing QdrantStore with URL: {self.url}")

        self.client = QdrantClient(
            url=self.url, api_key=settings.QDRANT_SERVICE_API_KEY, prefer_grpc=False
        )
        logger.debug("QdrantClient initialized successfully")

        self._initialize_vector_store()

    def _initialize_vector_store(self):
        try:
            collections = self.client.get_collections().collections
            if self.collection_name not in [
                collection.name for collection in collections
            ]:
                logger.debug(f"Creating new collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_model.dimension, distance=Distance.COSINE
                    ),
                )
                logger.debug("Creating payload index for user_id")
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.user_id",
                    field_schema="integer",
                )
                logger.debug("Creating payload index for upload_id")
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="metadata.upload_id",
                    field_schema="integer",
                )
            else:
                logger.debug(f"Using existing collection: {self.collection_name}")

            collection_info = self.client.get_collection(self.collection_name)
            logger.debug(f"Collection info: {collection_info}")

            self.vector_store = QdrantVectorStore(
                client=self.client,
                collection_name=self.collection_name,
                embedding=self.embedding_model,
            )
        except Exception as e:
            logger.error(f"Error initializing vector store: {str(e)}", exc_info=True)
            raise

    def add(
        self,
        file_path_or_url: str,
        upload_id: int,
        user_id: int,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        callback: Callable[[], None] | None = None,
    ) -> None:
        try:
            docs = load_and_split_document(
                file_path_or_url, user_id, upload_id, chunk_size, chunk_overlap
            )
            # Ensure metadata is correctly set
            for doc in docs:
                doc.metadata["user_id"] = user_id
                doc.metadata["upload_id"] = upload_id

            initial_count = self.client.count(
                collection_name=self.collection_name,
                count_filter=rest.Filter(
                    must=[
                        rest.FieldCondition(
                            key="metadata.user_id", match=rest.MatchValue(value=user_id)
                        ),
                        rest.FieldCondition(
                            key="metadata.upload_id",
                            match=rest.MatchValue(value=upload_id),
                        ),
                    ]
                ),
            ).count

            self.vector_store.add_documents(docs)
            final_count = self.client.count(
                collection_name=self.collection_name,
                count_filter=rest.Filter(
                    must=[
                        rest.FieldCondition(
                            key="metadata.user_id", match=rest.MatchValue(value=user_id)
                        ),
                        rest.FieldCondition(
                            key="metadata.upload_id",
                            match=rest.MatchValue(value=upload_id),
                        ),
                    ]
                ),
            ).count

            added_count = final_count - initial_count
            logger.info(
                f"Added {added_count} documents for upload_id: {upload_id}, user_id: {user_id}"
            )

            if callback:
                callback()
        except Exception as e:
            logger.error(f"Error adding document: {str(e)}", exc_info=True)
            raise

    def delete(self, upload_id: int, user_id: int) -> bool:
        try:
            logger.debug(
                f"Attempting to delete points for upload_id: {upload_id}, user_id: {user_id}"
            )
            filter_condition = {
                "must": [
                    {"key": "metadata.user_id", "match": {"value": user_id}},
                    {"key": "metadata.upload_id", "match": {"value": upload_id}},
                ]
            }
            logger.debug(f"Delete filter condition: {filter_condition}")

            initial_count = self.client.count(
                collection_name=self.collection_name,
                count_filter=rest.Filter(**filter_condition),
            ).count
            logger.debug(f"Initial document count: {initial_count}")

            result: UpdateResult = self.client.delete(
                collection_name=self.collection_name,
                points_selector=rest.Filter(**filter_condition),
            )
            logger.debug(f"Delete operation result: {result}")

            if isinstance(result, UpdateResult) and result.status == "completed":
                final_count = self.client.count(
                    collection_name=self.collection_name,
                    count_filter=rest.Filter(**filter_condition),
                ).count
                logger.debug(f"Final document count: {final_count}")

                deleted_count = initial_count - final_count

                if deleted_count > 0:
                    logger.info(
                        f"Successfully deleted {deleted_count} points for upload_id: {upload_id}, user_id: {user_id}"
                    )
                    return True
                elif initial_count == 0:
                    logger.info(
                        f"No documents found to delete for upload_id: {upload_id}, user_id: {user_id}"
                    )
                    return True  # Consider this a successful operation as there's nothing to delete
                else:
                    logger.warning(
                        f"No points were deleted for upload_id: {upload_id}, user_id: {user_id}"
                    )
                    return False
            else:
                logger.error(
                    f"Delete operation failed or returned unexpected result: {result}"
                )
                return False
        except Exception as e:
            logger.error(f"Error deleting documents: {str(e)}", exc_info=True)
            return False

    def update(
        self,
        file_path_or_url: str,
        upload_id: int,
        user_id: int,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        callback: Callable[[], None] | None = None,
    ) -> None:
        deletion_successful = self.delete(upload_id, user_id)
        if not deletion_successful:
            logger.warning(
                f"Failed to delete existing documents for upload_id: {upload_id}, user_id: {user_id}. Proceeding with add operation."
            )
        self.add(file_path_or_url, upload_id, user_id, chunk_size, chunk_overlap)
        if callback:
            callback()

    def search(self, user_id: int, upload_ids: List[int], query: str) -> List[Document]:

        query_vector = self.embedding_model.embed_query(query)

        filter_condition = {
            "must": [
                {"key": "metadata.user_id", "match": {"value": user_id}},
                {"key": "metadata.upload_id", "match": {"any": upload_ids}},
            ]
        }
        logger.debug(f"Search filter condition: {filter_condition}")

        search_results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=filter_condition,
            limit=4,
        )

        documents = [
            Document(
                page_content=result.payload.get("page_content", ""),
                metadata={"score": result.score},
            )
            for result in search_results
        ]

        return documents

    def retriever(self, user_id: int, upload_id: int):
        logger.debug(
            f"Creating retriever for user_id: {user_id}, upload_id: {upload_id}"
        )
        filter_condition = {
            "must": [
                {"key": "metadata.user_id", "match": {"value": user_id}},
                {"key": "metadata.upload_id", "match": {"value": upload_id}},
            ]
        }
        retriever = self.vector_store.as_retriever(
            search_kwargs={"filter": filter_condition, "k": 5},
            search_type="similarity",
        )
        logger.debug(f"Retriever created: {retriever}")
        return retriever

    def debug_retriever(self, user_id: int, upload_id: int, query: str):
        logger.debug(
            f"Debug retriever for user_id: {user_id}, upload_id: {upload_id}, query: '{query}'"
        )

        # 使用过滤器的搜索
        filtered_docs = self.search(user_id, [upload_id], query)
        logger.debug(f"Filtered search found {len(filtered_docs)} documents")
        for doc in filtered_docs:
            logger.debug(f"Filtered doc metadata: {doc.metadata}")

        # 不使用过滤器的搜索
        unfiltered_docs = self.vector_store.similarity_search(query, k=5)
        logger.debug(f"Unfiltered search found {len(unfiltered_docs)} documents")

        # 打印所有文档的元数据
        for i, doc in enumerate(unfiltered_docs):
            logger.debug(f"Unfiltered doc {i} metadata: {doc.metadata}")

        return filtered_docs

    def get_collection_info(self):
        collection_info = self.client.get_collection(self.collection_name)
        logger.debug(f"Collection info: {collection_info}")
        return collection_info

    def vector_search(
        self,
        user_id: int,
        upload_ids: List[int],
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.5,
    ):
        query_vector = self.embedding_model.embed_query(query)
        filter_condition = {
            "must": [
                {"key": "metadata.user_id", "match": {"value": user_id}},
                {"key": "metadata.upload_id", "match": {"any": upload_ids}},
            ]
        }
        search_results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter=filter_condition,
            limit=top_k,
            score_threshold=score_threshold,
        )
        return [self._convert_to_document(result) for result in search_results]

    def fulltext_search(
        self,
        user_id: int,
        upload_ids: List[int],
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.5,
    ):
        filter_condition = {
            "must": [
                {"key": "metadata.user_id", "match": {"value": user_id}},
                {"key": "metadata.upload_id", "match": {"any": upload_ids}},
            ]
        }
        # 为全文搜索生成一个空的查询向量
        empty_vector = [0.0] * self.embedding_model.dimension
        search_results = self.client.search(
            collection_name=self.collection_name,
            query_vector=empty_vector,  # 添加空的查询向量
            query_filter=rest.Filter(**filter_condition),
            limit=1000,  # 增加限制以获取更多潜在匹配
            with_payload=PayloadSelectorExclude(exclude=["metadata"]),  # 只获取文本内容
            with_vectors=False,
        )

        # 改进的相关性评分
        query_terms = Counter(re.findall(r"\w+", query.lower()))
        filtered_results = []
        for result in search_results:
            content = result.payload.get("page_content", "").lower()
            content_terms = Counter(re.findall(r"\w+", content))

            # 计算改进的 TF-IDF 相似度分数
            score = 0
            for term, query_count in query_terms.items():
                if term in content_terms:
                    tf = content_terms[term] / len(content_terms)
                    idf = math.log(
                        len(search_results)
                        / (
                            sum(
                                1
                                for r in search_results
                                if term in r.payload.get("page_content", "").lower()
                            )
                            + 1
                        )
                    )
                    score += (tf * idf) * query_count

            if score > 0:
                filtered_results.append((result, score))

        # 归一化分数
        if filtered_results:
            max_score = max(score for _, score in filtered_results)
            filtered_results = [
                (result, score / max_score) for result, score in filtered_results
            ]

        # 应用 score threshold
        filtered_results = [
            (result, score)
            for result, score in filtered_results
            if score >= score_threshold
        ]

        # 按分数排序并选择前 top_k 个结果
        filtered_results.sort(key=lambda x: x[1], reverse=True)
        top_results = filtered_results[:top_k]

        return [
            self._convert_to_document(result, score) for result, score in top_results
        ]

    def _convert_to_document(self, result, score=None):
        return Document(
            page_content=result.payload.get("page_content", ""),
            metadata={
                "score": score if score is not None else result.score,
                **result.payload.get("metadata", {}),
            },
        )

    def hybrid_search(
        self,
        user_id: int,
        upload_ids: List[int],
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.5,
    ):
        vector_results = self.vector_search(
            user_id, upload_ids, query, top_k, score_threshold
        )
        fulltext_results = self.fulltext_search(
            user_id, upload_ids, query, top_k, score_threshold
        )

        # 合并结果并按分数排序
        combined_results = vector_results + fulltext_results
        combined_results.sort(key=lambda x: x.metadata["score"], reverse=True)
        return combined_results[:top_k]
