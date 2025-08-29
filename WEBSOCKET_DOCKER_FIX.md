# WebSocket Docker 问题解决方案

## 问题分析

WebSocket 在本地运行正常但 Docker 容器中无法连接，主要原因：

1. **端口映射问题**：容器内部端口未正确映射到宿主机
2. **网络模式问题**：使用 `--network host` 在构建时无效，应在运行时设置
3. **代理头部丢失**：容器化后可能丢失必要的 WebSocket 升级头

## 解决方案

### 方案1：标准 Docker 运行（推荐）

```bash
# 使用提供的脚本
./docker-run-websocket.sh

# 或手动运行
docker run -d \
  --name newapi-websocket \
  -p 3001:3001 \
  --restart unless-stopped \
  -e GIN_MODE=release \
  -e PORT=3001 \
  apidemo2:0.7.829-amd64
```

### 方案2：使用 host 网络模式

```bash
docker run -d \
  --name newapi-websocket \
  --network host \
  --restart unless-stopped \
  -e GIN_MODE=release \
  -e PORT=3001 \
  apidemo2:0.7.829-amd64
```

**注意**：host 模式下容器直接使用宿主机网络，无需端口映射

### 方案3：Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  newapi:
    image: apidemo2:0.7.829-amd64
    container_name: newapi-websocket
    ports:
      - "3001:3001"
    environment:
      - GIN_MODE=release
      - PORT=3001
    restart: unless-stopped
```

运行：
```bash
docker-compose up -d
```

## Nginx 配置检查

确保 Nginx 正确配置 WebSocket：

```nginx
location / {
    proxy_pass http://localhost:3001;  # 或容器IP
    
    # WebSocket 必需头部
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    
    # 其他头部
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # 超时设置
    proxy_connect_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_read_timeout 3600s;
    
    # 禁用缓冲
    proxy_buffering off;
}
```

## 测试 WebSocket 连接

### 1. 直接测试容器

```bash
# 测试 HTTP
curl http://localhost:3001/

# 测试 WebSocket（使用 wscat）
npm install -g wscat
wscat -c ws://localhost:3001/v1/realtime
```

### 2. 查看容器日志

```bash
docker logs -f newapi-websocket
```

### 3. 检查容器网络

```bash
# 查看容器 IP
docker inspect newapi-websocket | grep IPAddress

# 测试容器内部
docker exec newapi-websocket curl http://localhost:3001/
```

## 常见问题

### 1. 连接被拒绝
- 检查防火墙规则
- 确认端口 3001 未被占用：`lsof -i :3001`

### 2. WebSocket 握手失败
- 检查 Nginx 配置中的 `Upgrade` 和 `Connection` 头
- 确认使用 HTTP/1.1

### 3. 跨域问题
代码中已设置 `CheckOrigin: func(r *http.Request) bool { return true }`，应该不会有跨域问题

## 调试建议

1. **先不经过 Nginx 直接测试**：
   ```bash
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
     http://localhost:3001/v1/realtime
   ```

2. **检查容器内进程**：
   ```bash
   docker exec newapi-websocket ps aux
   docker exec newapi-websocket netstat -tulpn
   ```

3. **对比本地和容器环境变量**：
   ```bash
   # 本地
   env | grep -E "PORT|GIN"
   
   # 容器内
   docker exec newapi-websocket env | grep -E "PORT|GIN"
   ```

## 构建命令说明

你的构建命令：
```bash
DOCKER_BUILDKIT=1 docker buildx build \
  --network host \  # 这个只影响构建过程，不影响运行
  --platform linux/amd64 \
  -t apidemo2:0.7.829-amd64 \
  --load \
  .
```

`--network host` 只在构建时生效（用于下载依赖），**不会**影响容器运行时的网络配置。运行时需要单独指定。