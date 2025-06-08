<p align="right">
   <strong>中文</strong> | <a href="./README.en.md">English</a>
</p>
<div align="center">

![yourapi](/web/public/logo.png)

# Your API

🍥新一代大模型网关与AI资产管理系统 全新的高颜值/高性能的AI模型接口管理与分发系统

<a href="https://trendshift.io/repositories/8227" target="_blank"><img src="https://trendshift.io/api/badge/repositories/8227" alt="Calcium-Ion%2Fnew-api | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

<p align="center">
  <a href="https://raw.githubusercontent.com/Calcium-Ion/new-api/main/LICENSE">
    <img src="https://img.shields.io/github/license/Calcium-Ion/new-api?color=brightgreen" alt="license">
  </a>
  <a href="https://github.com/Calcium-Ion/new-api/releases/latest">
    <img src="https://img.shields.io/github/v/release/Calcium-Ion/new-api?color=brightgreen&include_prereleases" alt="release">
  </a>
  <a href="https://github.com/users/Calcium-Ion/packages/container/package/new-api">
    <img src="https://img.shields.io/badge/docker-ghcr.io-blue" alt="docker">
  </a>
  <a href="https://hub.docker.com/r/CalciumIon/new-api">
    <img src="https://img.shields.io/badge/docker-dockerHub-blue" alt="docker">
  </a>
  <a href="https://goreportcard.com/report/github.com/Calcium-Ion/new-api">
    <img src="https://goreportcard.com/badge/github.com/Calcium-Ion/new-api" alt="GoReportCard">
  </a>
</p>
</div>

## 📝 项目说明

![image-20250516152408326](./imgs/image-20250516152408326.png)

> [!NOTE]  
> 本项目为开源项目，在[New API](https://github.com/Calcium-Ion/new-api.git)的基础上进行二次开发

> [!IMPORTANT]  
>
> - 本项目仅供个人学习使用，不保证稳定性，且不提供任何技术支持。
> - 使用者必须在遵循 OpenAI 的[使用条款](https://openai.com/policies/terms-of-use)以及**法律法规**的情况下使用，不得用于非法用途。
> - 根据[《生成式人工智能服务管理暂行办法》](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)的要求，请勿对中国地区公众提供一切未经备案的生成式人工智能服务。

## 差异说明

该项目将持续同步[New API](https://github.com/Calcium-Ion/new-api.git)的最新版本，并致力于对其功能进行不断拓展与优化。通过集成最新技术和最佳实践，确保API的性能、稳定性和可扩展性持续提升，满足不断变化的业务需求和技术挑战。

### 增加及优化

- [x]   镜像支持arm以及amd
- [x]   支持coze智能体的配置
- [x]   🎨整体界面风格的差异
- [x]   防止图片探测请求暴露上游
- [x]   渠道空回复校验，确保空回复进行重试
- [x]   模型编辑处支持多key轮询
- [x]   对单个渠道新增代理ip支持，可以使用固定代理ip对渠道进行请求，提升安全性
- [x]   支持图片读取的代理ip配置
- [x]   增加快速接入指南
- [x]   增加开发文档独立页支持
- [x]  增加首页模型供应商显示
- [x] 移动端适配
- [x] 模型价格显示优化，更现代化的设计，支持配置模型描述
- [x] 支持AI供应商的配置
- [x] 支持模型描述的配置
- [x] 首页优势运营文案可配置
- [x] 可自定义导航链接
- [x] 增加Claude原生API格式请求支持
- [x] 优化部分界面元素的边距避免挤在一起
- [x] 优化公告显示
- [x] 预设更多模型
- [x] 前端新增tailwind css以及redux支持，更便于敏捷开发
- [x] 新增快速接入的说明
- [x] 兼容newapi数据库,方便一键迁移

**欢迎提交 Issue、Pull Request（PR）、Merge Request（MR）或提出各类需求与建议。我们非常重视您的反馈，并期待与您共同完善项目。**

coze工作流的配置

![image-20250517003351383](./imgs/image-20250517003351383.png)

## 使用说明

#### 直接使用Docker镜像

```shell
# 使用SQLite
# 不使用目录挂载
docker run --name yourapi -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai yourapi/yourapi:latest
# 使用挂载目录
docker run --name yourapi -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data yourapi/yourapi:latest

# 使用MySQL
docker run --name yourapi -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/yourapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data yourapi/yourapi:latest
```

#### 使用docker-compose

在您的服务器新建`docker-compose.yml`文件，内容如下：

```yaml
version: '3.4'

services:
  yourapi:
    image: yourapi/yourapi:latest
    container_name: yourapi
    restart: always
    command: --log-dir /app/logs
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - SQL_DSN=root:123456@tcp(mysql:3306)/yourapi?charset=utf8mb4&parseTime=True&loc=Local  # 修改此行，或注释掉以使用 SQLite 作为数据库
      - REDIS_CONN_STRING=redis://redis # 也可以自定义，例如 redis://user:password@localhost:6379/0
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true # 是否启用错误日志记录
    #      - TIKTOKEN_CACHE_DIR=./tiktoken_cache  # 如果需要使用tiktoken_cache，请取消注释
    #      - SESSION_SECRET=random_string  # 多机部署时设置，必须修改这个随机字符串！！！！！！！
    #      - NODE_TYPE=slave  # Uncomment for slave node in multi-node deployment
    #      - SYNC_FREQUENCY=60  # Uncomment if regular database syncing is needed
    #      - FRONTEND_BASE_URL=https://openai.justsong.cn  # Uncomment for multi-node deployment with front-end URL

    depends_on:
      - redis
      - mysql
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' | awk -F: '{print $$2}'"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:latest
    container_name: redis
    restart: always

  mysql:
    image: mysql:8.2
    container_name: mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: 123456  # Ensure this matches the password in SQL_DSN
      MYSQL_DATABASE: yourapi
    volumes:
      - mysql_data:/var/lib/mysql
    # ports:
    #   - "3306:3306"  # If you want to access MySQL from outside Docker, uncomment

volumes:
  mysql_data:
```



启动服务：

```
docker-compose up -d
```



访问`http://ip:3000`即可看到登录界面，输入账号密码即可登录（默认账号：root，默认密码：123456）。

若有版本更新，您可以通过以下命令更新并重启服务：

```
docker-compose pull && docker-compose up -d
```

## 加群交流

> 您也可以扫描下方二维码加入QQ交流群以获取最新的开发动态和相关事件
>
> 点击链接加入群聊：https://qm.qq.com/q/jkdefoHcNG

  <img src="./imgs/image-20250516160329904.png" alt="image-20250516160329904" width="400">



# ✨ 主要特性

Your API提供了丰富的功能，详细特性请参考[特性说明](https://docs.newapi.pro/wiki/features-introduction)：

1. 🎨 全新的UI界面
2. 🌍 多语言支持
3. 💰 支持在线充值功能（易支付）
5. 🔄 兼容原版One API的数据库
6. 💵 支持模型按次数收费
7. ⚖️ 支持渠道加权随机
8. 📈 数据看板（控制台）
9. 🔒 令牌分组、模型限制
10. 🤖 支持更多授权登陆方式（LinuxDO,Telegram、OIDC）
11. 🔄 支持Rerank模型（Cohere和Jina），[接口文档](https://docs.newapi.pro/api/jinaai-rerank)
12. ⚡ 支持OpenAI Realtime API（包括Azure渠道），[接口文档](https://docs.newapi.pro/api/openai-realtime)
13. ⚡ 支持Claude Messages 格式，[接口文档](https://docs.newapi.pro/api/anthropic-chat)
14. 支持使用路由/chat2link进入聊天界面
15. 🧠 支持通过模型名称后缀设置 reasoning effort：
    1. OpenAI o系列模型
        - 添加后缀 `-high` 设置为 high reasoning effort (例如: `o3-mini-high`)
        - 添加后缀 `-medium` 设置为 medium reasoning effort (例如: `o3-mini-medium`)
        - 添加后缀 `-low` 设置为 low reasoning effort (例如: `o3-mini-low`)
    2. Claude 思考模型
        - 添加后缀 `-thinking` 启用思考模式 (例如: `claude-3-7-sonnet-20250219-thinking`)
16. 🔄 思考转内容功能
17. 🔄 针对用户的模型限流功能
18. 💰 缓存计费支持，开启后可以在缓存命中时按照设定的比例计费：
    1. 在 `系统设置-运营设置` 中设置 `提示缓存倍率` 选项
    2. 在渠道中设置 `提示缓存倍率`，范围 0-1，例如设置为 0.5 表示缓存命中时按照 50% 计费
    3. 支持的渠道：
        - [x] OpenAI
        - [x] Azure
        - [x] DeepSeek
        - [x] Claude

## 模型支持

此版本支持多种模型，详情请参考[接口文档-中继接口](https://docs.newapi.pro/api)：

1. 第三方模型 **gpts** （gpt-4-gizmo-*）
2. 第三方渠道[Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy)接口，[接口文档](https://docs.newapi.pro/api/midjourney-proxy-image)
3. 第三方渠道[Suno API](https://github.com/Suno-API/Suno-API)接口，[接口文档](https://docs.newapi.pro/api/suno-music)
4. 自定义渠道，支持填入完整调用地址
5. Rerank模型（[Cohere](https://cohere.ai/)和[Jina](https://jina.ai/)），[接口文档](https://docs.newapi.pro/api/jinaai-rerank)
6. Claude Messages 格式，[接口文档](https://docs.newapi.pro/api/anthropic-chat)
7. Dify，当前仅支持chatflow

## 环境变量配置

### 基本配置

| 环境变量 | 说明         | 默认值          | 示例                  |
| :------- | :----------- | :-------------- | :-------------------- |
| `PORT`   | 服务监听端口 | `3000`          | `PORT=8080`           |
| `TZ`     | 时区设置     | `Asia/Shanghai` | `TZ=America/New_York` |

### 💾 数据库配置

| 环境变量                | 说明                       | 默认值                   | 示例                                                      |
| :---------------------- | :------------------------- | :----------------------- | :-------------------------------------------------------- |
| `SQL_DSN`               | 数据库连接字符串           | SQLite (data/one-api.db) | `SQL_DSN=root:123456@tcp(localhost:3306)/oneapi`          |
| `SQL_MAX_IDLE_CONNS`    | 空闲连接池最大连接数       | `100`                    | `SQL_MAX_IDLE_CONNS=50`                                   |
| `SQL_MAX_OPEN_CONNS`    | 连接池最大打开连接数       | `1000`                   | `SQL_MAX_OPEN_CONNS=500`                                  |
| `SQL_CONN_MAX_LIFETIME` | 连接最大生命周期(分钟)     | `60`                     | `SQL_CONN_MAX_LIFETIME=120`                               |
| `LOG_SQL_DSN`           | 日志表独立数据库连接字符串 | -                        | `LOG_SQL_DSN=root:123456@tcp(localhost:3306)/oneapi_logs` |
| `SQLITE_BUSY_TIMEOUT`   | SQLite锁等待超时(毫秒)     | `3000`                   | `SQLITE_BUSY_TIMEOUT=5000`                                |

### 📦 缓存配置

| 环境变量                | 说明                     | 默认值  | 示例                                                       |
| :---------------------- | :----------------------- | :------ | :--------------------------------------------------------- |
| `REDIS_CONN_STRING`     | Redis连接字符串          | -       | `REDIS_CONN_STRING=redis://default:redispw@localhost:6379` |
| `MEMORY_CACHE_ENABLED`  | 是否启用内存缓存         | `false` | `MEMORY_CACHE_ENABLED=true`                                |
| `REDIS_CONN_POOL_SIZE`  | Redis连接池大小          | -       | `REDIS_CONN_POOL_SIZE=10`                                  |
| `REDIS_PASSWORD`        | Redis集群或哨兵模式密码  | -       | `REDIS_PASSWORD=your_password`                             |
| `REDIS_MASTER_NAME`     | Redis哨兵模式主节点名称  | -       | `REDIS_MASTER_NAME=mymaster`                               |
| `BATCH_UPDATE_ENABLED`  | 启用数据库批量更新聚合   | `false` | `BATCH_UPDATE_ENABLED=true`                                |
| `BATCH_UPDATE_INTERVAL` | 批量更新聚合时间间隔(秒) | `5`     | `BATCH_UPDATE_INTERVAL=10`                                 |

### 🌐 多节点与安全配置

| 环境变量                    | 说明                         | 默认值   | 示例                                        |
| :-------------------------- | :--------------------------- | :------- | :------------------------------------------ |
| `SESSION_SECRET`            | 会话密钥(多机部署必须)       | -        | `SESSION_SECRET=random_string`              |
| `CRYPTO_SECRET`             | 加密密钥(加密数据库内容)     | -        | `CRYPTO_SECRET=your_crypto_secret`          |
| `FRONTEND_BASE_URL`         | 前端基础URL                  | -        | `FRONTEND_BASE_URL=https://your-domain.com` |
| `SYNC_FREQUENCY`            | 缓存与数据库同步频率(秒)     | `600`    | `SYNC_FREQUENCY=60`                         |
| `NODE_TYPE`                 | 节点类型                     | `master` | `NODE_TYPE=slave`                           |
| `INITIAL_ROOT_TOKEN`        | 首次启动时创建的root用户令牌 | -        | `INITIAL_ROOT_TOKEN=your_token`             |
| `INITIAL_ROOT_ACCESS_TOKEN` | 首次启动时创建的系统管理令牌 | -        | `INITIAL_ROOT_ACCESS_TOKEN=your_token`      |

集群部署

关于如何使用这些环境变量构建完整的集群部署，请参考[集群部署指南](https://docs.newapi.pro/installation/cluster-deployment/)。

### 👤 用户及令牌配置

| 环境变量                             | 说明                         | 默认值  | 示例                                    |
| :----------------------------------- | :--------------------------- | :------ | :-------------------------------------- |
| `DEFAULT_QUOTA`                      | 新用户默认配额               | `0`     | `DEFAULT_QUOTA=10`                      |
| `GLOBAL_USER_QUOTA`                  | 全局用户配额限制             | -       | `GLOBAL_USER_QUOTA=100`                 |
| `GENERATE_DEFAULT_TOKEN`             | 为新注册用户生成初始令牌     | `false` | `GENERATE_DEFAULT_TOKEN=true`           |
| `NOTIFICATION_LIMIT_DURATION_MINUTE` | 通知限制的持续时间(分钟)     | `10`    | `NOTIFICATION_LIMIT_DURATION_MINUTE=15` |
| `NOTIFY_LIMIT_COUNT`                 | 指定持续时间内的最大通知数量 | `2`     | `NOTIFY_LIMIT_COUNT=3`                  |

### 🚦 请求限制配置

| 环境变量                       | 说明                        | 默认值 | 示例                              |
| :----------------------------- | :-------------------------- | :----- | :-------------------------------- |
| `GLOBAL_API_RATE_LIMIT`        | 全局API速率限制(单IP三分钟) | `180`  | `GLOBAL_API_RATE_LIMIT=100`       |
| `GLOBAL_WEB_RATE_LIMIT`        | 全局Web速率限制(单IP三分钟) | `60`   | `GLOBAL_WEB_RATE_LIMIT=30`        |
| `RELAY_TIMEOUT`                | 中继请求超时时间(秒)        | -      | `RELAY_TIMEOUT=60`                |
| `USER_CONTENT_REQUEST_TIMEOUT` | 用户内容下载超时时间(秒)    | -      | `USER_CONTENT_REQUEST_TIMEOUT=30` |
| `STREAMING_TIMEOUT`            | 流式一次回复的超时时间(秒)  | `18000`   | `STREAMING_TIMEOUT=21600`           |
| `MAX_FILE_DOWNLOAD_MB`         | 最大文件下载大小(MB)        | `20`   | `MAX_FILE_DOWNLOAD_MB=50`         |

RELAY_TIMEOUT 设置警告

设置 `RELAY_TIMEOUT` 环境变量时请谨慎，如果设置过短可能导致以下问题：

- 上游API已经完成请求并计费，但本地因超时而未完成计费
- 造成计费不同步，可能导致系统亏损
- 建议不设置，除非您知道自己在做什么

### 📡 渠道管理配置

| 环境变量                        | 说明                       | 默认值                             | 示例                                |
| :------------------------------ | :------------------------- | :--------------------------------- | :---------------------------------- |
| `CHANNEL_UPDATE_FREQUENCY`      | 定期更新渠道余额(分钟)     | -                                  | `CHANNEL_UPDATE_FREQUENCY=1440`     |
| `CHANNEL_TEST_FREQUENCY`        | 定期检查渠道(分钟)         | -                                  | `CHANNEL_TEST_FREQUENCY=1440`       |
| `POLLING_INTERVAL`              | 批量更新渠道时请求间隔(秒) | `0`                                | `POLLING_INTERVAL=5`                |
| `ENABLE_METRIC`                 | 是否根据请求成功率禁用渠道 | `false`                            | `ENABLE_METRIC=true`                |
| `METRIC_QUEUE_SIZE`             | 请求成功率统计队列大小     | `10`                               | `METRIC_QUEUE_SIZE=20`              |
| `METRIC_SUCCESS_RATE_THRESHOLD` | 请求成功率阈值             | `0.8`                              | `METRIC_SUCCESS_RATE_THRESHOLD=0.7` |
| `TEST_PROMPT`                   | 测试模型时的用户prompt     | `Print your model name exactly...` | `TEST_PROMPT=Hello`                 |

### 🤖 模型和请求处理配置

| 环境变量                     | 说明                                                 | 默认值  | 示例                                 |
| :--------------------------- | :--------------------------------------------------- | :------ | :----------------------------------- |
| `FORCE_STREAM_OPTION`        | 覆盖客户端stream_options参数                         | `true`  | `FORCE_STREAM_OPTION=false`          |
| `GET_MEDIA_TOKEN`            | 是否统计图片token                                    | `true`  | `GET_MEDIA_TOKEN=false`              |
| `GET_MEDIA_TOKEN_NOT_STREAM` | 非流模式下是否统计图片token                          | `true`  | `GET_MEDIA_TOKEN_NOT_STREAM=false`   |
| `UPDATE_TASK`                | 是否更新异步任务(MJ、Suno)                           | `true`  | `UPDATE_TASK=false`                  |
| `ENFORCE_INCLUDE_USAGE`      | 强制stream模式下返回usage                            | `false` | `ENFORCE_INCLUDE_USAGE=true`         |
| `TIKTOKEN_CACHE_DIR`         | Tiktoken编码器缓存目录，用于存放分词文件避免网络下载 | -       | `TIKTOKEN_CACHE_DIR=/cache/tiktoken` |
| `DATA_GYM_CACHE_DIR`         | DataGym缓存目录                                      | -       | `DATA_GYM_CACHE_DIR=/cache/data_gym` |

Tiktoken文件配置

下载tiktoken文件后，请按照以下方式重命名：

- `cl100k_base.tiktoken` 重命名为 `9b5ad71b2ce5302211f9c61530b329a4922fc6a4`
- `o200k_base.tiktoken` 重命名为 `fb374d419588a4632f3f557e76b4b70aebbca790`

这些文件应放置在`TIKTOKEN_CACHE_DIR`指定的目录中，以提高token计算性能并减少网络依赖。

Tiktoken配置示例

```
# Docker环境示例
TIKTOKEN_CACHE_DIR=/app/data/tiktoken

# 然后将tiktoken文件下载并重命名后放入该目录：
/app/data/tiktoken/9b5ad71b2ce5302211f9c61530b329a4922fc6a4
/app/data/tiktoken/fb374d419588a4632f3f557e76b4b70aebbca790
```

Tiktoken是OpenAI使用的分词器，用于计算文本的token数量。通过本地缓存这些文件，可以避免系统每次启动时从网络下载，提高稳定性和性能，特别是在网络受限环境中。

### 🔎 特定模型配置

| 环境变量                      | 说明                         | 默认值               | 示例                                   |
| :---------------------------- | :--------------------------- | :------------------- | :------------------------------------- |
| `AZURE_DEFAULT_API_VERSION`   | Azure渠道默认API版本         | `2024-12-01-preview` | `AZURE_DEFAULT_API_VERSION=2023-05-15` |
| `COHERE_SAFETY_SETTING`       | Cohere模型安全设置           | `NONE`               | `COHERE_SAFETY_SETTING=CONTEXTUAL`     |
| `GEMINI_VISION_MAX_IMAGE_NUM` | Gemini模型最大图片数量       | `16`                 | `GEMINI_VISION_MAX_IMAGE_NUM=8`        |
| `GEMINI_VERSION`              | Gemini版本                   | `v1`                 | `GEMINI_VERSION=v1beta`                |
| `DIFY_DEBUG`                  | Dify渠道输出工作流和节点信息 | `true`               | `DIFY_DEBUG=false`                     |

### 📨 其他配置

| 环境变量         | 说明           | 默认值 | 示例                               |
| :--------------- | :------------- | :----- | :--------------------------------- |
| `EMAIL_SERVER`   | 邮件服务器配置 | -      | `EMAIL_SERVER=smtp.example.com:25` |
| `EMAIL_FROM`     | 邮件发送者地址 | -      | `EMAIL_FROM=noreply@example.com`   |
| `EMAIL_PASSWORD` | 邮件服务器密码 | -      | `EMAIL_PASSWORD=yourpassword`      |

# 🌍 多机部署示例

在多机部署场景中，必须设置以下环境变量：

## 👑 主节点配置

```
# 数据库配置 - 使用远程数据库
SQL_DSN=root:password@tcp(db-server:3306)/oneapi

# 安全配置
SESSION_SECRET=your_unique_session_secret
CRYPTO_SECRET=your_unique_crypto_secret

# Redis缓存配置
REDIS_CONN_STRING=redis://default:password@redis-server:6379
```

## 👥 从节点配置

```
# 数据库配置 - 使用相同的远程数据库
SQL_DSN=root:password@tcp(db-server:3306)/oneapi

# 安全配置 - 与主节点使用相同的密钥
SESSION_SECRET=your_unique_session_secret
CRYPTO_SECRET=your_unique_crypto_secret

# Redis缓存配置 - 与主节点使用相同的Redis
REDIS_CONN_STRING=redis://default:password@redis-server:6379

# 节点类型设置
NODE_TYPE=slave

# 可选：前端基础URL
FRONTEND_BASE_URL=https://your-domain.com

# 可选：同步频率
SYNC_FREQUENCY=60
```

# 部署

详细部署指南请参考：

> [!TIP]
> 最新版Docker镜像：`yourapi/yourapi:latest`  

### 多机部署注意事项
- 必须设置环境变量 `SESSION_SECRET`，否则会导致多机部署时登录状态不一致
- 如果公用Redis，必须设置 `CRYPTO_SECRET`，否则会导致多机部署时Redis内容无法获取

### 部署要求
- 本地数据库（默认）：SQLite（Docker部署必须挂载`/data`目录）
- 远程数据库：MySQL版本 >= 5.7.8，PgSQL版本 >= 9.6

### 部署方式

#### 使用Docker Compose部署
```shell
# 下载项目
git clone https://github.com/your-api/your-api.git
cd your-api
# 按需编辑docker-compose.yml
# 启动
docker-compose up -d
```

#### 直接使用Docker镜像
```shell
# 使用SQLite
docker run --name yourapi -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/yourapi:/data yourapi/yourapi:latest

# 使用MySQL
docker run --name yourapi -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/yourapi:/data yourapi/you-api:latest
```

## 渠道重试与缓存
渠道重试功能已经实现，可以在`设置->运营设置->通用设置`设置重试次数，**建议开启缓存**功能。

### 缓存设置方法
1. `REDIS_CONN_STRING`：设置Redis作为缓存
2. `MEMORY_CACHE_ENABLED`：启用内存缓存（设置了Redis则无需手动设置）

## 接口文档

详细接口文档请参考[接口文档](https://docs.newapi.pro/api)：

- [聊天接口（Chat）](https://docs.newapi.pro/api/openai-chat)
- [图像接口（Image）](https://docs.newapi.pro/api/openai-image)
- [重排序接口（Rerank）](https://docs.newapi.pro/api/jinaai-rerank)
- [实时对话接口（Realtime）](https://docs.newapi.pro/api/openai-realtime)
- [Claude聊天接口（messages）](https://docs.newapi.pro/api/anthropic-chat)

# 解决 exec format error 问题

如果您在运行 Docker 容器时遇到 `exec /one-api: exec format error` 错误，这通常是由于您的系统架构（如 ARM64）与镜像构建架构（如 AMD64）不匹配导致的。

## 解决方法

### 方法一：使用多架构构建Docker镜像

```bash
# 创建并使用多架构构建器
docker buildx create --name mybuilder --use

# 构建并推送多架构镜像
docker buildx build --platform linux/amd64,linux/arm64 -t your-username/one-api:latest --push .
```

### 方法二：在本地为您的架构构建镜像

```bash
# 查看您的系统架构
uname -m

# 为特定架构构建镜像
docker build --build-arg TARGETARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') -t one-api:local .
```

### 方法三：使用预构建的多架构镜像

如果可用，尝试使用支持多架构的预构建镜像：

```bash
# 在docker-compose.yml中将image改为
# image: calciumion/new-api:multiarch
```

