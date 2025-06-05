package controller

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	constant2 "one-api/constant"
	"one-api/dto"
	"one-api/middleware"
	"one-api/model"
	"one-api/relay"
	"one-api/relay/constant"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func relayHandler(c *gin.Context, relayMode int) *dto.OpenAIErrorWithStatusCode {
	var err *dto.OpenAIErrorWithStatusCode

	// 检查chat/completions请求的空内容
	if relayMode == relayconstant.RelayModeChatCompletions {
		var requestBody struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			Stream bool `json:"stream"`
		}

		rawBody, _ := common.GetRequestBody(c)
		if err := json.Unmarshal(rawBody, &requestBody); err == nil {
			if len(requestBody.Messages) > 0 && requestBody.Messages[len(requestBody.Messages)-1].Content == "" {
				return &dto.OpenAIErrorWithStatusCode{
					Error: dto.OpenAIError{
						Message: "消息内容不能为空",
						Type:    "invalid_request_error",
						Code:    "content_empty",
					},
					StatusCode: http.StatusBadRequest,
					LocalError: true,
				}
			}
		}
		// 重置请求体
		c.Request.Body = io.NopCloser(bytes.NewBuffer(rawBody))
	}

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
	default:
		err = relay.TextHelper(c)
	}

	if constant2.ErrorLogEnabled && err != nil {
		// 保存错误日志到mysql中
		userId := c.GetInt("id")
		tokenName := c.GetString("token_name")
		modelName := c.GetString("original_model")
		tokenId := c.GetInt("token_id")
		userGroup := c.GetString("group")
		channelId := c.GetInt("channel_id")
		channelType := c.GetInt("channel_type")

		// 记录原始错误信息到日志
		originalMessage := err.Error.Message
		originalType := err.Error.Type
		originalCode := err.Error.Code

		// 记录原始错误到日志，便于调试
		if !err.LocalError {
			common.LogError(c, fmt.Sprintf("upstream error (channel #%d): %s", channelId, originalMessage))
		}

		other := make(map[string]interface{})
		other["error_type"] = err.Error.Type
		other["error_code"] = err.Error.Code
		other["status_code"] = err.StatusCode
		other["channel_id"] = channelId
		other["channel_name"] = c.GetString("channel_name")
		other["channel_type"] = channelType

		// 保存原始错误信息到other字段，方便排查问题
		if !err.LocalError {
			other["original_error_message"] = originalMessage
			other["original_error_type"] = originalType
			other["original_error_code"] = originalCode
		}

		model.RecordErrorLog(c, userId, channelId, modelName, tokenName, err.Error.Message, tokenId, 0, false, userGroup, other)
	}

	return err
}

func Relay(c *gin.Context) {
	relayMode := constant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)

	// 检查chat/completions请求的空内容
	if relayMode == relayconstant.RelayModeChatCompletions {
		requestBody, _ := common.GetRequestBody(c)
		var chatRequest struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			Stream bool `json:"stream"`
		}

		if err := json.Unmarshal(requestBody, &chatRequest); err == nil {
			if len(chatRequest.Messages) > 0 && chatRequest.Messages[len(chatRequest.Messages)-1].Content == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": dto.OpenAIError{
						Message: "消息内容不能为空",
						Type:    "invalid_request_error",
						Code:    "content_empty",
					},
				})
				return
			}
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	}

	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	var openaiErr *dto.OpenAIErrorWithStatusCode

	// 使用新的重试配置，支持更多重试次数和循环重试
	maxRetryTimes := common.GetEffectiveMaxRetryTimes()

	for i := 0; i <= maxRetryTimes; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			openaiErr = service.OpenAIErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}

		openaiErr = relayRequest(c, relayMode, channel)

		if openaiErr == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		if !shouldRetry(c, openaiErr, maxRetryTimes-i) {
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if openaiErr != nil {
		// 对于所有非本地错误，统一返回友好错误信息，避免泄露上游错误详情
		if !openaiErr.LocalError {
			// 记录原始错误用于调试
			common.LogError(c, fmt.Sprintf("upstream service error: %s", openaiErr.Error.Message))

			// 根据状态码返回不同的友好错误信息
			if openaiErr.StatusCode == http.StatusTooManyRequests {
				openaiErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
			} else if openaiErr.StatusCode == http.StatusUnauthorized {
				openaiErr.Error.Message = "认证失败，请检查API密钥"
			} else if openaiErr.StatusCode == http.StatusForbidden {
				openaiErr.Error.Message = "访问被拒绝，请检查权限设置"
			} else if openaiErr.StatusCode/100 == 5 {
				openaiErr.Error.Message = "上游服务暂时不可用，请稍后重试"
			} else {
				openaiErr.Error.Message = "当前渠道由于负载较大，暂不可用，请稍后重试"
			}

			openaiErr.Error.Type = "service_unavailable"
			openaiErr.Error.Code = "upstream_error"
		}

		openaiErr.Error.Message = common.MessageWithRequestId(openaiErr.Error.Message, requestId)
		c.JSON(openaiErr.StatusCode, gin.H{
			"error": openaiErr.Error,
		})
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
		openaiErr := service.OpenAIErrorWrapper(err, "get_channel_failed", http.StatusInternalServerError)
		helper.WssError(c, ws, openaiErr.Error)
		return
	}

	relayMode := constant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	//wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
	originalModel := c.GetString("original_model")
	var openaiErr *dto.OpenAIErrorWithStatusCode

	// 使用新的重试配置，支持更多重试次数和循环重试
	maxRetryTimes := common.GetEffectiveMaxRetryTimes()

	for i := 0; i <= maxRetryTimes; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			openaiErr = service.OpenAIErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}

		openaiErr = wssRequest(c, ws, relayMode, channel)

		if openaiErr == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		if !shouldRetry(c, openaiErr, maxRetryTimes-i) {
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if openaiErr != nil {
		// 对于所有非本地错误，统一返回友好错误信息，避免泄露上游错误详情
		if !openaiErr.LocalError {
			// 记录原始错误用于调试
			common.LogError(c, fmt.Sprintf("upstream websocket error: %s", openaiErr.Error.Message))

			// 根据状态码返回不同的友好错误信息
			if openaiErr.StatusCode == http.StatusTooManyRequests {
				openaiErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
			} else if openaiErr.StatusCode == http.StatusUnauthorized {
				openaiErr.Error.Message = "认证失败，请检查API密钥"
			} else if openaiErr.StatusCode == http.StatusForbidden {
				openaiErr.Error.Message = "访问被拒绝，请检查权限设置"
			} else if openaiErr.StatusCode/100 == 5 {
				openaiErr.Error.Message = "上游服务暂时不可用，请稍后重试"
			} else {
				openaiErr.Error.Message = "当前渠道由于负载较大，暂不可用，请稍后重试"
			}

			openaiErr.Error.Type = "service_unavailable"
			openaiErr.Error.Code = "upstream_error"
		}

		openaiErr.Error.Message = common.MessageWithRequestId(openaiErr.Error.Message, requestId)
		helper.WssError(c, ws, openaiErr.Error)
	}
}

func RelayClaude(c *gin.Context) {
	//relayMode := constant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	var claudeErr *dto.ClaudeErrorWithStatusCode

	// 使用新的重试配置，支持更多重试次数和循环重试
	maxRetryTimes := common.GetEffectiveMaxRetryTimes()

	for i := 0; i <= maxRetryTimes; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			claudeErr = service.ClaudeErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}

		claudeErr = claudeRequest(c, channel)

		if claudeErr == nil {
			return // 成功处理请求，直接返回
		}

		openaiErr := service.ClaudeErrorToOpenAIError(claudeErr)

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		if !shouldRetry(c, openaiErr, maxRetryTimes-i) {
			break
		}
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if claudeErr != nil {
		// 对于所有非本地错误，统一返回友好错误信息，避免泄露上游错误详情
		if !claudeErr.LocalError {
			// 记录原始错误用于调试
			common.LogError(c, fmt.Sprintf("upstream claude error: %s", claudeErr.Error.Message))

			// 根据状态码返回不同的友好错误信息
			if claudeErr.StatusCode == http.StatusTooManyRequests {
				claudeErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
			} else if claudeErr.StatusCode == http.StatusUnauthorized {
				claudeErr.Error.Message = "认证失败，请检查API密钥"
			} else if claudeErr.StatusCode == http.StatusForbidden {
				claudeErr.Error.Message = "访问被拒绝，请检查权限设置"
			} else if claudeErr.StatusCode/100 == 5 {
				claudeErr.Error.Message = "上游服务暂时不可用，请稍后重试"
			} else {
				claudeErr.Error.Message = "当前渠道由于负载较大，暂不可用，请稍后重试"
			}

			claudeErr.Error.Type = "service_unavailable"
		}

		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"type":  "error",
			"error": claudeErr.Error,
		})
	}
}

func relayRequest(c *gin.Context, relayMode int, channel *model.Channel) *dto.OpenAIErrorWithStatusCode {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)

	// 检查chat/completions请求的空内容
	if relayMode == relayconstant.RelayModeChatCompletions {
		var chatRequest struct {
			Model    string `json:"model"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
			Stream bool `json:"stream"`
		}

		if err := json.Unmarshal(requestBody, &chatRequest); err == nil {
			if len(chatRequest.Messages) > 0 && chatRequest.Messages[len(chatRequest.Messages)-1].Content == "" {
				return &dto.OpenAIErrorWithStatusCode{
					Error: dto.OpenAIError{
						Message: "消息内容不能为空",
						Type:    "invalid_request_error",
						Code:    "content_empty",
					},
					StatusCode: http.StatusBadRequest,
					LocalError: true,
				}
			}
		}
	}

	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return relayHandler(c, relayMode)
}

func wssRequest(c *gin.Context, ws *websocket.Conn, relayMode int, channel *model.Channel) *dto.OpenAIErrorWithStatusCode {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	return relay.WssHelper(c, ws)
}

func claudeRequest(c *gin.Context, channel *model.Channel) *dto.ClaudeErrorWithStatusCode {
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
	middleware.SetupContextForSelectedChannel(c, channel, originalModel)
	return channel, nil
}

func shouldRetry(c *gin.Context, openaiErr *dto.OpenAIErrorWithStatusCode, retryTimes int) bool {
	if openaiErr == nil {
		return false
	}
	if openaiErr.LocalError {
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
		if channelType == common.ChannelTypeAnthropic {
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

func processChannelError(c *gin.Context, channelId int, channelType int, channelName string, autoBan bool, err *dto.OpenAIErrorWithStatusCode) {
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	common.LogError(c, fmt.Sprintf("relay error (channel #%d, status code: %d): %s", channelId, err.StatusCode, err.Error.Message))
	if service.ShouldDisableChannel(channelType, err) && autoBan {
		service.DisableChannel(channelId, channelName, err.Error.Message)
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
	if err != nil {
		// 记录原始错误用于调试
		common.LogError(c, fmt.Sprintf("upstream midjourney error (code: %d): %s %s", err.Code, err.Description, err.Result))

		statusCode := http.StatusBadRequest

		// 根据错误代码返回不同的友好错误信息，不暴露具体的上游错误
		if err.Code == 30 {
			err.Description = "服务负载"
			err.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		} else {
			// 对于其他错误，返回通用错误信息
			err.Description = "服务暂时不可用"
			err.Result = "当前渠道由于负载较大，暂不可用，请稍后重试"
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
	// 使用新的重试配置，支持更多重试次数和循环重试
	retryTimes := common.GetEffectiveMaxRetryTimes()

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
		channel, err := model.CacheGetRandomSatisfiedChannel(group, originalModel, i)
		if err != nil {
			common.LogError(c, fmt.Sprintf("CacheGetRandomSatisfiedChannel failed: %s", err.Error()))
			break
		}
		channelId = channel.Id
		useChannel := c.GetStringSlice("use_channel")
		useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
		c.Set("use_channel", useChannel)
		common.LogInfo(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, i))
		middleware.SetupContextForSelectedChannel(c, channel, originalModel)

		requestBody, err := common.GetRequestBody(c)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		taskErr = taskRelayHandler(c, relayMode)
	}
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}
	if taskErr != nil {
		// 对于所有非本地错误，统一返回友好错误信息，避免泄露上游错误详情
		if !taskErr.LocalError {
			// 记录原始错误用于调试
			common.LogError(c, fmt.Sprintf("upstream task error (code: %s): %s",
				taskErr.Code, taskErr.Message))

			// 根据状态码返回不同的友好错误信息
			if taskErr.StatusCode == http.StatusTooManyRequests {
				taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
			} else if taskErr.StatusCode == http.StatusUnauthorized {
				taskErr.Message = "认证失败，请检查API密钥"
			} else if taskErr.StatusCode == http.StatusForbidden {
				taskErr.Message = "访问被拒绝，请检查权限设置"
			} else if taskErr.StatusCode/100 == 5 {
				taskErr.Message = "上游服务暂时不可用，请稍后重试"
			} else {
				taskErr.Message = "当前渠道由于负载较大，暂不可用，请稍后重试"
			}

			taskErr.Code = "upstream_error"
		}

		c.JSON(taskErr.StatusCode, taskErr)
	}
}

func taskRelayHandler(c *gin.Context, relayMode int) *dto.TaskError {
	var err *dto.TaskError
	switch relayMode {
	case relayconstant.RelayModeSunoFetch, relayconstant.RelayModeSunoFetchByID:
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
