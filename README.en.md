<p align="right">
   <a href="./README.zh.md">中文</a> | <strong>English</strong>
</p>
<div align="center">

![new-api](/web/public/logo.png)

# Your API

🍥 Next-generation large model gateway and AI asset management system. A high-performance, visually appealing AI model interface management and distribution system.

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

## 📝 Project Overview

![image-20250515183420460](./imgs/image-20250515183420460.png)

> [!NOTE]  
> This project is open-source and is based on secondary development of [New API](https://github.com/Calcium-Ion/new-api.git).

> [!IMPORTANT]  
>
> - This project is for personal learning purposes only, with no guaranteed stability and no technical support provided.
> - Users must comply with OpenAI's [Terms of Use](https://openai.com/policies/terms-of-use) and **legal regulations**, and must not use it for illegal purposes.
> - Per the [Interim Measures for the Management of Generative AI Services](http://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm), do not provide unfiled generative AI services to the public in China.

## Differences

This project will continuously sync with the latest version of [New API](https://github.com/Calcium-Ion/new-api.git) and is committed to expanding and optimizing its features. By integrating the latest technologies and best practices, it ensures sustained improvements in API performance, stability, and scalability to meet evolving business needs and technical challenges.

### Additions and Optimizations

- [x] 🎨 Distinct overall interface style
- [x] Prevent image probe requests from exposing upstream
- [x] Channel empty response validation to ensure retries for empty responses
- [x] Support multi-key polling in model editing
- [x] Add proxy IP support for individual channels, allowing fixed proxy IPs for requests to enhance security
- [x] Support proxy IP configuration for image reading
- [x] Add quick start guide
- [x] Add independent development documentation page
- [x] Display model providers on the homepage
- [x] Mobile device adaptation
- [x] Optimized model price display with a modern design, supporting model description configuration
- [x] Support AI provider configuration
- [x] Support model description configuration
- [x] Configurable homepage promotional copy
- [x] Customizable navigation links
- [x] Add support for Claude native API format requests
- [x] Optimize margins of some interface elements to avoid crowding
- [x] Optimize announcement display
- [x] Pre-configure more models
- [x] Add Tailwind CSS and Redux support to the frontend for easier agile development

## Usage Instructions

#### Using Docker Image Directly

```shell
# Using SQLite
docker run --name yourapi -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data yourapi/yourapi:latest

# Using MySQL
docker run --name yourapi -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/yourapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/new-api:/data yourapi/yourapi:latest
```

#### Using docker-compose

Create a `docker-compose.yml` file on your server with the following content:

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
      - SQL_DSN=root:123456@tcp(mysql:3306)/yourapi?charset=utf8mb4&parseTime=True&loc=Local  # Modify this line or comment it out to use SQLite as the database
      - REDIS_CONN_STRING=redis://redis # Can be customized, e.g., redis://user:password@localhost:6379/0
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true # Enable error logging
    #      - TIKTOKEN_CACHE_DIR=./tiktoken_cache  # Uncomment if tiktoken_cache is needed
    #      - SESSION_SECRET=random_string  # Set for multi-node deployment, must change this random string!!!
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
    #   - "3306:3306"  # Uncomment to access MySQL from outside Docker

volumes:
  mysql_data:
```

Alternative `docker-compose.yml` for simpler setup:

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
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      - SQL_DSN=root:123456@tcp(host.docker.internal:3306)/yourapi?charset=utf8mb4&parseTime=True&loc=Local  # Modify this line or comment it out to use SQLite as the database
      - REDIS_CONN_STRING=redis://redis
      - SESSION_SECRET=random_string  # Must manually change this to a random string before starting
      - TZ=Asia/Shanghai

    depends_on:
      - redis
    healthcheck:
      test: [ "CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -o '\"success\":\\s*true' | awk -F: '{print $2}'" ]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:latest
    container_name: redis
    restart: always
```

Start the service:

```shell
docker-compose up -d
```

Access `http://ip:3000` to see the login interface. Log in with the default credentials (username: root, password: 123456).

To update to a newer version, run:

```shell
docker-compose pull && docker-compose up -d
```

You can also access the AI-generated DeepWiki:
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/QuantumNous/new-api)

## ✨ Key Features

Your API provides a rich set of features. For details, refer to the [Feature Introduction](https://docs.newapi.pro/wiki/features-introduction):

1. 🎨 Brand-new UI interface
2. 🌍 Multi-language support
3. 💰 Online recharge function (via YiPay)
4. 🔄 Compatible with the original One API database
5. 💵 Model usage-based billing
6. ⚖️ Weighted random channel selection
7. 📈 Data dashboard (console)
8. 🔒 Token grouping and model restrictions
9. 🤖 Support for additional authentication methods (LinuxDO, Telegram, OIDC)
10. 🔄 Support for Rerank models (Cohere and Jina), [API Docs](https://docs.newapi.pro/api/jinaai-rerank)
11. ⚡ Support for OpenAI Realtime API (including Azure channels), [API Docs](https://docs.newapi.pro/api/openai-realtime)
12. ⚡ Support for Claude Messages format, [API Docs](https://docs.newapi.pro/api/anthropic-chat)
13. Support for entering the chat interface via the /chat2link route
14. 🧠 Support for setting reasoning effort via model name suffixes:
    1. OpenAI o-series models
        - Add `-high` suffix for high reasoning effort (e.g., `o3-mini-high`)
        - Add `-medium` suffix for medium reasoning effort (e.g., `o3-mini-medium`)
        - Add `-low` suffix for low reasoning effort (e.g., `o3-mini-low`)
    2. Claude thinking models
        - Add `-thinking` suffix to enable thinking mode (e.g., `claude-3-7-sonnet-20250219-thinking`)
15. 🔄 Thought-to-content conversion
16. 🔄 Model rate-limiting for users
17. 💰 Cache billing support, enabling proportional billing on cache hits:
    1. Set the `Prompt Cache Rate` in `System Settings - Operational Settings`
    2. Set the `Prompt Cache Rate` in channels, range 0-1 (e.g., 0.5 for 50% billing on cache hits)
    3. Supported channels:
        - [x] OpenAI
        - [x] Azure
        - [x] DeepSeek
        - [x] Claude

## Model Support

This version supports various models. For details, refer to the [API Relay Docs](https://docs.newapi.pro/api):

1. Third-party models **gpts** (gpt-4-gizmo-*)
2. Third-party channel [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) interface, [API Docs](https://docs.newapi.pro/api/midjourney-proxy-image)
3. Third-party channel [Suno API](https://github.com/Suno-API/Suno-API) interface, [API Docs](https://docs.newapi.pro/api/suno-music)
4. Custom channels with full request URL support
5. Rerank models ([Cohere](https://cohere.ai/) and [Jina](https://jina.ai/)), [API Docs](https://docs.newapi.pro/api/jinaai-rerank)
6. Claude Messages format, [API Docs](https://docs.newapi.pro/api/anthropic-chat)
7. Dify, currently supports only chatflow

## Environment Variable Configuration

### Basic Configuration

| Environment Variable | Description        | Default Value   | Example                   |
| :------------------ | :----------------- | :-------------- | :------------------------ |
| `PORT`              | Service port       | `3000`          | `PORT=8080`               |
| `TZ`                | Time zone         | `Asia/Shanghai` | `TZ=America/New_York`     |

### 💾 Database Configuration

| Environment Variable         | Description                          | Default Value            | Example                                                   |
| :-------------------------- | :----------------------------------- | :----------------------- | :-------------------------------------------------------- |
| `SQL_DSN`                   | Database connection string           | SQLite (data/one-api.db) | `SQL_DSN=root:123456@tcp(localhost:3306)/oneapi`          |
| `SQL_MAX_IDLE_CONNS`        | Max idle connections in pool         | `100`                    | `SQL_MAX_IDLE_CONNS=50`                                   |
| `SQL_MAX_OPEN_CONNS`        | Max open connections in pool         | `1000`                   | `SQL_MAX_OPEN_CONNS=500`                                  |
| `SQL_CONN_MAX_LIFETIME`     | Max connection lifetime (minutes)    | `60`                     | `SQL_CONN_MAX_LIFETIME=120`                               |
| `LOG_SQL_DSN`               | Separate log table connection string | -                        | `LOG_SQL_DSN=root:123456@tcp(localhost:3306)/oneapi_logs` |
| `SQLITE_BUSY_TIMEOUT`       | SQLite lock wait timeout (ms)        | `3000`                   | `SQLITE_BUSY_TIMEOUT=5000`                                |

### 📦 Cache Configuration

| Environment Variable         | Description                          | Default Value | Example                                                    |
| :-------------------------- | :----------------------------------- | :------------ | :--------------------------------------------------------- |
| `REDIS_CONN_STRING`         | Redis connection string              | -             | `REDIS_CONN_STRING=redis://default:redispw@localhost:6379` |
| `MEMORY_CACHE_ENABLED`      | Enable memory cache                  | `false`       | `MEMORY_CACHE_ENABLED=true`                                |
| `REDIS_CONN_POOL_SIZE`      | Redis connection pool size           | -             | `REDIS_CONN_POOL_SIZE=10`                                  |
| `REDIS_PASSWORD`            | Redis cluster/sentinel mode password | -             | `REDIS_PASSWORD=your_password`                             |
| `REDIS_MASTER_NAME`         | Redis sentinel mode master name      | -             | `REDIS_MASTER_NAME=mymaster`                               |
| `BATCH_UPDATE_ENABLED`      | Enable batch database updates        | `false`       | `BATCH_UPDATE_ENABLED=true`                                |
| `BATCH_UPDATE_INTERVAL`     | Batch update interval (seconds)      | `5`           | `BATCH_UPDATE_INTERVAL=10`                                 |

### 🌐 Multi-node and Security Configuration

| Environment Variable         | Description                          | Default Value | Example                                     |
| :-------------------------- | :----------------------------------- | :------------ | :------------------------------------------ |
| `SESSION_SECRET`            | Session key (required for multi-node) | -             | `SESSION_SECRET=random_string`              |
| `CRYPTO_SECRET`             | Encryption key (for database content)| -             | `CRYPTO_SECRET=your_crypto_secret`          |
| `FRONTEND_BASE_URL`         | Frontend base URL                    | -             | `FRONTEND_BASE_URL=https://your-domain.com` |
| `SYNC_FREQUENCY`            | Cache-database sync frequency (s)    | `600`         | `SYNC_FREQUENCY=60`                         |
| `NODE_TYPE`                 | Node type                            | `master`      | `NODE_TYPE=slave`                           |
| `INITIAL_ROOT_TOKEN`        | Root user token on first startup     | -             | `INITIAL_ROOT_TOKEN=your_token`             |
| `INITIAL_ROOT_ACCESS_TOKEN` | System admin token on first startup  | -             | `INITIAL_ROOT_ACCESS_TOKEN=your_token`      |

**Cluster Deployment**

For details on using these variables for cluster deployment, refer to the [Cluster Deployment Guide](https://docs.newapi.pro/installation/cluster-deployment/).

### 👤 User and Token Configuration

| Environment Variable                  | Description                          | Default Value | Example                                     |
| :----------------------------------- | :----------------------------------- | :------------ | :------------------------------------------ |
| `DEFAULT_QUOTA`                      | Default quota for new users          | `0`           | `DEFAULT_QUOTA=10`                          |
| `GLOBAL_USER_QUOTA`                  | Global user quota limit              | -             | `GLOBAL_USER_QUOTA=100`                     |
| `GENERATE_DEFAULT_TOKEN`             | Generate initial token for new users | `false`       | `GENERATE_DEFAULT_TOKEN=true`               |
| `NOTIFICATION_LIMIT_DURATION_MINUTE` | Notification limit duration (minutes) | `10`          | `NOTIFICATION_LIMIT_DURATION_MINUTE=15`     |
| `NOTIFY_LIMIT_COUNT`                 | Max notifications in duration        | `2`           | `NOTIFY_LIMIT_COUNT=3`                      |

### 🚦 Request Limit Configuration

| Environment Variable           | Description                          | Default Value | Example                              |
| :---------------------------- | :----------------------------------- | :------------ | :----------------------------------- |
| `GLOBAL_API_RATE_LIMIT`        | Global API rate limit (per IP, 3 min) | `180`         | `GLOBAL_API_RATE_LIMIT=100`          |
| `GLOBAL_WEB_RATE_LIMIT`        | Global web rate limit (per IP, 3 min) | `60`          | `GLOBAL_WEB_RATE_LIMIT=30`           |
| `RELAY_TIMEOUT`               | Relay request timeout (seconds)      | -             | `RELAY_TIMEOUT=60`                   |
| `USER_CONTENT_REQUEST_TIMEOUT` | User content download timeout (s)    | -             | `USER_CONTENT_REQUEST_TIMEOUT=30`    |
| `STREAMING_TIMEOUT`           | Streaming response timeout (seconds) | `18000`         | `STREAMING_TIMEOUT=21600`              |
| `MAX_FILE_DOWNLOAD_MB`        | Max file download size (MB)          | `20`          | `MAX_FILE_DOWNLOAD_MB=50`            |

**RELAY_TIMEOUT Warning**

Be cautious when setting `RELAY_TIMEOUT`. A value too short may cause:
- Upstream API completes and bills, but local timeout prevents billing
- Billing discrepancies, potentially causing system losses
- Recommended: Do not set unless you know what you're doing

### 📡 Channel Management Configuration

| Environment Variable            | Description                          | Default Value                       | Example                                 |
| :----------------------------- | :----------------------------------- | :---------------------------------- | :-------------------------------------- |
| `CHANNEL_UPDATE_FREQUENCY`     | Periodic channel balance update (min)| -                                   | `CHANNEL_UPDATE_FREQUENCY=1440`         |
| `CHANNEL_TEST_FREQUENCY`       | Periodic channel testing (minutes)   | -                                   | `CHANNEL_TEST_FREQUENCY=1440`           |
| `POLLING_INTERVAL`             | Request interval for batch updates (s)| `0`                                | `POLLING_INTERVAL=5`                    |
| `ENABLE_METRIC`                | Disable channels based on success rate| `false`                            | `ENABLE_METRIC=true`                    |
| `METRIC_QUEUE_SIZE`            | Success rate stats queue size        | `10`                               | `METRIC_QUEUE_SIZE=20`                  |
| `METRIC_SUCCESS_RATE_THRESHOLD`| Success rate threshold               | `0.8`                              | `METRIC_SUCCESS_RATE_THRESHOLD=0.7`     |
| `TEST_PROMPT`                 | User prompt for model testing        | `Print your model name exactly...` | `TEST_PROMPT=Hello`                     |

### 🤖 Model and Request Handling Configuration

| Environment Variable          | Description                                          | Default Value | Example                                  |
| :--------------------------- | :--------------------------------------------------- | :------------ | :--------------------------------------- |
| `FORCE_STREAM_OPTION`        | Override client stream_options                       | `true`        | `FORCE_STREAM_OPTION=false`              |
| `GET_MEDIA_TOKEN`            | Count image tokens                                   | `true`        | `GET_MEDIA_TOKEN=false`                  |
| `GET_MEDIA_TOKEN_NOT_STREAM` | Count image tokens in non-stream mode                | `true`        | `GET_MEDIA_TOKEN_NOT_STREAM=false`       |
| `UPDATE_TASK`                | Update async tasks (MJ, Suno)                       | `true`        | `UPDATE_TASK=false`                      |
| `ENFORCE_INCLUDE_USAGE`      | Force usage return in stream mode                    | `false`       | `ENFORCE_INCLUDE_USAGE=true`             |
| `TIKTOKEN_CACHE_DIR`         | Tiktoken encoder cache directory                    | -             | `TIKTOKEN_CACHE_DIR=/cache/tiktoken`     |
| `DATA_GYM_CACHE_DIR`         | DataGym cache directory                             | -             | `DATA_GYM_CACHE_DIR=/cache/data_gym`     |

**Tiktoken File Configuration**

After downloading tiktoken files, rename them as follows:
- `cl100k_base.tiktoken` to `9b5ad71b2ce5302211f9c61530b329a4922fc6a4`
- `o200k_base.tiktoken` to `fb374d419588a4632f3f557e76b4b70aebbca790`

Place these files in the directory specified by `TIKTOKEN_CACHE_DIR` to improve token calculation performance and reduce network dependency.

**Tiktoken Configuration Example**

```shell
# Docker environment example
TIKTOKEN_CACHE_DIR=/app/data/tiktoken

# Download and rename tiktoken files, then place them in the directory:
/app/data/tiktoken/9b5ad71b2ce5302211f9c61530b329a4922fc6a4
/app/data/tiktoken/fb374d419588a4632f3f557e76b4b70aebbca790
```

Tiktoken is the tokenizer used by OpenAI to count text tokens. Caching these files locally avoids downloading them from the network on every system startup, improving stability and performance, especially in network-restricted environments.

### 🔎 Specific Model Configuration

| Environment Variable           | Description                          | Default Value        | Example                                    |
| :---------------------------- | :----------------------------------- | :------------------- | :----------------------------------------- |
| `AZURE_DEFAULT_API_VERSION`   | Default API version for Azure        | `2024-12-01-preview` | `AZURE_DEFAULT_API_VERSION=2023-05-15`     |
| `COHERE_SAFETY_SETTING`       | Cohere model safety setting          | `NONE`               | `COHERE_SAFETY_SETTING=CONTEXTUAL`         |
| `GEMINI_VISION_MAX_IMAGE_NUM` | Max image count for Gemini           | `16`                 | `GEMINI_VISION_MAX_IMAGE_NUM=8`            |
| `GEMINI_VERSION`              | Gemini version                       | `v1`                 | `GEMINI_VERSION=v1beta`                    |
| `DIFY_DEBUG`                  | Output workflow and node info for Dify| `true`              | `DIFY_DEBUG=false`                         |

- `GENERATE_DEFAULT_TOKEN`: Whether to generate initial tokens for newly registered users, default is `false`
- `STREAMING_TIMEOUT`: Streaming response timeout, default is 120 seconds
- `DIFY_DEBUG`: Whether to output workflow and node information for Dify channels, default is `true`
- `FORCE_STREAM_OPTION`: Whether to override client stream_options parameter, default is `true`
- `GET_MEDIA_TOKEN`: Whether to count image tokens, default is `true`
- `GET_MEDIA_TOKEN_NOT_STREAM`: Whether to count image tokens in non-streaming cases, default is `true`
- `UPDATE_TASK`: Whether to update asynchronous tasks (Midjourney, Suno), default is `true`
- `COHERE_SAFETY_SETTING`: Cohere model safety settings, options are `NONE`, `CONTEXTUAL`, `STRICT`, default is `NONE`
- `GEMINI_VISION_MAX_IMAGE_NUM`: Maximum number of images for Gemini models, default is `16`
- `MAX_FILE_DOWNLOAD_MB`: Maximum file download size in MB, default is `20`
- `CRYPTO_SECRET`: Encryption key used for encrypting database content
- `AZURE_DEFAULT_API_VERSION`: Azure channel default API version, default is `2025-04-01-preview`
- `NOTIFICATION_LIMIT_DURATION_MINUTE`: Notification limit duration, default is `10` minutes
- `NOTIFY_LIMIT_COUNT`: Maximum number of user notifications within the specified duration, default is `2`
- `ERROR_LOG_ENABLED=true`: Whether to record and display error logs, default is `false`

### 📨 Other Configuration

| Environment Variable | Description            | Default Value | Example                            |
| :------------------ | :--------------------- | :------------ | :--------------------------------- |
| `EMAIL_SERVER`      | Email server config    | -             | `EMAIL_SERVER=smtp.example.com:25` |
| `EMAIL_FROM`        | Email sender address   | -             | `EMAIL_FROM=noreply@example.com`   |
| `EMAIL_PASSWORD`    | Email server password  | -             | `EMAIL_PASSWORD=yourpassword`      |

# 🌍 Multi-node Deployment Example

In a multi-node deployment scenario, the following environment variables must be set:

## 👑 Master Node Configuration

```shell
# Database configuration - use remote database
SQL_DSN=root:password@tcp(db-server:3306)/oneapi

# Security configuration
SESSION_SECRET=your_unique_session_secret
CRYPTO_SECRET=your_unique_crypto_secret

# Redis cache configuration
REDIS_CONN_STRING=redis://default:password@redis-server:6379
```

## 👥 Slave Node Configuration

```shell
# Database configuration - use the same remote database
SQL_DSN=root:password@tcp(db-server:3306)/oneapi

# Security configuration - use the same keys as the master
SESSION_SECRET=your_unique_session_secret
CRYPTO_SECRET=your_unique_crypto_secret

# Redis cache configuration - use the same Redis as the master
REDIS_CONN_STRING=redis://default:password@redis-server:6379

# Node type setting
NODE_TYPE=slave

# Optional: Frontend base URL
FRONTEND_BASE_URL=https://your-domain.com

# Optional: Sync frequency
SYNC_FREQUENCY=60
```

# Deployment

For detailed deployment instructions, refer to:

> [!TIP]
> Latest Docker image: `yourapi/yourapi:latest`

### Multi-node Deployment Notes
- The `SESSION_SECRET` environment variable must be set to avoid inconsistent login states across nodes.
- If Redis is shared, `CRYPTO_SECRET` must be set to ensure Redis content accessibility.

### Deployment Requirements
- Local database (default): SQLite (Docker deployments must mount the `/data` directory)
- Remote database: MySQL version >= 5.7.8, PgSQL version >= 9.6

### Deployment Methods

#### Deploy with Docker Compose

```shell
# Clone the project
git clone https://github.com/your-api/your-api.git
cd your-api
# Edit docker-compose.yml as needed
# Start
docker-compose up -d
```

#### Deploy with Docker Image Directly

```shell
# Using SQLite
docker run --name yourapi -d --restart always -p 3000:3000 -e TZ=Asia/Shanghai -v /home/ubuntu/data/yourapi:/data yourapi/yourapi:latest

# Using MySQL
docker run --name yourapi -d --restart always -p 3000:3000 -e SQL_DSN="root:123456@tcp(localhost:3306)/oneapi" -e TZ=Asia/Shanghai -v /home/ubuntu/data/yourapi:/data yourapi/yourapi:latest
```

## Channel Retry and Cache

The channel retry function is implemented and can be configured in `Settings -> Operational Settings -> General Settings`. **It is recommended to enable caching**.

### Cache Setup
1. `REDIS_CONN_STRING`: Configure Redis as the cache
2. `MEMORY_CACHE_ENABLED`: Enable memory cache (not needed if Redis is configured)

## API Documentation

For detailed API documentation, refer to [API Docs](https://docs.newapi.pro/api):

- [Chat API](https://docs.newapi.pro/api/openai-chat)
- [Image API](https://docs.newapi.pro/api/openai-image)
- [Rerank API](https://docs.newapi.pro/api/jinaai-rerank)
- [Realtime API](https://docs.newapi.pro/api/openai-realtime)
- [Claude Chat API (messages)](https://docs.newapi.pro/api/anthropic-chat)

## Related Projects
- [One API](https://github.com/songquanpeng/one-api): Original project
- [Midjourney-Proxy](https://github.com/novicezk/midjourney-proxy): Midjourney interface support
- [chatnio](https://github.com/Deeptrain-Community/chatnio): Next-generation AI one-stop B/C-end solution
- [neko-api-key-tool](https://github.com/Calcium-Ion/neko-api-key-tool): Query usage quota with key

Other projects based on New API:
- [new-api-horizon](https://github.com/Calcium-Ion/new-api-horizon): High-performance optimized version of New API
- [VoAPI](https://github.com/VoAPI/VoAPI): Frontend beautified version based on New API

## Help and Support

If you have any questions, please refer to [Help and Support](https://docs.newapi.pro/support):
- [Community Interaction](https://docs.newapi.pro/support/community-interaction)
- [Issue Feedback](https://docs.newapi.pro/support/feedback-issues)
- [FAQ](https://docs.newapi.pro/support/faq)

## 🤝 Trusted Partners

<p align="center">
  <a href="https://www.cherry-ai.com/" target="_blank"><img
    src="./docs/images/cherry-studio.svg" alt="Cherry Studio" height="58"
  /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://bda.pku.edu.cn/" target="_blank"><img
    src="./docs/images/pku.png" alt="Peking University" height="58"
  /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.compshare.cn/?ytag=GPU_yy_gh_newapi" target="_blank"><img
    src="./docs/images/ucloud.svg" alt="UCloud" height="58"
  /></a>
</p>

<p align="center"><em>No particular order</em></p>

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Calcium-Ion/new-api&type=Date)](https://star-history.com/#Calcium-Ion/new-api&Date)
