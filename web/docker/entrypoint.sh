#!/bin/sh

set -e

# 设置环境变量
export NEXT_PUBLIC_API_URL=${API_URL:-http://localhost:8000}
export NEXT_TELEMETRY_DISABLED=1

# 启动应用
exec pm2 start ./pm2.json --no-daemon 