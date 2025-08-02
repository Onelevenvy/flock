# flock-frontend/Dockerfile (已优化 pnpm 镜像源)

FROM node:20-alpine3.20 AS base

# ---- 新增：将 Alpine 的软件源更换为阿里云镜像，加速后续的包安装 ----
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 构建参数
ARG NODE_ENV=production
ARG API_URL=/api 

# 安装基础工具
RUN apk add --no-cache tzdata curl

# 安装依赖阶段
FROM base AS packages
WORKDIR /app/web

COPY package.json pnpm-lock.yaml* ./
# ---- 新增：复制 .npmrc 文件以使用国内镜像 ----
COPY .npmrc .

# 安装pnpm
RUN npm install -g pnpm
# 这个命令现在会从高速镜像下载
RUN pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app/web
COPY --from=packages /app/web/ .
COPY . .

# 设置构建环境变量
ENV NEXT_PUBLIC_API_URL=${API_URL}
ENV NODE_ENV=${NODE_ENV}

RUN npm install -g pnpm --registry=https://registry.npmmirror.com
RUN pnpm build

# 生产环境阶段
FROM base AS production

# 环境变量设置
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC

# 设置时区
RUN ln -s /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

WORKDIR /app/web

# 复制构建产物
COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static

# 复制启动配置
COPY docker/pm2.json ./pm2.json

# 安装pm2
RUN npm install -g pm2 \
    && mkdir /.pm2 \
    && chown -R 1001:0 /.pm2 /app/web \
    && chmod -R g=u /.pm2 /app/web

# 切换到非root用户
USER 1001

EXPOSE 3000

# 使用 pm2-runtime 直接启动应用
CMD ["pm2-runtime", "start", "./pm2.json"]