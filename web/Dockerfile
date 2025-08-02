FROM node:20-alpine3.20 AS base

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

ARG NODE_ENV=production
ARG API_URL=/api 


RUN apk add --no-cache tzdata curl


FROM base AS packages
WORKDIR /app/web

COPY package.json pnpm-lock.yaml* ./

COPY .npmrc .

RUN npm install -g pnpm

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app/web
COPY --from=packages /app/web/ .
COPY . .

ENV NEXT_PUBLIC_API_URL=${API_URL}
ENV NODE_ENV=${NODE_ENV}

RUN npm install -g pnpm --registry=https://registry.npmmirror.com
RUN pnpm build

FROM base AS production

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC

RUN ln -s /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo ${TZ} > /etc/timezone

WORKDIR /app/web

COPY --from=builder /app/web/public ./public
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static

COPY docker/pm2.json ./pm2.json

RUN npm install -g pm2 \
    && mkdir /.pm2 \
    && chown -R 1001:0 /.pm2 /app/web \
    && chmod -R g=u /.pm2 /app/web

USER 1001

EXPOSE 3000

CMD ["pm2-runtime", "start", "./pm2.json"]