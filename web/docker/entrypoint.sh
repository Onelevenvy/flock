#!/bin/sh

set -e

# 设置环境变量
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}
export NEXT_TELEMETRY_DISABLED=1

# 创建运行时配置文件，注入环境变量
mkdir -p /app/web/public
cat > /app/web/public/runtime-config.js << EOF
// This file is generated at runtime by the container entrypoint script
window.__RUNTIME_CONFIG__ = {
  API_URL: "${NEXT_PUBLIC_API_URL:-http://localhost:8000}"
};
EOF

# 输出调试信息
echo "Using API URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

# 启动应用
exec pm2 start ./pm2.json --no-daemon