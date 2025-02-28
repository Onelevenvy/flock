FROM python:3.12-slim AS base

# 构建参数
ARG POETRY_VERSION=2.0.1
ARG ENVIRONMENT=production

# Poetry 配置
ENV POETRY_VERSION=${POETRY_VERSION}
ENV POETRY_HOME=/opt/poetry
ENV POETRY_CACHE_DIR=/tmp/poetry_cache
ENV POETRY_NO_INTERACTION=1
ENV POETRY_VIRTUALENVS_IN_PROJECT=true
ENV POETRY_VIRTUALENVS_CREATE=true
ENV POETRY_REQUESTS_TIMEOUT=15

# 安装 Poetry
RUN pip install --no-cache-dir poetry==${POETRY_VERSION}

# 构建依赖阶段
FROM base AS builder

# 配置apt镜像源
RUN echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# 安装构建依赖
RUN set -eux; \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
    gcc g++ libc-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装Python依赖
COPY pyproject.toml poetry.lock ./
RUN if [ "$ENVIRONMENT" = "production" ]; then \
        poetry install --sync --no-cache --no-root --without dev; \
    else \
        poetry install --sync --no-cache --no-root; \
    fi

# 生产环境阶段
FROM base AS production

# 配置apt镜像源
RUN echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list

# 设置工作目录和环境变量
WORKDIR /app
ENV TZ=UTC
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 安装系统依赖
RUN set -eux; \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
        curl \
        libffi-dev \
        fonts-noto-cjk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/upload /app/model_cache /app/data \
    && mkdir -p /app/data/.local/share/app \
    && chown -R nobody:nogroup /app \
    && chmod -R u+rwX,go+rX,go-w /app \
    && chmod 777 /app/data/.local/share/app

# 复制Python环境
ENV VIRTUAL_ENV=/app/.venv
COPY --from=builder ${VIRTUAL_ENV} ${VIRTUAL_ENV}
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# 复制应用代码
COPY . /app/

# 复制启动脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 创建非root用户
USER nobody

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000 || exit 1

EXPOSE 8000

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
