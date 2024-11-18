FROM ubuntu:22.04

# 设置非交互式安装
ENV DEBIAN_FRONTEND=noninteractive

# 使用阿里云Ubuntu镜像源
RUN sed -i 's/archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    sed -i 's/security.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list

# 安装Python和必要的依赖
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    build-essential \
    curl \
    wget \
    python3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 创建 Python 命令的软链接
RUN ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.11 /usr/bin/python

# 使用清华pip镜像源安装Python包
RUN pip3 install --upgrade pip && \
    pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# Install common Python packages
RUN pip3 install --no-cache-dir \
    numpy \
    pandas \
    requests \
    python-dateutil \
    matplotlib

# 创建脚本目录
RUN mkdir -p /opt/code-interpreter/scripts
WORKDIR /opt/code-interpreter/scripts

# 创建启动脚本和健康检查脚本
COPY healthcheck.py ./
RUN echo '#!/bin/bash\nwhile true; do sleep 30; done' > ./entrypoint.sh && \
    chmod +x ./entrypoint.sh && \
    chmod +x ./healthcheck.py

# Create workspace directory
RUN mkdir -p /workspace

# Add a non-root user for security
RUN useradd -m -u 1000 codeuser && \
    chown -R codeuser:codeuser /opt/code-interpreter && \
    chown -R codeuser:codeuser /workspace && \
    chmod 755 /workspace

USER codeuser
WORKDIR /workspace

# Set Python to unbuffered mode
ENV PYTHONUNBUFFERED=1

# 使用启动脚本作为入口点
CMD ["/bin/bash", "/opt/code-interpreter/scripts/entrypoint.sh"]