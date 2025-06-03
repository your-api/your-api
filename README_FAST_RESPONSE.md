# Chat Completions 快速响应功能

## 功能概述

为 `/chat/completions` 端点新增了快速响应功能，该功能会立即返回空回复，不等待上游 API 的响应，从而确保极低的响应延迟，满足对响应时间要求极高的场景需求。

## 配置方式

### 方式一：使用新的快速响应端点（推荐）

这种方式保持原有端点不变，新增一个专门的快速响应端点：

**原有端点**（正常行为）：
```
POST /v1/chat/completions
```

**新的快速响应端点**：
```
POST /v1/chat/completions/fast
```

### 方式二：替换原有端点

如果希望完全替换原有端点的行为，请进行以下配置：

1. **修改路由配置**（`router/relay-router.go`）：
   ```go
   // 注释掉这两行
   // httpRouter.POST("/chat/completions", controller.Relay)
   // httpRouter.POST("/chat/completions/fast", controller.RelayCustomFastResponse)
   
   // 启用这一行
   httpRouter.POST("/chat/completions", controller.RelayWithFastResponseOption)
   ```

2. **在启动代码中启用快速响应**（例如在 `main.go` 中）：
   ```go
   import "one-api/controller"
   
   func main() {
       // 启用快速响应模式
       controller.FastResponseEnabled = true
       
       // 可选：启用异步日志记录（默认关闭）
       controller.AsyncLoggingEnabled = true
       
       // ... 其他启动代码
   }
   ```

### 配置选项说明

- `FastResponseEnabled`：控制是否启用快速响应模式（默认 false）
- `AsyncLoggingEnabled`：控制是否启用异步日志记录（默认 false）
  - 启用后会在后台安全地记录请求信息
  - 不会影响响应速度，但会消耗一些系统资源

## 使用方法

### 请求格式

请求格式与标准的 chat completions 完全相同：

**非流式请求示例：**
```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7
}
```

**流式请求示例：**
```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": true,
  "temperature": 0.7
}
```

### 响应格式

#### 非流式响应
```json
{
  "id": "chatcmpl-7QyqpwdfhqwajicIEznoc6Q47XAyW",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": ""
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  }
}
```

#### 流式响应
```
data: {"id":"chatcmpl-7QyqpwdfhqwajicIEznoc6Q47XAyW","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-7QyqpwdfhqwajicIEznoc6Q47XAyW","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

## 测试功能

项目包含一个测试脚本 `test_fast_response.go`，可以用来验证功能：

```bash
# 编译并运行测试
go run test_fast_response.go
```

测试脚本会验证：
- 非流式快速响应
- 流式快速响应
- 响应时间测量

## 功能特点

1. **极低延迟**：接收到请求后立即返回空内容的响应，通常在几毫秒内完成
2. **格式兼容**：返回的响应格式完全兼容 OpenAI API 标准
3. **流式支持**：完整支持流式和非流式两种响应模式
4. **异步处理**：在后台异步处理实际请求，用于日志记录和统计（可选）
5. **透明切换**：客户端无需修改代码，只需更改端点地址或配置
6. **配置灵活**：提供两种配置方式，满足不同的使用需求

## 适用场景

- **性能测试**：需要消除网络延迟影响的API性能测试
- **开发调试**：快速验证请求格式和客户端逻辑
- **UI响应**：需要即时反馈的用户界面，避免用户等待
- **负载测试**：测试系统在高并发下的处理能力
- **占位符服务**：在真实服务不可用时提供兼容的占位符响应

## 注意事项

1. 返回的内容始终为空字符串，不包含任何AI生成的内容
2. 所有token使用量统计均为0
3. 异步日志记录是可选的，默认关闭以确保最佳性能和稳定性
4. 该功能主要用于优化响应时间，而非提供实际的AI服务
5. 如果选择替换原有端点，请确保你的应用能够处理空响应
6. **稳定性保证**：已修复可能导致系统 panic 的并发问题，确保系统稳定运行

## 性能表现

在典型的服务器环境下，快速响应模式的响应时间通常为：
- 非流式响应：< 5ms
- 流式响应：< 10ms

具体性能取决于服务器硬件和网络环境。 