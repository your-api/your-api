package relay

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/middleware"
	"one-api/model"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting/model_setting"
	"strings"
	"time"
)

func getAndValidateClaudeRequest(c *gin.Context) (textRequest *dto.ClaudeRequest, err error) {
	textRequest = &dto.ClaudeRequest{}
	err = c.ShouldBindJSON(textRequest)
	if err != nil {
		return nil, err
	}
	if textRequest.Messages == nil || len(textRequest.Messages) == 0 {
		return nil, errors.New("field messages is required")
	}
	if textRequest.Model == "" {
		return nil, errors.New("field model is required")
	}
	return textRequest, nil
}

func ClaudeHelper(c *gin.Context) (claudeError *dto.ClaudeErrorWithStatusCode) {

	relayInfo := relaycommon.GenRelayInfoClaude(c)

	// 检查 User-Agent 是否包含 "cli"，如果包含则使用透传模式的重试逻辑
	//userAgent := c.Request.Header.Get("User-Agent")
	//if strings.Contains(strings.ToLower(userAgent), "cli") {
	//	return ClaudePassthroughWithRetry(c, relayInfo)
	//}

	// get & validate textRequest 获取并验证文本请求
	textRequest, err := getAndValidateClaudeRequest(c)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "invalid_claude_request", http.StatusBadRequest)
	}

	if textRequest.Stream {
		relayInfo.IsStream = true
	}

	err = helper.ModelMappedHelper(c, relayInfo)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "model_mapped_error", http.StatusInternalServerError)
	}

	textRequest.Model = relayInfo.UpstreamModelName

	promptTokens, err := getClaudePromptTokens(textRequest, relayInfo)
	// count messages token error 计算promptTokens错误
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "count_token_messages_failed", http.StatusInternalServerError)
	}

	priceData, err := helper.ModelPriceHelper(c, relayInfo, promptTokens, int(textRequest.MaxTokens))
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "model_price_error", http.StatusInternalServerError)
	}

	// pre-consume quota 预消耗配额
	preConsumedQuota, userQuota, openaiErr := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)

	if openaiErr != nil {
		return service.OpenAIErrorToClaudeError(openaiErr)
	}
	defer func() {
		if openaiErr != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return service.ClaudeErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
	}
	adaptor.Init(relayInfo)
	var requestBody io.Reader

	if textRequest.MaxTokens == 0 {
		textRequest.MaxTokens = uint(model_setting.GetClaudeSettings().GetDefaultMaxTokens(textRequest.Model))
	}

	if model_setting.GetClaudeSettings().ThinkingAdapterEnabled &&
		strings.HasSuffix(textRequest.Model, "-thinking") {
		if textRequest.Thinking == nil {
			// 因为BudgetTokens 必须大于1024
			if textRequest.MaxTokens < 1280 {
				textRequest.MaxTokens = 1280
			}

			// BudgetTokens 为 max_tokens 的 80%
			textRequest.Thinking = &dto.Thinking{
				Type:         "enabled",
				BudgetTokens: int(float64(textRequest.MaxTokens) * model_setting.GetClaudeSettings().ThinkingAdapterBudgetTokensPercentage),
			}
			// TODO: 临时处理
			// https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#important-considerations-when-using-extended-thinking
			textRequest.TopP = 0
			textRequest.Temperature = common.GetPointer[float64](1.0)
		}
		textRequest.Model = strings.TrimSuffix(textRequest.Model, "-thinking")
		relayInfo.UpstreamModelName = textRequest.Model
	}

	convertedRequest, err := adaptor.ConvertClaudeRequest(c, relayInfo, textRequest)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "convert_request_failed", http.StatusInternalServerError)
	}
	jsonData, err := json.Marshal(convertedRequest)
	if common.DebugEnabled {
		println("requestBody: ", string(jsonData))
	}
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "json_marshal_failed", http.StatusInternalServerError)
	}
	requestBody = bytes.NewBuffer(jsonData)

	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "do_request_failed", http.StatusInternalServerError)
	}

	if resp != nil {
		httpResp = resp.(*http.Response)
		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			openaiErr = service.RelayErrorHandler(httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(openaiErr, statusCodeMappingStr)
			return service.OpenAIErrorToClaudeError(openaiErr)
		}
	}

	usage, openaiErr := adaptor.DoResponse(c, httpResp, relayInfo)
	//log.Printf("usage: %v", usage)
	if openaiErr != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(openaiErr, statusCodeMappingStr)
		return service.OpenAIErrorToClaudeError(openaiErr)
	}
	service.PostClaudeConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	return nil
}

func getClaudePromptTokens(textRequest *dto.ClaudeRequest, info *relaycommon.RelayInfo) (int, error) {
	var promptTokens int
	var err error
	switch info.RelayMode {
	default:
		promptTokens, err = service.CountTokenClaudeRequest(*textRequest, info.UpstreamModelName)
	}
	info.PromptTokens = promptTokens
	return promptTokens, err
}

// ClaudePassthroughWithRetry 透传模式的重试逻辑，类似于 RelayClaude
func ClaudePassthroughWithRetry(c *gin.Context, relayInfo *relaycommon.RelayInfo) (claudeError *dto.ClaudeErrorWithStatusCode) {
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")

	// 使用新的重试配置
	maxRetries := common.GetEffectiveMaxRetryTimes()

	for i := 0; i <= maxRetries; i++ {
		c.Set("retry_times", i) // 设置重试次数到上下文中
		if i == maxRetries {
			c.Set("is_last", true) // 最后一次重试时设置 is_last 为 true
		} else {
			c.Set("is_last", false) // 其他重试次数设置 is_last 为 false
		}

		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			claudeError = &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("获取渠道失败: %s", err.Error()),
				},
				StatusCode: http.StatusInternalServerError,
			}
			break
		}

		// 第一次请求时添加渠道ID到使用记录
		// 但要检查是否已经记录过（避免外层已经记录的情况）
		if i == 0 {
			useChannel := c.GetStringSlice("use_channel")
			if len(useChannel) == 0 {
				// 只有在还没有记录时才记录
				addUsedChannel(c, channel.Id)
			}
		}

		// 记录重试信息
		if i > 0 {
			common.LogInfo(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, maxRetries-i))
		}

		claudeError = ClaudePassthroughRequest(c, relayInfo, channel)

		if claudeError == nil {
			return // 成功处理请求，直接返回
		}

		// 转换为OpenAIError进行处理
		openaiErr := &dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: claudeError.Error.Message,
				Type:    "claude_error",
			},
			StatusCode: claudeError.StatusCode,
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		// 可以在这里添加 shouldRetry 逻辑，类似原来的 RelayClaude
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if claudeError != nil {
		if claudeError.StatusCode == http.StatusTooManyRequests {
			common.LogError(c, fmt.Sprintf("origin 429 error: %s", claudeError.Error.Message))
			claudeError.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		} else if !claudeError.LocalError {
			// 透传模式保持原始错误信息，不进行过滤
			common.LogError(c, fmt.Sprintf("upstream claude error (status %d): %s", claudeError.StatusCode, claudeError.Error.Message))
		}

		claudeError.Error.Message = common.MessageWithRequestId(claudeError.Error.Message, requestId)
		c.JSON(claudeError.StatusCode, gin.H{
			"error": claudeError.Error,
		})
	}

	return claudeError
}

// ClaudePassthroughRequest 执行单次透传请求，只修改模型名，其他完全透传
func ClaudePassthroughRequest(c *gin.Context, relayInfo *relaycommon.RelayInfo, channel *model.Channel) (claudeError *dto.ClaudeErrorWithStatusCode) {
	// 不在这里记录使用的渠道，已经在 getChannel 或主循环中记录过了

	// 读取原始请求体
	requestBody, err := common.GetRequestBody(c)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "read_request_body_failed", http.StatusBadRequest)
	}

	// 解析请求体为 map 以便修改模型名，同时保留所有其他字段
	var requestMap map[string]interface{}
	if err := json.Unmarshal(requestBody, &requestMap); err != nil {
		return service.ClaudeErrorWrapperLocal(err, "invalid_json_request", http.StatusBadRequest)
	}

	// 基础验证
	messages, hasMessages := requestMap["messages"]
	if !hasMessages || messages == nil {
		return service.ClaudeErrorWrapperLocal(errors.New("field messages is required"), "invalid_claude_request", http.StatusBadRequest)
	}

	originalModel, hasModel := requestMap["model"].(string)
	if !hasModel || originalModel == "" {
		return service.ClaudeErrorWrapperLocal(errors.New("field model is required"), "invalid_claude_request", http.StatusBadRequest)
	}

	// 设置流模式标志（用于内部处理）
	if stream, ok := requestMap["stream"].(bool); ok && stream {
		relayInfo.IsStream = true
	}

	// 模型映射（修改请求体中的模型名）
	err = helper.ModelMappedHelper(c, relayInfo)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "model_mapped_error", http.StatusInternalServerError)
	}

	// 如果模型被映射了，更新请求体中的模型名
	if relayInfo.IsModelMapped && relayInfo.UpstreamModelName != originalModel {
		requestMap["model"] = relayInfo.UpstreamModelName
	}

	// 为了计费，创建一个临时的 ClaudeRequest 结构体
	var textRequest dto.ClaudeRequest
	tempBody, _ := json.Marshal(requestMap)
	json.Unmarshal(tempBody, &textRequest)

	// 计算 prompt tokens（用于计费）
	promptTokens, err := getClaudePromptTokens(&textRequest, relayInfo)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "count_token_messages_failed", http.StatusInternalServerError)
	}

	// 获取价格信息 - 使用请求中的实际 max_tokens，不设置默认值
	maxTokensForPricing := 0
	if maxTokens, ok := requestMap["max_tokens"].(float64); ok {
		maxTokensForPricing = int(maxTokens)
	}
	if maxTokensForPricing == 0 {
		// 只用于计费，不修改请求
		maxTokensForPricing = model_setting.GetClaudeSettings().GetDefaultMaxTokens(originalModel)
	}
	priceData, err := helper.ModelPriceHelper(c, relayInfo, promptTokens, maxTokensForPricing)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "model_price_error", http.StatusInternalServerError)
	}

	// 预消耗配额
	preConsumedQuota, userQuota, openaiErr := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if openaiErr != nil {
		return service.OpenAIErrorToClaudeError(openaiErr)
	}

	// 确保在函数结束时处理配额
	defer func() {
		if claudeError != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()

	// 获取适配器
	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return service.ClaudeErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
	}
	adaptor.Init(relayInfo)

	// 将修改后的请求体（仅模型名可能被修改）序列化
	modifiedBody, err := json.Marshal(requestMap)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "json_marshal_failed", http.StatusInternalServerError)
	}

	// 使用修改后的请求体
	bodyReader := bytes.NewBuffer(modifiedBody)

	// 重置请求体，确保每次重试都使用修改后的请求体
	c.Request.Body = io.NopCloser(bytes.NewBuffer(modifiedBody))

	// 执行请求
	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, relayInfo, bodyReader)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "do_request_failed", http.StatusInternalServerError)
	}

	if resp != nil {
		httpResp = resp.(*http.Response)

		// 设置首次响应时间（用于日志记录）
		if relayInfo.FirstResponseTime.IsZero() {
			relayInfo.FirstResponseTime = time.Now()
		}

		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			openaiErr := service.RelayErrorHandler(httpResp, false)
			service.ResetStatusCode(openaiErr, statusCodeMappingStr)
			return service.OpenAIErrorToClaudeError(openaiErr)
		}
	}

	// 处理响应并计费
	var usage *dto.Usage
	if relayInfo.IsStream {
		// 流式响应：透传并收集使用信息
		usage, claudeError = ClaudePassthroughStreamHandler(c, httpResp, relayInfo)
	} else {
		// 非流式响应：透传并收集使用信息
		usage, claudeError = ClaudePassthroughHandler(c, httpResp, relayInfo)
	}

	// 如果成功，进行计费和记录日志
	if claudeError == nil && usage != nil {
		// 使用与原始 ClaudeHelper 相同的计费和日志记录方式
		service.PostClaudeConsumeQuota(c, relayInfo, usage, preConsumedQuota, userQuota, priceData, "")
	}

	return claudeError
}

// ClaudePassthroughStreamHandler 透传流式响应并收集 usage 信息
func ClaudePassthroughStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *dto.ClaudeErrorWithStatusCode) {
	defer resp.Body.Close()

	usage := &dto.Usage{}
	var responseText strings.Builder

	// 设置响应头
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	// 开始响应
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Flush()

	// 透传流数据并收集 usage 信息
	scanner := bufio.NewScanner(resp.Body)
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		line := scanner.Text()

		// 尝试解析 usage 信息（但不修改数据）
		if strings.HasPrefix(line, "data: ") {
			dataStr := strings.TrimPrefix(line, "data: ")
			if dataStr != "[DONE]" && dataStr != "" {
				var claudeResponse dto.ClaudeResponse
				if err := json.Unmarshal([]byte(dataStr), &claudeResponse); err == nil {
					if claudeResponse.Type == "message_start" {
						usage.PromptTokens = claudeResponse.Message.Usage.InputTokens
						usage.PromptTokensDetails.CachedTokens = claudeResponse.Message.Usage.CacheReadInputTokens
						usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Message.Usage.CacheCreationInputTokens
					} else if claudeResponse.Type == "content_block_delta" {
						responseText.WriteString(claudeResponse.Delta.GetText())
					} else if claudeResponse.Type == "message_delta" {
						if claudeResponse.Usage.InputTokens > 0 {
							usage.PromptTokens = claudeResponse.Usage.InputTokens
						}
						usage.CompletionTokens = claudeResponse.Usage.OutputTokens
						usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
					}
				}
			}
		}

		// 直接写入原始数据
		c.Writer.Write([]byte(line + "\n"))
		if line == "" || strings.HasPrefix(line, "data:") {
			// 刷新缓冲区以确保数据立即发送
			if flusher, ok := c.Writer.(http.Flusher); ok {
				flusher.Flush()
			}
		}
	}

	if err := scanner.Err(); err != nil {
		common.LogError(c, fmt.Sprintf("stream scanner error: %v", err))
	}

	// 如果没有获取到 usage 信息，尝试从响应文本估算
	if usage.CompletionTokens == 0 && responseText.Len() > 0 {
		estimatedUsage, _ := service.ResponseText2Usage(responseText.String(), info.UpstreamModelName, usage.PromptTokens)
		if estimatedUsage != nil {
			usage.CompletionTokens = estimatedUsage.CompletionTokens
			usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
		}
	}

	return usage, nil
}

// ClaudePassthroughHandler 透传非流式响应并收集 usage 信息
func ClaudePassthroughHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *dto.ClaudeErrorWithStatusCode) {
	defer resp.Body.Close()

	// 读取响应体
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, service.ClaudeErrorWrapperLocal(err, "read_response_body_failed", http.StatusInternalServerError)
	}

	// 解析响应以获取 usage 信息（但不修改响应）
	var claudeResponse dto.ClaudeResponse
	usage := &dto.Usage{}
	if err := json.Unmarshal(responseBody, &claudeResponse); err == nil {
		usage.PromptTokens = claudeResponse.Usage.InputTokens
		usage.CompletionTokens = claudeResponse.Usage.OutputTokens
		usage.TotalTokens = claudeResponse.Usage.InputTokens + claudeResponse.Usage.OutputTokens
		usage.PromptTokensDetails.CachedTokens = claudeResponse.Usage.CacheReadInputTokens
		usage.PromptTokensDetails.CachedCreationTokens = claudeResponse.Usage.CacheCreationInputTokens

		// 如果没有 usage 信息，尝试从内容估算
		if usage.CompletionTokens == 0 && len(claudeResponse.Content) > 0 {
			var responseText strings.Builder
			for _, content := range claudeResponse.Content {
				if content.Type == "text" {
					responseText.WriteString(content.GetText())
				}
			}
			if responseText.Len() > 0 {
				estimatedUsage, _ := service.ResponseText2Usage(responseText.String(), info.UpstreamModelName, usage.PromptTokens)
				if estimatedUsage != nil {
					usage.CompletionTokens = estimatedUsage.CompletionTokens
					usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
				}
			}
		}
	}

	// 设置响应头
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)

	// 直接写入原始响应
	_, err = c.Writer.Write(responseBody)
	if err != nil {
		common.LogError(c, fmt.Sprintf("write response failed: %v", err))
	}

	return usage, nil
}

// 以下是从 controller/relay.go 复制的辅助函数，用于支持重试功能

func addUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}

func getChannel(c *gin.Context, group, originalModel string, retryCount int) (*model.Channel, error) {
	if retryCount == 0 {
		autoBan := c.GetBool("auto_ban")
		autoBanInt := 1
		if !autoBan {
			autoBanInt = 0
		}
		return &model.Channel{
			Id:      c.GetInt("channel_id"),
			Type:    c.GetInt("channel_type"),
			Name:    c.GetString("channel_name"),
			AutoBan: &autoBanInt,
		}, nil
	}
	channel, err := model.CacheGetRandomSatisfiedChannel(group, originalModel, retryCount)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("获取重试渠道失败: %s", err.Error()))
	}
	// 只在重试时设置新的渠道上下文
	// 第一次（retryCount==0）时已经有了渠道信息，不需要再设置
	middleware.SetupContextForSelectedChannel(c, channel, originalModel)
	// 添加渠道ID到使用记录
	addUsedChannel(c, channel.Id)
	return channel, nil
}

func processChannelError(c *gin.Context, channelId int, channelType int, channelName string, autoBan bool, err *dto.OpenAIErrorWithStatusCode) {
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	common.LogError(c, fmt.Sprintf("relay error (channel #%d, status code: %d): %s", channelId, err.StatusCode, err.Error.Message))
	if service.ShouldDisableChannel(channelType, err) && autoBan {
		service.DisableChannel(channelId, channelName, err.Error.Message)
	}
}
