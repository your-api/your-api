package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"one-api/common"
	"one-api/constant"
	constant2 "one-api/constant"
	"one-api/dto"
	"one-api/middleware"
	"one-api/model"
	"one-api/relay"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func relayHandler(c *gin.Context, relayMode int) *types.NewAPIError {
	var err *types.NewAPIError
	switch relayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		err = relay.ImageHelper(c)
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		err = relay.AudioHelper(c)
	case relayconstant.RelayModeRerank:
		err = relay.RerankHelper(c, relayMode)
	case relayconstant.RelayModeEmbeddings:
		err = relay.EmbeddingHelper(c)
	case relayconstant.RelayModeResponses:
		err = relay.ResponsesHelper(c)
	case relayconstant.RelayModeGemini:
		err = relay.GeminiHelper(c)
	default:
		err = relay.TextHelper(c)
	}

	if constant2.ErrorLogEnabled && err != nil && types.IsRecordErrorLog(err) {
		// 保存错误日志到mysql中
		userId := c.GetInt("id")
		tokenName := c.GetString("token_name")
		modelName := c.GetString("original_model")
		tokenId := c.GetInt("token_id")
		userGroup := c.GetString("group")
		channelId := c.GetInt("channel_id")
		other := make(map[string]interface{})
		other["error_type"] = err.GetErrorType()
		other["error_code"] = err.GetErrorCode()
		other["status_code"] = err.StatusCode
		other["channel_id"] = channelId
		other["channel_name"] = c.GetString("channel_name")
		other["channel_type"] = c.GetInt("channel_type")
		adminInfo := make(map[string]interface{})
		adminInfo["use_channel"] = c.GetStringSlice("use_channel")
		isMultiKey := common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey)
		if isMultiKey {
			adminInfo["is_multi_key"] = true
			adminInfo["multi_key_index"] = common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
		}
		other["admin_info"] = adminInfo

		// 使用RecordErrorLogDouble进行脱敏处理
		// content是展示给用户的错误信息，contentUpstream是需要脱敏的上游错误信息
		model.RecordErrorLogDouble(c, userId, channelId, modelName, tokenName, err.Error(), err.MaskSensitiveError(), tokenId, 0, false, userGroup, other)
	}

	return err
}

func Relay(c *gin.Context) {
	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	var newAPIError *types.NewAPIError

	for i := 0; i <= common.RetryTimes; i++ {
		// 设置重试次数到上下文中
		c.Set("retry_times", fmt.Sprintf("%d", i))
		if i == common.RetryTimes {
			c.Set("is_last", true) // 最后一次重试时设置 is_last 为 true
		} else {
			c.Set("is_last", false) // 其他重试次数设置 is_last 为 false
		}
		
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			newAPIError = err
			break
		}

		newAPIError = relayRequest(c, relayMode, channel)

		if newAPIError == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		if !shouldRetry(c, newAPIError, common.RetryTimes-i) {
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if newAPIError != nil {
		if newAPIError.StatusCode == http.StatusTooManyRequests {
			common.LogError(c, fmt.Sprintf("origin 429 error: %s", newAPIError.Error()))
			newAPIError.SetMessage("当前分组上游负载已饱和，请稍后再试")
		} else if newAPIError.GetErrorType() != types.ErrorTypeNewAPIError {
			// 上游错误，根据错误类型决定是否暴露具体信息
			common.LogError(c, fmt.Sprintf("upstream error (status %d): %s", newAPIError.StatusCode, newAPIError.Error()))
			errorMessage := newAPIError.Error()
			errorMessageLower := strings.ToLower(errorMessage)
			if strings.Contains(errorMessageLower, "quota") || 
				strings.Contains(errorMessage, "配额") || 
				strings.Contains(errorMessage, "非流") ||
				strings.Contains(errorMessageLower, "poe") || 
				strings.Contains(errorMessageLower, "tenclock") || 
				strings.Contains(errorMessage, "服务超时") ||
				strings.Contains(errorMessage, "额度") || 
				strings.Contains(errorMessageLower, "credit") || 
				strings.Contains(errorMessageLower, "enough") ||
				strings.Contains(errorMessage, "无可用") ||
				strings.Contains(errorMessageLower, "insufficient") ||
				strings.Contains(errorMessageLower, "balance") ||
				strings.Contains(errorMessageLower, "limit") ||
				strings.Contains(errorMessageLower, "exceeded") ||
				strings.Contains(errorMessageLower, "exhausted") {
				newAPIError.SetMessage("当前模型负载较大，请稍后重试，如有任何问题，请联系我们")
			}
			// 非配额相关错误保持原始错误信息
		}
		// 本地错误（ErrorTypeNewAPIError）直接返回原始错误信息
		
		// 检查是否是 CLI 请求
		userAgent := c.Request.Header.Get("User-Agent")
		isCLIRequest := strings.Contains(strings.ToLower(userAgent), "cli")
		
		// 使用 SysError 确保日志输出
		common.SysError(fmt.Sprintf("[Relay] User-Agent: %s, isCLIRequest: %v, ErrorType: %v, StatusCode: %d, Error: %s", 
			userAgent, isCLIRequest, newAPIError.GetErrorType(), newAPIError.StatusCode, newAPIError.Error()))
		
		if isCLIRequest {
			// 对于 CLI 请求，总是返回 clove 格式的错误
			errorMessage := newAPIError.Error()
			
			// 确定错误类型
			errorType := "invalid_request_error"
			if newAPIError.StatusCode == http.StatusTooManyRequests {
				errorType = "rate_limit_error"
			} else if newAPIError.StatusCode == http.StatusUnauthorized {
				errorType = "authentication_error"
			} else if newAPIError.StatusCode >= 500 {
				errorType = "api_error"
			}
			
			// 构建 clove 格式的错误响应
			responseData := gin.H{
				"detail": gin.H{
					"code":    503130,
					"message": fmt.Sprintf("HTTP error occurred when calling Claude AI: %s - %s (Status: %d)", errorType, errorMessage, newAPIError.StatusCode),
					"context": gin.H{
						"url":           "https://api.anthropic.com/v1/messages",
						"status_code":   newAPIError.StatusCode,
						"error_type":    errorType,
						"error_message": errorMessage,
					},
				},
			}
			
			// 记录最终返回给客户端的响应
			responseBytes, _ := json.Marshal(responseData)
			common.SysError(fmt.Sprintf("[Relay] CLI error response (clove format): StatusCode=%d, Body=%s", newAPIError.StatusCode, string(responseBytes)))
			
			c.JSON(newAPIError.StatusCode, responseData)
		} else {
			// 非 CLI 请求，返回 OpenAI 格式
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			openAIError := newAPIError.ToOpenAIError()
			responseData := gin.H{
				"error": openAIError,
			}
			
			// 记录最终返回给客户端的响应 - 使用 SysError 确保输出
			responseBytes, _ := json.Marshal(responseData)
			common.SysError(fmt.Sprintf("[Relay] Final response to client: StatusCode=%d, Body=%s", newAPIError.StatusCode, string(responseBytes)))
			
			c.JSON(newAPIError.StatusCode, responseData)
		}
	}
}

var upgrader = websocket.Upgrader{
	Subprotocols: []string{"realtime"}, // WS 握手支持的协议，如果有使用 Sec-WebSocket-Protocol，则必须在此声明对应的 Protocol TODO add other protocol
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域
	},
}

func WssRelay(c *gin.Context) {
	// 将 HTTP 连接升级为 WebSocket 连接

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	defer ws.Close()

	if err != nil {
		helper.WssError(c, ws, types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry()).ToOpenAIError())
		return
	}

	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	//wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
	originalModel := c.GetString("original_model")
	var newAPIError *types.NewAPIError

	for i := 0; i <= common.RetryTimes; i++ {
		// 设置重试次数到上下文中
		c.Set("retry_times", fmt.Sprintf("%d", i))
		if i == common.RetryTimes {
			c.Set("is_last", true) // 最后一次重试时设置 is_last 为 true
		} else {
			c.Set("is_last", false) // 其他重试次数设置 is_last 为 false
		}
		
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			newAPIError = err
			break
		}

		newAPIError = wssRequest(c, ws, relayMode, channel)

		if newAPIError == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		if !shouldRetry(c, newAPIError, common.RetryTimes-i) {
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if newAPIError != nil {
		if newAPIError.StatusCode == http.StatusTooManyRequests {
			newAPIError.SetMessage("当前分组上游负载已饱和，请稍后再试")
		} else if newAPIError.GetErrorType() != types.ErrorTypeNewAPIError {
			// 上游错误，根据错误类型决定是否暴露具体信息
			common.LogError(c, fmt.Sprintf("upstream wss error (status %d): %s", newAPIError.StatusCode, newAPIError.Error()))
			errorMessage := newAPIError.Error()
			errorMessageLower := strings.ToLower(errorMessage)
			if strings.Contains(errorMessageLower, "quota") || 
				strings.Contains(errorMessage, "配额") || 
				strings.Contains(errorMessage, "非流") ||
				strings.Contains(errorMessageLower, "poe") || 
				strings.Contains(errorMessageLower, "tenclock") || 
				strings.Contains(errorMessage, "服务超时") ||
				strings.Contains(errorMessage, "额度") || 
				strings.Contains(errorMessageLower, "credit") || 
				strings.Contains(errorMessageLower, "enough") ||
				strings.Contains(errorMessage, "无可用") ||
				strings.Contains(errorMessageLower, "insufficient") ||
				strings.Contains(errorMessageLower, "balance") ||
				strings.Contains(errorMessageLower, "limit") ||
				strings.Contains(errorMessageLower, "exceeded") ||
				strings.Contains(errorMessageLower, "exhausted") {
				newAPIError.SetMessage("当前模型负载较大，请稍后重试，如有任何问题，请联系我们")
			}
			// 非配额相关错误保持原始错误信息
		}
		// 本地错误（ErrorTypeNewAPIError）直接返回原始错误信息
		
		newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
		helper.WssError(c, ws, newAPIError.ToOpenAIError())
	}
}

func RelayClaude(c *gin.Context) {
	//relayMode := constant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	var newAPIError *types.NewAPIError

	for i := 0; i <= common.RetryTimes; i++ {
		// 设置重试次数到上下文中
		c.Set("retry_times", fmt.Sprintf("%d", i))
		if i == common.RetryTimes {
			c.Set("is_last", true) // 最后一次重试时设置 is_last 为 true
		} else {
			c.Set("is_last", false) // 其他重试次数设置 is_last 为 false
		}
		
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			newAPIError = err
			break
		}

		newAPIError = claudeRequest(c, channel)

		if newAPIError == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		if !shouldRetry(c, newAPIError, common.RetryTimes-i) {
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if newAPIError != nil {
		// 检查是否是 Claude Code CLI
		userAgent := c.Request.Header.Get("User-Agent")
		isClaudeCLI := strings.Contains(strings.ToLower(userAgent), "cli")
		
		// 使用 SysError 确保日志输出
		common.SysError(fmt.Sprintf("[RelayClaude] User-Agent: %s, isCLIRequest: %v, ErrorType: %v, StatusCode: %d, Error: %s", 
			userAgent, isClaudeCLI, newAPIError.GetErrorType(), newAPIError.StatusCode, newAPIError.Error()))
		
		if isClaudeCLI {
			// 对于 CLI 请求，总是返回 clove 格式的错误
			errorMessage := newAPIError.Error()
			
			// 确定错误类型
			errorType := "invalid_request_error"
			if newAPIError.StatusCode == http.StatusTooManyRequests {
				errorType = "rate_limit_error"
			} else if newAPIError.StatusCode == http.StatusUnauthorized {
				errorType = "authentication_error"
			} else if newAPIError.StatusCode >= 500 {
				errorType = "api_error"
			}
			
			// 构建 clove 格式的错误响应
			responseData := gin.H{
				"detail": gin.H{
					"code":    503130,
					"message": fmt.Sprintf("HTTP error occurred when calling Claude AI: %s - %s (Status: %d)", errorType, errorMessage, newAPIError.StatusCode),
					"context": gin.H{
						"url":           "https://api.anthropic.com/v1/messages",
						"status_code":   newAPIError.StatusCode,
						"error_type":    errorType,
						"error_message": errorMessage,
					},
				},
			}
			
			// 记录最终返回给客户端的响应
			responseBytes, _ := json.Marshal(responseData)
			common.SysError(fmt.Sprintf("[RelayClaude] CLI error response (clove format): StatusCode=%d, Body=%s", newAPIError.StatusCode, string(responseBytes)))
			
			// 设置正确的 Content-Type
			c.Header("Content-Type", "application/json")
			c.JSON(newAPIError.StatusCode, responseData)
		} else {
			// 非 CLI 请求，构建原有的错误格式
			claudeErr := &types.ClaudeError{
				Message: newAPIError.Error(),
				Type:    "error",
			}
			
			// 处理错误信息（保持原有逻辑）
			if newAPIError.StatusCode == http.StatusTooManyRequests {
				common.LogError(c, fmt.Sprintf("origin 429 error: %s", claudeErr.Message))
				claudeErr.Message = "当前分组上游负载已饱和，请稍后再试"
			} else if newAPIError.GetErrorType() != types.ErrorTypeNewAPIError {
				// 上游错误，根据错误类型决定是否暴露具体信息
				common.LogError(c, fmt.Sprintf("upstream claude error (status %d): %s", newAPIError.StatusCode, claudeErr.Message))
				errorMessageLower := strings.ToLower(claudeErr.Message)
				if strings.Contains(errorMessageLower, "quota") || 
					strings.Contains(claudeErr.Message, "配额") || 
					strings.Contains(claudeErr.Message, "非流") ||
					strings.Contains(errorMessageLower, "poe") || 
					strings.Contains(errorMessageLower, "tenclock") || 
					strings.Contains(claudeErr.Message, "服务超时") ||
					strings.Contains(claudeErr.Message, "额度") || 
					strings.Contains(errorMessageLower, "credit") || 
					strings.Contains(errorMessageLower, "enough") ||
					strings.Contains(claudeErr.Message, "无可用") ||
					strings.Contains(errorMessageLower, "insufficient") ||
					strings.Contains(errorMessageLower, "balance") ||
					strings.Contains(errorMessageLower, "limit") ||
					strings.Contains(errorMessageLower, "exceeded") ||
					strings.Contains(errorMessageLower, "exhausted") {
					claudeErr.Message = "当前模型负载较大，请稍后重试，如有任何问题，请联系我们"
				}
				// 非配额相关错误保持原始错误信息
			}
			// 本地错误（ErrorTypeNewAPIError）直接返回原始错误信息
			
			claudeErr.Message = common.MessageWithRequestId(claudeErr.Message, requestId)
			
			// 返回原有格式
			c.JSON(newAPIError.StatusCode, gin.H{
				"type":  "error",
				"error": claudeErr,
			})
		}
	}
}

func relayRequest(c *gin.Context, relayMode int, channel *model.Channel) *types.NewAPIError {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return relayHandler(c, relayMode)
}

func wssRequest(c *gin.Context, ws *websocket.Conn, relayMode int, channel *model.Channel) *types.NewAPIError {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return relay.WssHelper(c, ws)
}

func claudeRequest(c *gin.Context, channel *model.Channel) *types.NewAPIError {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return relay.ClaudeHelper(c)
}

func addUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}

func getChannel(c *gin.Context, group, originalModel string, retryCount int) (*model.Channel, *types.NewAPIError) {
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
	channel, selectGroup, err := model.CacheGetRandomSatisfiedChannel(c, group, originalModel, retryCount)
	if err != nil {
		return nil, types.NewError(errors.New(fmt.Sprintf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, originalModel, err.Error())), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel == nil {
		return nil, types.NewError(errors.New(fmt.Sprintf("分组 %s 下模型 %s 的可用渠道不存在（数据库一致性已被破坏，retry）", selectGroup, originalModel)), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	newAPIError := middleware.SetupContextForSelectedChannel(c, channel, originalModel)
	if newAPIError != nil {
		return nil, newAPIError
	}
	return channel, nil
}

func shouldRetry(c *gin.Context, openaiErr *types.NewAPIError, retryTimes int) bool {
	if openaiErr == nil {
		return false
	}
	
	// 检查是否是 token 超限错误，如果是则不重试
	errorMessage := openaiErr.Error()
	if strings.Contains(errorMessage, "exceed context limit") && strings.Contains(errorMessage, "max_tokens") {
		common.SysError(fmt.Sprintf("[shouldRetry] Token limit exceeded, not retrying: %s", errorMessage))
		return false
	}
	
	// 检查是否包含 "prompt is too long" 关键字
	if strings.Contains(errorMessage, "prompt is too long") {
		common.SysError(fmt.Sprintf("[shouldRetry] Prompt too long, not retrying: %s", errorMessage))
		return false
	}
	
	if types.IsChannelError(openaiErr) {
		return true
	}
	if types.IsSkipRetryError(openaiErr) {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	if openaiErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if openaiErr.StatusCode == 307 {
		return true
	}
	if openaiErr.StatusCode/100 == 5 {
		// 超时不重试
		if openaiErr.StatusCode == 504 || openaiErr.StatusCode == 524 {
			return false
		}
		return true
	}
	if openaiErr.StatusCode == http.StatusBadRequest {
		channelType := c.GetInt("channel_type")
		if channelType == constant.ChannelTypeAnthropic {
			return true
		}
		return false
	}
	if openaiErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if openaiErr.StatusCode/100 == 2 {
		return false
	}
	return true
}

func processChannelError(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) {
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	common.LogError(c, fmt.Sprintf("relay error (channel #%d, status code: %d): %s", channelError.ChannelId, err.StatusCode, err.Error()))
	if service.ShouldDisableChannel(channelError.ChannelId, err) && channelError.AutoBan {
		service.DisableChannel(channelError, err.Error())
	}
}

func RelayMidjourney(c *gin.Context) {
	relayMode := c.GetInt("relay_mode")
	var err *dto.MidjourneyResponse
	switch relayMode {
	case relayconstant.RelayModeMidjourneyNotify:
		err = relay.RelayMidjourneyNotify(c)
	case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		err = relay.RelayMidjourneyTask(c, relayMode)
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		err = relay.RelayMidjourneyTaskImageSeed(c)
	case relayconstant.RelayModeSwapFace:
		err = relay.RelaySwapFace(c)
	default:
		err = relay.RelayMidjourneySubmit(c, relayMode)
	}
	//err = relayMidjourneySubmit(c, relayMode)
	log.Println(err)
	if err != nil {
		statusCode := http.StatusBadRequest
		if err.Code == 30 {
			err.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		}
		c.JSON(statusCode, gin.H{
			"description": fmt.Sprintf("%s %s", err.Description, err.Result),
			"type":        "upstream_error",
			"code":        err.Code,
		})
		channelId := c.GetInt("channel_id")
		common.LogError(c, fmt.Sprintf("relay error (channel #%d, status code %d): %s", channelId, statusCode, fmt.Sprintf("%s %s", err.Description, err.Result)))
	}
}

func RelayNotImplemented(c *gin.Context) {
	err := dto.OpenAIError{
		Message: "API not implemented",
		Type:    "new_api_error",
		Param:   "",
		Code:    "api_not_implemented",
	}
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": err,
	})
}

func RelayNotFound(c *gin.Context) {
	err := dto.OpenAIError{
		Message: fmt.Sprintf("Invalid URL (%s %s)", c.Request.Method, c.Request.URL.Path),
		Type:    "invalid_request_error",
		Param:   "",
		Code:    "",
	}
	c.JSON(http.StatusNotFound, gin.H{
		"error": err,
	})
}

func RelayTask(c *gin.Context) {
	retryTimes := common.RetryTimes
	channelId := c.GetInt("channel_id")
	relayMode := c.GetInt("relay_mode")
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	c.Set("use_channel", []string{fmt.Sprintf("%d", channelId)})
	taskErr := taskRelayHandler(c, relayMode)
	if taskErr == nil {
		retryTimes = 0
	}
	for i := 0; shouldRetryTaskRelay(c, channelId, taskErr, retryTimes) && i < retryTimes; i++ {
		channel, newAPIError := getChannel(c, group, originalModel, i)
		if newAPIError != nil {
			common.LogError(c, fmt.Sprintf("CacheGetRandomSatisfiedChannel failed: %s", newAPIError.Error()))
			taskErr = service.TaskErrorWrapperLocal(newAPIError.Err, "get_channel_failed", http.StatusInternalServerError)
			break
		}
		channelId = channel.Id
		useChannel := c.GetStringSlice("use_channel")
		useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
		c.Set("use_channel", useChannel)
		common.LogInfo(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, i))
		//middleware.SetupContextForSelectedChannel(c, channel, originalModel)

		requestBody, _ := common.GetRequestBody(c)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		taskErr = taskRelayHandler(c, relayMode)
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}
	if taskErr != nil {
		if taskErr.StatusCode == http.StatusTooManyRequests {
			taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
		}
		c.JSON(taskErr.StatusCode, taskErr)
	}
}

func taskRelayHandler(c *gin.Context, relayMode int) *dto.TaskError {
	var err *dto.TaskError
	switch relayMode {
	case relayconstant.RelayModeSunoFetch, relayconstant.RelayModeSunoFetchByID, relayconstant.RelayModeVideoFetchByID:
		err = relay.RelayTaskFetch(c, relayMode)
	default:
		err = relay.RelayTaskSubmit(c, relayMode)
	}
	return err
}

func shouldRetryTaskRelay(c *gin.Context, channelId int, taskErr *dto.TaskError, retryTimes int) bool {
	if taskErr == nil {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	if taskErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if taskErr.StatusCode == 307 {
		return true
	}
	if taskErr.StatusCode/100 == 5 {
		// 超时不重试
		if taskErr.StatusCode == 504 || taskErr.StatusCode == 524 {
			return false
		}
		return true
	}
	if taskErr.StatusCode == http.StatusBadRequest {
		return false
	}
	if taskErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if taskErr.LocalError {
		return false
	}
	if taskErr.StatusCode/100 == 2 {
		return false
	}
	return true
}
