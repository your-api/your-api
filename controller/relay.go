package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/logger"
	"one-api/middleware"
	"one-api/model"
	"one-api/relay"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"one-api/types"
	"strings"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func relayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		err = relay.ImageHelper(c, info)
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		err = relay.AudioHelper(c, info)
	case relayconstant.RelayModeRerank:
		err = relay.RerankHelper(c, info)
	case relayconstant.RelayModeEmbeddings:
		err = relay.EmbeddingHelper(c, info)
	case relayconstant.RelayModeResponses:
		err = relay.ResponsesHelper(c, info)
	default:
		err = relay.TextHelper(c, info)
	}
	return err
}

func geminiRelayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	if strings.Contains(c.Request.URL.Path, "embed") {
		err = relay.GeminiEmbeddingHandler(c, info)
	} else {
		err = relay.GeminiHelper(c, info)
	}
	return err
}

func Relay(c *gin.Context, relayFormat types.RelayFormat) {
	requestId := c.GetString(common.RequestIdKey)
	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	originalModel := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)

	var (
		newAPIError *types.NewAPIError
		ws          *websocket.Conn
	)

	if relayFormat == types.RelayFormatOpenAIRealtime {
		var err error
		ws, err = upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			helper.WssError(c, ws, types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry()).ToOpenAIError())
			return
		}
		defer ws.Close()
	}

	defer func() {
		if newAPIError != nil {
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			switch relayFormat {
			case types.RelayFormatOpenAIRealtime:
				helper.WssError(c, ws, newAPIError.ToOpenAIError())
			case types.RelayFormatClaude:
				c.JSON(newAPIError.StatusCode, gin.H{
					"type":  "error",
					"error": newAPIError.ToClaudeError(),
				})
			default:
				c.JSON(newAPIError.StatusCode, gin.H{
					"error": newAPIError.ToOpenAIError(),
				})
			}
		}
	}()

	request, err := helper.GetAndValidateRequest(c, relayFormat)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest)
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, request, ws)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}

	meta := request.GetTokenCountMeta()

	if setting.ShouldCheckPromptSensitive() {
		contains, words := service.CheckSensitiveText(meta.CombineText)
		if contains {
			logger.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(words, ", ")))
			newAPIError = types.NewError(err, types.ErrorCodeSensitiveWordsDetected)
			return
		}
	}

	tokens, err := service.CountRequestToken(c, meta, relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeCountTokenFailed)
		return
	}

	relayInfo.SetPromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeModelPriceError)
		return
	}

	// common.SetContextKey(c, constant.ContextKeyTokenCountMeta, meta)

	preConsumedQuota, newAPIError := service.PreConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if newAPIError != nil {
		return
	}

	defer func() {
		// Only return quota if downstream failed and quota was actually pre-consumed
		if newAPIError != nil && preConsumedQuota != 0 {
			service.ReturnPreConsumedQuota(c, relayInfo, preConsumedQuota)
		}
	}()

	for i := 0; i <= common.RetryTimes; i++ {
		// 设置重试次数到上下文中
		c.Set("retry_times", fmt.Sprintf("%d", i))
		if i == common.RetryTimes {
			c.Set("is_last", true) // 最后一次重试时设置 is_last 为 true
		} else {
			c.Set("is_last", false) // 其他重试次数设置 is_last 为 false
		}

		// 重置 client_disconnected 标记，避免影响重试
		if i > 0 {
			c.Set("client_disconnected", false)
			// 清理可能存在的错误状态
			c.Set("error_response", nil)
			// 清理流式响应头部标记，允许重新设置
			c.Set("event_stream_headers_set", nil)
		}

		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			logger.LogError(c, err.Error())
			newAPIError = err
			break
		}

		addUsedChannel(c, channel.Id)
		requestBody, _ := common.GetRequestBody(c)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))

		switch relayFormat {
		case types.RelayFormatOpenAIRealtime:
			newAPIError = relay.WssHelper(c, relayInfo)
		case types.RelayFormatClaude:
			newAPIError = relay.ClaudeHelper(c, relayInfo)
		case types.RelayFormatGemini:
			newAPIError = geminiRelayHandler(c, relayInfo)
		default:
			newAPIError = relayHandler(c, relayInfo)
		}

		if newAPIError == nil {
			return
		}

		processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		if !shouldRetry(c, newAPIError, common.RetryTimes-i) {
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}
}

var upgrader = websocket.Upgrader{
	Subprotocols: []string{"realtime"}, // WS 握手支持的协议，如果有使用 Sec-WebSocket-Protocol，则必须在此声明对应的 Protocol TODO add other protocol
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域
	},
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

	// 直接获取渠道，不检查是否已尝试过
	channel, selectGroup, err := model.CacheGetRandomSatisfiedChannel(c, group, originalModel, retryCount)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, originalModel, err.Error()), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel == nil {
		return nil, types.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在（数据库一致性已被破坏，retry）", selectGroup, originalModel), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
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

	// 检查是否是 Claude Code CLI
	userAgent := c.Request.Header.Get("User-Agent")
	isClaudeCLI := strings.Contains(strings.ToLower(userAgent), "cli")

	if isClaudeCLI && openaiErr.GetErrorCode() == "api_error" && openaiErr.StatusCode == 400 {
		return false
	}

	// 检查是否是 token 超限错误，如果是则不重试
	//errorMessage := openaiErr.Error()
	//if (strings.Contains(errorMessage, "exceed context limit") && strings.Contains(errorMessage, "max_tokens")) ||
	//	strings.Contains(errorMessage, "input length and max_tokens exceed context limit") {
	//	common.SysError(fmt.Sprintf("[shouldRetry] Token limit exceeded, not retrying: %s", errorMessage))
	//	return false
	//}

	//if strings.Contains(errorMessage, "refuse to produce response") {
	//	return false
	//}

	// 检查是否包含 "prompt is too long" 关键字
	//if strings.Contains(errorMessage, "prompt is too long") {
	//	common.SysError(fmt.Sprintf("[shouldRetry] Prompt too long, not retrying: %s", errorMessage))
	//	return false
	//}

	if types.IsChannelError(openaiErr) {
		return true
	}
	//if types.IsSkipRetryError(openaiErr) {
	//	return false
	//}
	if retryTimes <= 0 {
		return false
	}
	//if _, ok := c.Get("specific_channel_id"); ok {
	//	return false
	//}
	// 2xx 成功响应不重试
	if openaiErr.StatusCode/100 == 2 {
		return false
	}

	// 4xx 错误都重试（除非已被标记为 SkipRetry）
	// 这样可以尝试其他渠道，因为不同渠道可能有不同的限制
	if openaiErr.StatusCode/100 == 4 {
		return true
	}

	// 5xx 服务器错误重试
	if openaiErr.StatusCode/100 == 5 {
		return true
	}
	
	if openaiErr.StatusCode == http.StatusBadRequest {
		return false
	}
	if openaiErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if openaiErr.StatusCode/100 == 2 {
		return false
	}

	// 3xx 重定向重试
	if openaiErr.StatusCode/100 == 3 {
		return true
	}

	// 其他情况默认重试
	return true
}

func processChannelError(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) {
	logger.LogError(c, fmt.Sprintf("relay error (channel #%d, status code: %d): %s", channelError.ChannelId, err.StatusCode, err.Error()))

	gopool.Go(func() {
		// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
		// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
		if service.ShouldDisableChannel(channelError.ChannelId, err) && channelError.AutoBan {
			service.DisableChannel(channelError, err.Error())
		}
	})

	if constant.ErrorLogEnabled && types.IsRecordErrorLog(err) {
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
		model.RecordErrorLog(c, userId, channelId, modelName, tokenName, err.MaskSensitiveError(), tokenId, 0, false, userGroup, other)
	}

}

func RelayMidjourney(c *gin.Context) {
	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatMjProxy, nil, nil)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"description": fmt.Sprintf("failed to generate relay info: %s", err.Error()),
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}

	var mjErr *dto.MidjourneyResponse
	switch relayInfo.RelayMode {
	case relayconstant.RelayModeMidjourneyNotify:
		mjErr = relay.RelayMidjourneyNotify(c)
	case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		mjErr = relay.RelayMidjourneyTask(c, relayInfo.RelayMode)
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		mjErr = relay.RelayMidjourneyTaskImageSeed(c)
	case relayconstant.RelayModeSwapFace:
		mjErr = relay.RelaySwapFace(c, relayInfo)
	default:
		mjErr = relay.RelayMidjourneySubmit(c, relayInfo)
	}
	//err = relayMidjourneySubmit(c, relayMode)
	log.Println(mjErr)
	if mjErr != nil {
		statusCode := http.StatusBadRequest
		if mjErr.Code == 30 {
			mjErr.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		}
		c.JSON(statusCode, gin.H{
			"description": fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result),
			"type":        "upstream_error",
			"code":        mjErr.Code,
		})
		channelId := c.GetInt("channel_id")
		logger.LogError(c, fmt.Sprintf("relay error (channel #%d, status code %d): %s", channelId, statusCode, fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result)))
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
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	c.Set("use_channel", []string{fmt.Sprintf("%d", channelId)})

	// 收集所有错误
	var allErrors []*dto.TaskError

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		return
	}
	taskErr := taskRelayHandler(c, relayInfo)
	if taskErr != nil {
		allErrors = append(allErrors, taskErr)
	} else {
		retryTimes = 0
	}

	for i := 0; shouldRetryTaskRelay(c, channelId, taskErr, retryTimes) && i < retryTimes; i++ {
		channel, newAPIError := getChannel(c, group, originalModel, i)
		if newAPIError != nil {
			logger.LogError(c, fmt.Sprintf("CacheGetRandomSatisfiedChannel failed: %s", newAPIError.Error()))
			taskErr = service.TaskErrorWrapperLocal(newAPIError.Err, "get_channel_failed", http.StatusInternalServerError)
			allErrors = append(allErrors, taskErr)
			break
		}
		channelId = channel.Id
		useChannel := c.GetStringSlice("use_channel")
		useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
		c.Set("use_channel", useChannel)
		logger.LogInfo(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, i))
		//middleware.SetupContextForSelectedChannel(c, channel, originalModel)

		requestBody, _ := common.GetRequestBody(c)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		taskErr = taskRelayHandler(c, relayInfo)
		if taskErr != nil {
			allErrors = append(allErrors, taskErr)
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}

	if taskErr != nil {
		// 根据优先级选择错误
		finalErr := selectPriorityError(allErrors)
		c.JSON(finalErr.StatusCode, finalErr)
	}
}

func taskRelayHandler(c *gin.Context, relayInfo *relaycommon.RelayInfo) *dto.TaskError {
	var err *dto.TaskError
	switch relayInfo.RelayMode {
	case relayconstant.RelayModeSunoFetch, relayconstant.RelayModeSunoFetchByID, relayconstant.RelayModeVideoFetchByID:
		err = relay.RelayTaskFetch(c, relayInfo.RelayMode)
	default:
		err = relay.RelayTaskSubmit(c, relayInfo)
	}
	return err
}

func shouldRetryTaskRelay(c *gin.Context, _ int, taskErr *dto.TaskError, retryTimes int) bool {
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

// selectPriorityError 根据优先级选择要返回的错误
// 优先级：
// 1. 不包含负载关键词且不包含敏感词的错误
// 2. 默认返回通用错误信息
func selectPriorityError(errors []*dto.TaskError) *dto.TaskError {
	if len(errors) == 0 {
		return nil
	}

	// 查找不包含负载关键词且不包含敏感词的错误
	for _, err := range errors {
		if err == nil {
			continue
		}

		if !containsLoadKeywords(err.Message) && !containsSensitiveKeywords(err.Message) {
			return err
		}
	}

	// 如果所有错误都包含负载关键词或敏感词，返回通用错误信息
	finalErr := errors[len(errors)-1]
	finalErr.Message = "当前模型负载较大或请求参数有误，请稍后重试，如有任何问题，请联系我们"
	return finalErr
}

// containsLoadKeywords 检查消息是否包含负载相关关键词
func containsLoadKeywords(message string) bool {
	lowerMsg := strings.ToLower(message)
	return strings.Contains(lowerMsg, "负载") ||
		strings.Contains(lowerMsg, "load") ||
		strings.Contains(lowerMsg, "rate limit") ||
		strings.Contains(lowerMsg, "too many requests") ||
		strings.Contains(lowerMsg, "429")
}

// containsSensitiveKeywords 检查消息是否包含敏感关键词
func containsSensitiveKeywords(message string) bool {
	lowerMsg := strings.ToLower(message)
	return strings.Contains(lowerMsg, "quota") ||
		strings.Contains(message, "配额") ||
		strings.Contains(message, "无可用") ||
		strings.Contains(lowerMsg, "poe") ||
		strings.Contains(message, "额度") ||
		strings.Contains(lowerMsg, "credit") ||
		strings.Contains(lowerMsg, "points") ||
		strings.Contains(lowerMsg, "enough") ||
		strings.Contains(lowerMsg, "insufficient") ||
		strings.Contains(lowerMsg, "balance") ||
		strings.Contains(lowerMsg, "limit") ||
		strings.Contains(lowerMsg, "exceeded") ||
		strings.Contains(lowerMsg, "exhausted") ||
		strings.Contains(message, "非流") ||
		strings.Contains(lowerMsg, "tenclock") ||
		strings.Contains(message, "服务超时")
}
