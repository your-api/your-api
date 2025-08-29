#!/bin/bash

# 测试本地 WebSocket 连接
API_KEY="sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V"

echo "测试本地 WebSocket 连接 (localhost:3001)"
echo "========================================="

# 使用 curl 测试 WebSocket 升级
echo -e "\n测试 WebSocket 握手:"
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Protocol: realtime" \
  -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3001/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17" 2>&1 | head -20

echo -e "\n\n测试 API 状态:"
curl -s http://localhost:3001/api/status | jq '.'