#!/bin/bash

# WebSocket 通用运行脚本

IMAGE_NAME="apidemo2:0.7.829-amd64"
CONTAINER_NAME="newapi-websocket"
PORT=3001

echo "🚀 启动 WebSocket 服务容器..."

# 清理旧容器
docker stop $CONTAINER_NAME 2>/dev/null
docker rm $CONTAINER_NAME 2>/dev/null

# 方案1: 标准桥接网络（推荐）
run_bridge_mode() {
    echo "使用桥接网络模式..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT:$PORT \
        --restart unless-stopped \
        -e PORT=$PORT \
        -e GIN_MODE=release \
        $IMAGE_NAME
}

# 方案2: Host 网络模式（性能更好）
run_host_mode() {
    echo "使用 host 网络模式..."
    docker run -d \
        --name $CONTAINER_NAME \
        --network host \
        --restart unless-stopped \
        -e PORT=$PORT \
        -e GIN_MODE=release \
        $IMAGE_NAME
}

# 默认使用桥接模式
MODE=${1:-bridge}

if [ "$MODE" = "host" ]; then
    run_host_mode
else
    run_bridge_mode
fi

echo ""
echo "✅ 容器已启动"
echo ""

# 等待服务启动
sleep 2

# 测试服务
echo "📡 测试服务状态..."
echo "-------------------"

# 测试 HTTP
echo "HTTP 测试："
curl -s -o /dev/null -w "状态码: %{http_code}\n" http://localhost:$PORT/v1/models

# 测试 WebSocket 握手
echo ""
echo "WebSocket 握手测试："
curl -s -o /dev/null -w "状态码: %{http_code}\n" \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: test" \
    http://localhost:$PORT/v1/realtime

echo ""
echo "📋 容器状态："
docker ps | grep $CONTAINER_NAME

echo ""
echo "📝 查看日志："
echo "docker logs -f $CONTAINER_NAME"