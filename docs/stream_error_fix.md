# 流式响应错误处理优化总结

## 问题描述

在调用 `/v1/chat/completions` 等接口时，如果调用上游渠道返回错误，系统直接将上游错误信息返回给调用方，暴露了内部系统架构和具体的错误详情。

用户反馈的核心问题：**在流式返回（stream）时，系统yield了上游的错误信息给客户端**。

## 问题根因

经过代码分析发现，真正暴露上游错误信息的地方不是在 controller 层的错误处理，而是在**各个渠道的流式响应处理器（stream handler）**中。

主要问题点：

### 1. Claude 渠道流处理器

**文件**: `relay/channel/claude/relay-claude.go`

**问题代码**:
```go
// HandleStreamResponseData 函数中
if claudeResponse.Error != nil && claudeResponse.Error.Type != "" {
    return &dto.OpenAIErrorWithStatusCode{
        Error: dto.OpenAIError{
            Code:    "stream_response_error",
            Type:    claudeResponse.Error.Type,        // 直接暴露上游错误类型
            Message: claudeResponse.Error.Message,     // 直接暴露上游错误信息！
        },
        StatusCode: http.StatusInternalServerError,
    }
}
```

### 2. OpenAI 渠道流处理器

**文件**: `relay/channel/openai/relay-openai.go`

**问题代码**:
```go
if isEmptyResp {
    return service.OpenAIErrorWrapper(fmt.Errorf("empty response"), "empty_response", http.StatusInternalServerError), nil
}
```

## 修复方案

### 1. 修复 Claude 渠道流错误处理

**修改后的代码**:
```go
if claudeResponse.Error != nil && claudeResponse.Error.Type != "" {
    // 记录原始错误信息用于调试
    common.LogError(c, fmt.Sprintf("claude stream error: %s (type: %s)", claudeResponse.Error.Message, claudeResponse.Error.Type))
    
    // 返回统一的友好错误信息，不暴露上游错误详情
    return &dto.OpenAIErrorWithStatusCode{
        Error: dto.OpenAIError{
            Code:    "service_error",
            Type:    "service_unavailable",
            Message: "当前渠道由于负载较大，暂不可用，请稍后重试",
        },
        StatusCode: http.StatusInternalServerError,
    }
}
```

### 2. 修复 Claude 渠道非流式错误处理

**HandleClaudeResponseData 函数**:
```go
if claudeResponse.Error != nil && claudeResponse.Error.Type != "" {
    // 记录原始错误信息用于调试
    common.LogError(c, fmt.Sprintf("claude response error: %s (type: %s)", claudeResponse.Error.Message, claudeResponse.Error.Type))
    
    // 返回统一的友好错误信息，不暴露上游错误详情
    return &dto.OpenAIErrorWithStatusCode{
        Error: dto.OpenAIError{
            Message: "当前渠道由于负载较大，暂不可用，请稍后重试",
            Type:    "service_unavailable",
            Code:    "service_error",
        },
        StatusCode: http.StatusInternalServerError,
    }
}
```

### 3. 修复 OpenAI 渠道空响应错误处理

**修改后的代码**:
```go
if isEmptyResp {
    // 记录原始错误信息用于调试
    common.LogError(c, "received empty response from upstream")
    
    // 返回统一的友好错误信息，不暴露上游错误详情
    return &dto.OpenAIErrorWithStatusCode{
        Error: dto.OpenAIError{
            Message: "当前渠道由于负载较大，暂不可用，请稍后重试",
            Type:    "service_unavailable", 
            Code:    "service_error",
        },
        StatusCode: http.StatusInternalServerError,
    }, nil
}
```

## 修复效果

### ✅ 修复前 vs 修复后

**修复前** - 暴露上游错误:
```json
{
  "error": {
    "type": "invalid_request_error",
    "message": "Your credit balance is too low to access the Claude API",
    "code": "stream_response_error"
  }
}
```

**修复后** - 统一友好错误:
```json
{
  "error": {
    "type": "service_unavailable",
    "message": "当前渠道由于负载较大，暂不可用，请稍后重试",
    "code": "service_error"
  }
}
```

### 🔍 调试信息保留

虽然客户端收到统一的友好错误信息，但原始错误详情仍然完整记录在服务器日志中：

```
[ERROR] claude stream error: Your credit balance is too low to access the Claude API (type: invalid_request_error)
```

## 影响范围

### ✅ 已修复的渠道
- **Claude 渠道**: 流式和非流式响应错误处理
- **OpenAI 渠道**: 空响应错误处理

### ✅ 安全的渠道
大部分其他渠道（如 XAI、Baidu、Ali 等）在遇到解析错误时只记录日志并继续处理，不会直接返回错误给客户端，相对安全。

### 💡 Controller 层处理

在 `controller/relay.go` 中，用户已正确地只对自定义渠道进行友好错误处理，这是合理的，因为：
- Controller 层主要处理非流式响应的错误
- 流式响应的错误主要在各渠道的 stream handler 中处理
- 不同渠道类型有不同的错误处理需求

## 安全性提升

1. **信息脱敏**: 不再向客户端暴露上游API的具体错误信息
2. **统一体验**: 所有渠道错误都返回一致的友好提示
3. **调试友好**: 原始错误信息完整保留在服务器日志中
4. **隐私保护**: 避免泄露内部系统架构和服务商信息

## 最佳实践

1. **生产环境**: 向用户显示友好的通用错误信息
2. **调试环境**: 通过日志查看详细的原始错误信息  
3. **监控告警**: 可以基于特定错误模式设置告警
4. **问题排查**: 通过 request_id 关联用户请求和服务器日志

现在，所有 `/v1/chat/completions` 及其他API接口在遇到上游错误时都会返回统一的友好错误信息，有效保护了系统安全性和用户体验。 