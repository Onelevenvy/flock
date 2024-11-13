import secrets
import warnings
from typing import Annotated, Any, Literal

from psycopg.rows import dict_row
from pydantic import (
    AnyUrl,
    BeforeValidator,
    HttpUrl,
    PostgresDsn,
    computed_field,
    model_validator,
)
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Self


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    DOMAIN: str = "localhost"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    @computed_field  # type: ignore[misc]
    @property
    def server_host(self) -> str:
        # Use HTTPS for anything other than local development
        if self.ENVIRONMENT == "local":
            return f"http://{self.DOMAIN}"
        return f"https://{self.DOMAIN}"

    BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = (
        []
    )

    PROJECT_NAME: str | None = None
    SENTRY_DSN: HttpUrl | None = None
    POSTGRES_SERVER: str | None = None
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str | None = None
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_DB: str | None = None

    @computed_field  # type: ignore[misc]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:

        return MultiHostUrl.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    # For checkpointer
    SQLALCHEMY_CONNECTION_KWARGS: dict[str, Any] = {
        "autocommit": True,
        "prepare_threshold": 0,
        "row_factory": dict_row,
    }

    @computed_field  # type: ignore[misc]
    @property
    def PG_DATABASE_URI(self) -> str:
        multiHostUrl = MultiHostUrl.build(
            scheme="postgresql",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )
        return str(multiHostUrl)

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    # TODO: update type to EmailStr when sqlmodel supports it
    EMAILS_FROM_EMAIL: str | None = None
    EMAILS_FROM_NAME: str | None = None

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48

    @computed_field  # type: ignore[misc]
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    # TODO: update type to EmailStr when sqlmodel supports it
    EMAIL_TEST_USER: str = "test@example.com"
    # TODO: update type to EmailStr when sqlmodel supports it
    FIRST_SUPERUSER: str | None = None
    FIRST_SUPERUSER_PASSWORD: str | None = None
    USERS_OPEN_REGISTRATION: bool = False

    PROTECTED_NAMES: list[str] = ["user", "ignore", "error"]

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        self._check_default_secret("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD)
        self._check_default_secret(
            "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        )

        return self

    # Qdrant
    QDRANT_SERVICE_API_KEY: str | None = "XMj3HXm5GlBKQLwZuStOlkwZiOWTdd_IwZNDJINFh-w"
    QDRANT_URL: str = "http://localhost:6333"
    # QDRANT_URL: str = "http://127.0.0.1:6333"

    QDRANT_COLLECTION: str | None = "kb_uploads"

    # Embeddings
    # EMBEDDING_MODEL: str = "local"  # 或者你想使用的其他模型
    # EMBEDDING_MODEL: str = "zhipuai"  # 或者你想使用的其他模型
    EMBEDDING_MODEL: str = "Siliconflow"

    DENSE_EMBEDDING_MODEL: str = (
        "sentence-transformers/all-MiniLM-L6-v2"  # 默认的密集嵌入模型
    )
    SPARSE_EMBEDDING_MODEL: str = (
        "sentence-transformers/all-MiniLM-L6-v2"  # 默认的稀疏嵌入模型
    )
    ZHIPUAI_API_KEY: str | None = None
    SILICONFLOW_API_KEY: str | None = None
    OLLAMA_BASE_URL: str | None = None

    # Celery
    CELERY_BROKER_URL: str | None = None
    CELERY_RESULT_BACKEND: str | None = None
    MAX_UPLOAD_SIZE: int = 50_000_000

    RECURSION_LIMIT: int = 25
    TAVILY_API_KEY: str | None = None

    OPENAI_API_KEY: str | None = None

    # LangSmith
    # USE_LANGSMITH: bool = True
    # LANGCHAIN_TRACING_V2: bool = False
    # LANGCHAIN_ENDPOINT: str | None = None
    # LANGCHAIN_API_KEY: str | None = None
    # LANGCHAIN_PROJECT: str | None = None


settings = Settings()  # type: ignore
