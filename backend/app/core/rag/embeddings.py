import logging
from typing import List

import requests
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_core.pydantic_v1 import BaseModel, Extra
from langchain_openai import OpenAIEmbeddings
from sqlmodel import select

from app.core.config import settings
from app.core.workflow.utils.db_utils import db_operation
from app.models import ModelProvider

logger = logging.getLogger(__name__)


def get_api_key(provider_name: str) -> str:
    def _get_api_key(session):
        provider = session.exec(
            select(ModelProvider).where(ModelProvider.provider_name == provider_name)
        ).first()
        if not provider:
            raise ValueError(f"Provider {provider_name} not found")
        return provider.api_key

    return db_operation(_get_api_key)


class ZhipuAIEmbeddings(BaseModel, Embeddings):
    api_key: str
    model: str = "embedding-3"
    dimension: int = 2048

    class Config:
        extra = Extra.forbid

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        from zhipuai import ZhipuAI

        client = ZhipuAI(api_key=self.api_key)
        response = client.embeddings.create(model=self.model, input=texts)
        embeddings = [item.embedding for item in response.data]
        if embeddings:
            self.dimension = len(embeddings[0])
        return embeddings

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]


class SiliconFlowEmbeddings(BaseModel, Embeddings):
    api_key: str
    model: str = "BAAI/bge-large-zh-v1.5"

    class Config:
        extra = Extra.forbid

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        url = "https://api.siliconflow.cn/v1/embeddings"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {"model": self.model, "input": texts, "encoding_format": "float"}
        response = requests.post(url, json=payload, headers=headers)
        response_json = response.json()
        logger.debug(f"SiliconFlow API response: {response_json}")

        if "data" not in response_json or not isinstance(response_json["data"], list):
            raise ValueError(
                f"Unexpected response format from SiliconFlow API: {response_json}"
            )

        embeddings = []
        for item in response_json["data"]:
            if "embedding" not in item or not isinstance(item["embedding"], list):
                raise ValueError(f"Unexpected embedding format in response: {item}")
            embeddings.append(item["embedding"])

        return embeddings

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]


def get_embedding_dimension(embedding_model: Embeddings) -> int:
    if hasattr(embedding_model, "dimension"):
        return embedding_model.dimension
    elif hasattr(embedding_model, "embedding_dim"):
        return embedding_model.embedding_dim
    else:
        sample_embedding = embedding_model.embed_query("Sample text for dimension")
        return len(sample_embedding)


def get_embedding_model(model_name: str) -> Embeddings:
    logger.info(f"Initializing embedding model: {model_name}")
    try:
        if model_name == "openai":
            api_key = get_api_key("openai")
            embedding_model = OpenAIEmbeddings(openai_api_key=api_key)
        elif model_name == "zhipuai":
            api_key = get_api_key("zhipuai")
            embedding_model = ZhipuAIEmbeddings(api_key=api_key)
        elif model_name == "siliconflow":
            api_key = get_api_key("Siliconflow")
            embedding_model = SiliconFlowEmbeddings(api_key=api_key)
        elif model_name == "local":
            embedding_model = HuggingFaceEmbeddings(
                model_name=settings.DENSE_EMBEDDING_MODEL,
                model_kwargs={"device": "cpu"},
            )
        else:
            raise ValueError(f"Unsupported embedding model: {model_name}")

        logger.info(f"Embedding model created: {type(embedding_model)}")

        if not isinstance(embedding_model, ZhipuAIEmbeddings):
            embedding_model.dimension = get_embedding_dimension(embedding_model)

        logger.info(f"Embedding model dimension: {embedding_model.dimension}")

        return embedding_model
    except Exception as e:
        logger.error(f"Error initializing embedding model: {e}", exc_info=True)
        raise
