#!/bin/bash

# Docker 运行脚本 - 支持 WebSocket

# 停止并删除旧容器
docker stop newapi-websocket 2>/dev/null
docker rm newapi-websocket 2>/dev/null

# 运行容器 - 正确的端口映射和网络配置
docker run -d \
  --name newapi-websocket \
  -p 3001:3001 \
  --restart unless-stopped \
  -e GIN_MODE=release \
  -e PORT=3001 \
  apidemo2:0.7.829-amd64

echo "容器已启动，检查状态："
docker ps | grep newapi-websocket

echo ""
echo "查看容器日志："
docker logs --tail 20 newapi-websocket