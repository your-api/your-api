#!/bin/bash

echo "测试 WebSocket 连接问题诊断"
echo "============================"

# 测试直接连接到后端（绕过 Nginx）
echo -e "\n1. 直接连接后端 (38.147.106.148:3001):"
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Authorization: Bearer sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V" \
  "http://38.147.106.148:3001/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17" 2>&1 | head -20

# 测试通过 Nginx
echo -e "\n2. 通过 Nginx (api3.yourapi.cn):"
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Authorization: Bearer sk-DJsELFhulDR7yS3GvDr2ik8qvhY7mYbVQohawuFcHXQyns6V" \
  "https://api3.yourapi.cn/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17" 2>&1 | head -20

# 检查响应头差异
echo -e "\n3. 检查 Nginx 是否正确转发 Upgrade 头:"
curl -s -I -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://api3.yourapi.cn/v1/realtime" 2>&1 | grep -i "upgrade\|connection"