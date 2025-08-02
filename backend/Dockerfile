
FROM python:3.12-slim AS base

# 安装 uv
RUN pip install --no-cache-dir uv


FROM base AS builder


RUN echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list


RUN set -eux; \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
    gcc g++ libc-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


COPY pyproject.toml uv.lock ./


RUN uv venv && \
    uv sync --python 3.12 


FROM base AS production

# 配置apt镜像源
RUN echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list


WORKDIR /app
ENV TZ=UTC
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1


RUN set -eux; \
    apt-get update -y && \
   
    apt-get install -y --no-install-recommends \
        curl \
        unzip \
        libffi-dev \
        fonts-noto-cjk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \

    && curl -fsSL "https://github.com/denoland/deno/releases/download/v2.4.3/deno-x86_64-unknown-linux-gnu.zip" -o deno.zip \
    && unzip -o deno.zip \
    && mv deno /usr/local/bin/deno \
    && rm deno.zip \

    && mkdir -p /app/upload /app/model_cache /app/data \
    && mkdir -p /app/data/.local/share/app \
    && chown -R nobody:nogroup /app \
    && chmod -R u+rwX,go+rX,go-w /app \
    && chmod 777 /app/data/.local/share/app


COPY --from=builder /app/.venv /app/.venv


ENV PATH="/app/.venv/bin:${PATH}"


COPY . /app/


COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh


USER nobody


HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000 || exit 1

EXPOSE 8000

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]