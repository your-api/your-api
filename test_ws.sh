#!/bin/bash

# 测试 WebSocket 连接
API_KEY="sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V"

echo "测试 WebSocket 连接到 yourapi.cn"

# 使用 curl 测试 WebSocket 升级
echo "测试 1: 直接连接到 yourapi.cn"
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Authorization: Bearer $API_KEY" \
  "https://yourapi.cn/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17"

echo -e "\n\n测试 2: 连接到 new.xjai.cc (对比)"
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Authorization: Bearer $API_KEY" \
  "https://new.xjai.cc/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17"