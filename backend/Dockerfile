# flock-backend/Dockerfile (最终优化版)

# 基础镜像，包含 Python 3.12
FROM python:3.12-slim AS base

# 安装 uv，使用阿里云 pypi 镜像加速
RUN pip install --no-cache-dir uv -i https://mirrors.aliyun.com/pypi/simple/

# 构建依赖阶段：在此阶段安装依赖，以便后续生产阶段直接复制
FROM base AS builder

WORKDIR /app

# ---- 关键变更 1：合并 RUN 指令，确保只使用国内源 ----
RUN set -eux; \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list; \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
        gcc g++ libc-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖定义文件，使用 uv.lock
COPY pyproject.toml uv.lock ./

# 使用 uv 创建虚拟环境并安装依赖
RUN uv venv && \
    uv sync --python 3.12 -i https://pypi.tuna.tsinghua.edu.cn/simple/

# 生产环境阶段：一个干净、轻量的最终镜像
FROM base AS production

WORKDIR /app
ENV TZ=UTC
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# ---- 关键变更 2：同样合并 RUN 指令 ----
RUN set -eux; \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list; \
    apt-get update -y && \
    apt-get install -y --no-install-recommends \
        curl \
        unzip \
        libffi-dev \
        fonts-noto-cjk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*; \
    # 安装 deno
    curl -fsSL "https://github.com/denoland/deno/releases/download/v2.4.3/deno-x86_64-unknown-linux-gnu.zip" -o deno.zip \
    && unzip -o deno.zip \
    && mv deno /usr/local/bin/deno \
    && rm deno.zip; \
    # 创建目录和设置权限
    mkdir -p /app/upload /app/model_cache /app/data \
    && mkdir -p /app/data/.local/share/app \
    && chown -R nobody:nogroup /app \
    && chmod -R u+rwX,go+rX,go-w /app \
    && chmod 777 /app/data/.local/share/app

# 从 builder 阶段复制已经包含所有依赖的虚拟环境
COPY --from=builder /app/.venv /app/.venv

# 将虚拟环境的 bin 目录添加到 PATH
ENV PATH="/app/.venv/bin:${PATH}"

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