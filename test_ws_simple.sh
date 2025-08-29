#!/bin/bash

# 测试本地 WebSocket 连接 - 简化版本
echo "测试本地 WebSocket 连接 (localhost:3001)"
echo "========================================="

# 1. 先测试普通 API
echo -e "\n1. 测试普通 API:"
curl -s -X GET "http://localhost:3001/v1/models" \
  -H "Authorization: Bearer test-token" 2>&1 | jq -r '.error.message' 2>/dev/null || echo "API 响应正常"

# 2. 测试 WebSocket 升级（不带认证）
echo -e "\n2. 测试 WebSocket 升级（不带认证）:"
curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "http://localhost:3001/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17" 2>&1 | head -15

# 3. 测试 WebSocket 升级（带测试 token）
echo -e "\n3. 测试 WebSocket 升级（带 Authorization）:"
curl -i \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Authorization: Bearer sk-test-token" \
  "http://localhost:3001/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17" 2>&1 | head -15