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
	constant2 "one-api/constant"
	"one-api/dto"
	"one-api/middleware"
	"one-api/model"
	"one-api/relay"
	"one-api/relay/constant"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"strings"
	"time"

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
		other := make(map[string]interface{})
		other["error_type"] = err.Error.Type
		other["error_code"] = err.Error.Code
		other["status_code"] = err.StatusCode
		other["channel_id"] = channelId
		other["channel_name"] = c.GetString("channel_name")
		other["channel_type"] = c.GetInt("channel_type")

		model.RecordErrorLogDouble(c, userId, channelId, modelName, tokenName, err.Error.Message, err.UpstreamErrorInfo.Message, tokenId, 0, false, userGroup, other)
	}

	return err
}

func Relay(c *gin.Context) {
	relayMode := constant.Path2RelayMode(c.Request.URL.Path)
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	var openaiErr *dto.OpenAIErrorWithStatusCode

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
			openaiErr = service.OpenAIErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}

		// 记录重试信息（使用异步日志）
		if i > 0 {
			common.LogInfoAsync(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, maxRetries-i))
		}

		openaiErr = relayRequest(c, relayMode, channel)

		if openaiErr == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		//if !shouldRetry(c, openaiErr, maxRetries-i) {
		//	break
		//}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if openaiErr != nil {
		if openaiErr.StatusCode == http.StatusTooManyRequests {
			common.LogError(c, fmt.Sprintf("origin 429 error: %s", openaiErr.Error.Message))
			openaiErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		} else if !openaiErr.LocalError {
			// 上游错误，根据错误类型决定是否暴露具体信息
			common.LogError(c, fmt.Sprintf("upstream error (status %d): %s", openaiErr.StatusCode, openaiErr.Error.Message))
			if strings.Contains(openaiErr.Error.Message, "quota") || strings.Contains(openaiErr.Error.Message, "配额") ||
				strings.Contains(openaiErr.Error.Message, "额度") || strings.Contains(openaiErr.Error.Message, "credit") || strings.Contains(openaiErr.Error.Message, "enough") {
				openaiErr.Error.Message = "当前模型负载较大，请稍后重试，如有任何问题，请联系我们"
			}
			// 非配额相关错误保持原始错误信息
		}
		// 本地错误（LocalError为true）直接返回原始错误信息

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

	// 使用新的重试配置
	maxRetries := common.GetEffectiveMaxRetryTimes()

	for i := 0; i <= maxRetries; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			openaiErr = service.OpenAIErrorWrapperLocal(err, "get_channel_failed", http.StatusInternalServerError)
			break
		}

		// 记录重试信息（使用异步日志）
		if i > 0 {
			common.LogInfoAsync(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, maxRetries-i))
		}

		openaiErr = wssRequest(c, ws, relayMode, channel)

		if openaiErr == nil {
			return // 成功处理请求，直接返回
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		//if !shouldRetry(c, openaiErr, maxRetries-i) {
		//	break
		//}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if openaiErr != nil {
		if openaiErr.StatusCode == http.StatusTooManyRequests {
			openaiErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		} else if !openaiErr.LocalError {
			// 上游错误，根据错误类型决定是否暴露具体信息
			common.LogError(c, fmt.Sprintf("upstream wss error (status %d): %s", openaiErr.StatusCode, openaiErr.Error.Message))
			if strings.Contains(openaiErr.Error.Message, "quota") || strings.Contains(openaiErr.Error.Message, "配额") ||
				strings.Contains(openaiErr.Error.Message, "额度") || strings.Contains(openaiErr.Error.Message, "credit") || strings.Contains(openaiErr.Error.Message, "enough") {
				openaiErr.Error.Message = "当前模型负载较大，请稍后重试，如有任何问题，请联系我们"
			}
			// 非配额相关错误保持原始错误信息
		}
		// 本地错误（LocalError为true）直接返回原始错误信息

		openaiErr.Error.Message = common.MessageWithRequestId(openaiErr.Error.Message, requestId)
		helper.WssError(c, ws, openaiErr.Error)
	}
}

func RelayClaude(c *gin.Context) {
	requestId := c.GetString(common.RequestIdKey)
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	var claudeErr *dto.ClaudeErrorWithStatusCode

	// 使用新的重试配置
	maxRetries := common.GetEffectiveMaxRetryTimes()

	for i := 0; i <= maxRetries; i++ {
		channel, err := getChannel(c, group, originalModel, i)
		if err != nil {
			common.LogError(c, err.Error())
			claudeErr = &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("获取渠道失败: %s", err.Error()),
				},
				StatusCode: http.StatusInternalServerError,
			}
			break
		}

		// 记录重试信息（使用异步日志）
		if i > 0 {
			common.LogInfoAsync(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, maxRetries-i))
		}

		claudeErr = claudeRequest(c, channel)

		if claudeErr == nil {
			return // 成功处理请求，直接返回
		}

		// 转换为OpenAIError进行处理
		openaiErr := &dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: claudeErr.Error.Message,
				Type:    "claude_error",
			},
			StatusCode: claudeErr.StatusCode,
		}

		go processChannelError(c, channel.Id, channel.Type, channel.Name, channel.GetAutoBan(), openaiErr)

		//if !shouldRetry(c, openaiErr, maxRetries-i) {
		//	break
		//}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		common.LogInfo(c, retryLogStr)
	}

	if claudeErr != nil {
		if claudeErr.StatusCode == http.StatusTooManyRequests {
			common.LogError(c, fmt.Sprintf("origin 429 error: %s", claudeErr.Error.Message))
			claudeErr.Error.Message = "当前分组上游负载已饱和，请稍后再试"
		} else if !claudeErr.LocalError {
			// 上游错误，根据错误类型决定是否暴露具体信息
			common.LogError(c, fmt.Sprintf("upstream claude error (status %d): %s", claudeErr.StatusCode, claudeErr.Error.Message))
			if strings.Contains(claudeErr.Error.Message, "quota") || strings.Contains(claudeErr.Error.Message, "配额") ||
				strings.Contains(claudeErr.Error.Message, "额度") || strings.Contains(claudeErr.Error.Message, "credit") || strings.Contains(claudeErr.Error.Message, "enough") {
				claudeErr.Error.Message = "当前模型负载较大，请稍后重试，如有任何问题，请联系我们"
			}
			// 非配额相关错误保持原始错误信息
		}
		// 本地错误（LocalError为true）直接返回原始错误信息

		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
	}
}

func RelayClaudeK2(c *gin.Context) {
	// 获取原始请求体并修改模型名称
	rawBody, err := common.GetRequestBody(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("获取请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的请求",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 解析 JSON 以修改模型名称
	var requestBody map[string]interface{}
	if err := json.Unmarshal(rawBody, &requestBody); err != nil {
		common.LogError(c, fmt.Sprintf("解析请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的JSON格式",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 强制设置模型为 cc:claude-code
	targetModel := "cc:k2"
	requestBody["model"] = targetModel

	// 重新序列化请求体
	modifiedBody, err := json.Marshal(requestBody)
	if err != nil {
		common.LogError(c, fmt.Sprintf("序列化请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "处理请求失败",
			},
			StatusCode: http.StatusInternalServerError,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 重置请求体
	c.Request.Body = io.NopCloser(bytes.NewBuffer(modifiedBody))

	// 手动设置渠道相关信息（模拟 Distribute 中间件的行为）
	// 获取用户基础分组（通过TokenAuth中间件已设置）
	userGroup := c.GetString(constant2.ContextKeyUserGroup)
	if userGroup == "" {
		// 如果从上下文中获取不到，尝试从用户缓存中重新获取
		userId := c.GetInt("id")
		if userId > 0 {
			if userCache, cacheErr := model.GetUserCache(userId); cacheErr == nil {
				userGroup = userCache.Group
			}
		}
		// 如果仍然为空，使用默认分组
		if userGroup == "" {
			userGroup = "default"
		}
	}

	// 获取令牌分组
	tokenGroup := c.GetString("token_group")

	if tokenGroup != "" {
		// 检查用户是否可以使用这个令牌分组
		if _, ok := setting.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("令牌分组 %s 已被禁用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		// 检查分组是否存在于分组比例中
		if !setting.ContainsGroupRatio(tokenGroup) {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("分组 %s 已被弃用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		userGroup = tokenGroup
	}

	group := userGroup
	c.Set("group", group)

	// 添加调试信息
	//groupRatio := setting.GetGroupRatio(group)
	//common.LogInfo(c, fmt.Sprintf("K2 Debug - 最终使用分组: %s, 分组倍率: %.2f, 目标模型: %s", group, groupRatio, targetModel))

	// 检查令牌模型限制
	modelLimitEnable := c.GetBool("token_model_limit_enabled")
	if modelLimitEnable {
		s, ok := c.Get("token_model_limit")
		var tokenModelLimit map[string]bool
		if ok {
			tokenModelLimit = s.(map[string]bool)
		} else {
			tokenModelLimit = map[string]bool{}
		}
		if tokenModelLimit != nil {
			if _, ok := tokenModelLimit[targetModel]; !ok {
				claudeErr := &dto.ClaudeErrorWithStatusCode{
					Error: dto.ClaudeError{
						Message: fmt.Sprintf("该令牌无权访问模型 %s", targetModel),
					},
					StatusCode: http.StatusForbidden,
				}
				requestId := c.GetString(common.RequestIdKey)
				claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
				c.JSON(claudeErr.StatusCode, gin.H{
					"error": claudeErr.Error,
				})
				return
			}
		} else {
			// token model limit is empty, all models are not allowed
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: "该令牌无权访问任何模型",
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
	}

	// 选择适合目标模型的渠道
	channel, err := model.CacheGetRandomSatisfiedChannel(group, targetModel, 0)
	if err != nil {
		common.LogError(c, err.Error())
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", group, targetModel),
			},
			StatusCode: http.StatusServiceUnavailable,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 设置请求开始时间（模拟 Distribute 中间件的行为）
	c.Set(constant2.ContextKeyRequestStartTime, time.Now())

	// 设置渠道相关的上下文信息
	middleware.SetupContextForSelectedChannel(c, channel, targetModel)

	// 调用原有的 Claude 处理逻辑
	RelayClaude(c)
}

func RelayClaudeC2(c *gin.Context) {
	// 获取原始请求体并修改模型名称
	rawBody, err := common.GetRequestBody(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("获取请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的请求",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 解析 JSON 以修改模型名称
	var requestBody map[string]interface{}
	if err := json.Unmarshal(rawBody, &requestBody); err != nil {
		common.LogError(c, fmt.Sprintf("解析请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的JSON格式",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 强制设置模型为 cc:claude-code
	targetModel := "cc:claude-neptune-v3"
	requestBody["model"] = targetModel

	// 重新序列化请求体
	modifiedBody, err := json.Marshal(requestBody)
	if err != nil {
		common.LogError(c, fmt.Sprintf("序列化请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "处理请求失败",
			},
			StatusCode: http.StatusInternalServerError,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 重置请求体
	c.Request.Body = io.NopCloser(bytes.NewBuffer(modifiedBody))

	// 手动设置渠道相关信息（模拟 Distribute 中间件的行为）
	// 获取用户基础分组（通过TokenAuth中间件已设置）
	userGroup := c.GetString(constant2.ContextKeyUserGroup)
	if userGroup == "" {
		// 如果从上下文中获取不到，尝试从用户缓存中重新获取
		userId := c.GetInt("id")
		if userId > 0 {
			if userCache, cacheErr := model.GetUserCache(userId); cacheErr == nil {
				userGroup = userCache.Group
			}
		}
		// 如果仍然为空，使用默认分组
		if userGroup == "" {
			userGroup = "default"
		}
	}

	// 获取令牌分组
	tokenGroup := c.GetString("token_group")

	if tokenGroup != "" {
		// 检查用户是否可以使用这个令牌分组
		if _, ok := setting.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("令牌分组 %s 已被禁用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		// 检查分组是否存在于分组比例中
		if !setting.ContainsGroupRatio(tokenGroup) {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("分组 %s 已被弃用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		userGroup = tokenGroup
	}

	group := userGroup
	c.Set("group", group)

	// 添加调试信息
	//groupRatio := setting.GetGroupRatio(group)
	//common.LogInfo(c, fmt.Sprintf("K2 Debug - 最终使用分组: %s, 分组倍率: %.2f, 目标模型: %s", group, groupRatio, targetModel))

	// 检查令牌模型限制
	modelLimitEnable := c.GetBool("token_model_limit_enabled")
	if modelLimitEnable {
		s, ok := c.Get("token_model_limit")
		var tokenModelLimit map[string]bool
		if ok {
			tokenModelLimit = s.(map[string]bool)
		} else {
			tokenModelLimit = map[string]bool{}
		}
		if tokenModelLimit != nil {
			if _, ok := tokenModelLimit[targetModel]; !ok {
				claudeErr := &dto.ClaudeErrorWithStatusCode{
					Error: dto.ClaudeError{
						Message: fmt.Sprintf("该令牌无权访问模型 %s", targetModel),
					},
					StatusCode: http.StatusForbidden,
				}
				requestId := c.GetString(common.RequestIdKey)
				claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
				c.JSON(claudeErr.StatusCode, gin.H{
					"error": claudeErr.Error,
				})
				return
			}
		} else {
			// token model limit is empty, all models are not allowed
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: "该令牌无权访问任何模型",
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
	}

	// 选择适合目标模型的渠道
	channel, err := model.CacheGetRandomSatisfiedChannel(group, targetModel, 0)
	if err != nil {
		common.LogError(c, err.Error())
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", group, targetModel),
			},
			StatusCode: http.StatusServiceUnavailable,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 设置请求开始时间（模拟 Distribute 中间件的行为）
	c.Set(constant2.ContextKeyRequestStartTime, time.Now())

	// 设置渠道相关的上下文信息
	middleware.SetupContextForSelectedChannel(c, channel, targetModel)

	// 调用原有的 Claude 处理逻辑
	RelayClaude(c)
}

func RelayClaudeQwen(c *gin.Context) {
	// 获取原始请求体并修改模型名称
	rawBody, err := common.GetRequestBody(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("获取请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的请求",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 解析 JSON 以修改模型名称
	var requestBody map[string]interface{}
	if err := json.Unmarshal(rawBody, &requestBody); err != nil {
		common.LogError(c, fmt.Sprintf("解析请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的JSON格式",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 强制设置模型为 cc:claude-code
	targetModel := "cc:qwen"
	requestBody["model"] = targetModel

	// 重新序列化请求体
	modifiedBody, err := json.Marshal(requestBody)
	if err != nil {
		common.LogError(c, fmt.Sprintf("序列化请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "处理请求失败",
			},
			StatusCode: http.StatusInternalServerError,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 重置请求体
	c.Request.Body = io.NopCloser(bytes.NewBuffer(modifiedBody))

	// 手动设置渠道相关信息（模拟 Distribute 中间件的行为）
	// 获取用户基础分组（通过TokenAuth中间件已设置）
	userGroup := c.GetString(constant2.ContextKeyUserGroup)
	if userGroup == "" {
		// 如果从上下文中获取不到，尝试从用户缓存中重新获取
		userId := c.GetInt("id")
		if userId > 0 {
			if userCache, cacheErr := model.GetUserCache(userId); cacheErr == nil {
				userGroup = userCache.Group
			}
		}
		// 如果仍然为空，使用默认分组
		if userGroup == "" {
			userGroup = "default"
		}
	}

	// 获取令牌分组
	tokenGroup := c.GetString("token_group")

	if tokenGroup != "" {
		// 检查用户是否可以使用这个令牌分组
		if _, ok := setting.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("令牌分组 %s 已被禁用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		// 检查分组是否存在于分组比例中
		if !setting.ContainsGroupRatio(tokenGroup) {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("分组 %s 已被弃用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		userGroup = tokenGroup
	}

	group := userGroup
	c.Set("group", group)

	// 添加调试信息
	//groupRatio := setting.GetGroupRatio(group)
	//common.LogInfo(c, fmt.Sprintf("K2 Debug - 最终使用分组: %s, 分组倍率: %.2f, 目标模型: %s", group, groupRatio, targetModel))

	// 检查令牌模型限制
	modelLimitEnable := c.GetBool("token_model_limit_enabled")
	if modelLimitEnable {
		s, ok := c.Get("token_model_limit")
		var tokenModelLimit map[string]bool
		if ok {
			tokenModelLimit = s.(map[string]bool)
		} else {
			tokenModelLimit = map[string]bool{}
		}
		if tokenModelLimit != nil {
			if _, ok := tokenModelLimit[targetModel]; !ok {
				claudeErr := &dto.ClaudeErrorWithStatusCode{
					Error: dto.ClaudeError{
						Message: fmt.Sprintf("该令牌无权访问模型 %s", targetModel),
					},
					StatusCode: http.StatusForbidden,
				}
				requestId := c.GetString(common.RequestIdKey)
				claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
				c.JSON(claudeErr.StatusCode, gin.H{
					"error": claudeErr.Error,
				})
				return
			}
		} else {
			// token model limit is empty, all models are not allowed
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: "该令牌无权访问任何模型",
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
	}

	// 选择适合目标模型的渠道
	channel, err := model.CacheGetRandomSatisfiedChannel(group, targetModel, 0)
	if err != nil {
		common.LogError(c, err.Error())
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", group, targetModel),
			},
			StatusCode: http.StatusServiceUnavailable,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 设置请求开始时间（模拟 Distribute 中间件的行为）
	c.Set(constant2.ContextKeyRequestStartTime, time.Now())

	// 设置渠道相关的上下文信息
	middleware.SetupContextForSelectedChannel(c, channel, targetModel)

	// 调用原有的 Claude 处理逻辑
	RelayClaude(c)
}

func RelayClaudeGlm(c *gin.Context) {
	// 获取原始请求体并修改模型名称
	rawBody, err := common.GetRequestBody(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("获取请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的请求",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 解析 JSON 以修改模型名称
	var requestBody map[string]interface{}
	if err := json.Unmarshal(rawBody, &requestBody); err != nil {
		common.LogError(c, fmt.Sprintf("解析请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "无效的JSON格式",
			},
			StatusCode: http.StatusBadRequest,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 强制设置模型为 cc:claude-code
	targetModel := "cc:glm4.5"
	requestBody["model"] = targetModel

	// 重新序列化请求体
	modifiedBody, err := json.Marshal(requestBody)
	if err != nil {
		common.LogError(c, fmt.Sprintf("序列化请求体失败: %s", err.Error()))
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: "处理请求失败",
			},
			StatusCode: http.StatusInternalServerError,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 重置请求体
	c.Request.Body = io.NopCloser(bytes.NewBuffer(modifiedBody))

	// 手动设置渠道相关信息（模拟 Distribute 中间件的行为）
	// 获取用户基础分组（通过TokenAuth中间件已设置）
	userGroup := c.GetString(constant2.ContextKeyUserGroup)
	if userGroup == "" {
		// 如果从上下文中获取不到，尝试从用户缓存中重新获取
		userId := c.GetInt("id")
		if userId > 0 {
			if userCache, cacheErr := model.GetUserCache(userId); cacheErr == nil {
				userGroup = userCache.Group
			}
		}
		// 如果仍然为空，使用默认分组
		if userGroup == "" {
			userGroup = "default"
		}
	}

	// 获取令牌分组
	tokenGroup := c.GetString("token_group")

	if tokenGroup != "" {
		// 检查用户是否可以使用这个令牌分组
		if _, ok := setting.GetUserUsableGroups(userGroup)[tokenGroup]; !ok {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("令牌分组 %s 已被禁用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		// 检查分组是否存在于分组比例中
		if !setting.ContainsGroupRatio(tokenGroup) {
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: fmt.Sprintf("分组 %s 已被弃用", tokenGroup),
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
		userGroup = tokenGroup
	}

	group := userGroup
	c.Set("group", group)

	// 添加调试信息
	//groupRatio := setting.GetGroupRatio(group)
	//common.LogInfo(c, fmt.Sprintf("K2 Debug - 最终使用分组: %s, 分组倍率: %.2f, 目标模型: %s", group, groupRatio, targetModel))

	// 检查令牌模型限制
	modelLimitEnable := c.GetBool("token_model_limit_enabled")
	if modelLimitEnable {
		s, ok := c.Get("token_model_limit")
		var tokenModelLimit map[string]bool
		if ok {
			tokenModelLimit = s.(map[string]bool)
		} else {
			tokenModelLimit = map[string]bool{}
		}
		if tokenModelLimit != nil {
			if _, ok := tokenModelLimit[targetModel]; !ok {
				claudeErr := &dto.ClaudeErrorWithStatusCode{
					Error: dto.ClaudeError{
						Message: fmt.Sprintf("该令牌无权访问模型 %s", targetModel),
					},
					StatusCode: http.StatusForbidden,
				}
				requestId := c.GetString(common.RequestIdKey)
				claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
				c.JSON(claudeErr.StatusCode, gin.H{
					"error": claudeErr.Error,
				})
				return
			}
		} else {
			// token model limit is empty, all models are not allowed
			claudeErr := &dto.ClaudeErrorWithStatusCode{
				Error: dto.ClaudeError{
					Message: "该令牌无权访问任何模型",
				},
				StatusCode: http.StatusForbidden,
			}
			requestId := c.GetString(common.RequestIdKey)
			claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
			c.JSON(claudeErr.StatusCode, gin.H{
				"error": claudeErr.Error,
			})
			return
		}
	}

	// 选择适合目标模型的渠道
	channel, err := model.CacheGetRandomSatisfiedChannel(group, targetModel, 0)
	if err != nil {
		common.LogError(c, err.Error())
		claudeErr := &dto.ClaudeErrorWithStatusCode{
			Error: dto.ClaudeError{
				Message: fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", group, targetModel),
			},
			StatusCode: http.StatusServiceUnavailable,
		}
		requestId := c.GetString(common.RequestIdKey)
		claudeErr.Error.Message = common.MessageWithRequestId(claudeErr.Error.Message, requestId)
		c.JSON(claudeErr.StatusCode, gin.H{
			"error": claudeErr.Error,
		})
		return
	}

	// 设置请求开始时间（模拟 Distribute 中间件的行为）
	c.Set(constant2.ContextKeyRequestStartTime, time.Now())

	// 设置渠道相关的上下文信息
	middleware.SetupContextForSelectedChannel(c, channel, targetModel)

	// 调用原有的 Claude 处理逻辑
	RelayClaude(c)
}

func relayRequest(c *gin.Context, relayMode int, channel *model.Channel) *dto.OpenAIErrorWithStatusCode {
	addUsedChannel(c, channel.Id)
	requestBody, _ := common.GetRequestBody(c)
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
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}

	// 🚀 新增优化：非流式请求只要有错误就重试
	// 检查是否为非流式请求
	if isStream, exists := c.Get("is_stream"); exists {
		if !isStream.(bool) {
			// 非流式请求，只要有错误就重试（但排除一些明确不应重试的错误）
			errorMessage := openaiErr.Error.Message

			// 用户配额不足时不重试（用户真的没钱了）
			if strings.Contains(errorMessage, "user quota is not enough") ||
				strings.Contains(errorMessage, "insufficient_user_quota") {
				common.LogInfo(c, "non-stream request: user quota insufficient, will not retry")
				return false
			}

			// 其他所有错误都重试
			common.LogInfo(c, "non-stream request: error detected, will try other channels")
			return true
		}
	}

	// 流式请求或无法确定stream类型时，使用原有逻辑

	// 特殊处理：如果是配额相关的本地错误，检查是否是可重试的情况
	if openaiErr.LocalError {
		// 检查是否是可重试的配额错误
		errorMessage := openaiErr.Error.Message
		if strings.Contains(errorMessage, "quota") || strings.Contains(errorMessage, "配额") {
			// 如果是token配额不足，可以尝试其他渠道
			if strings.Contains(errorMessage, "token quota is not enough") ||
				strings.Contains(errorMessage, "pre_consume_token_quota_failed") ||
				strings.Contains(errorMessage, "token remain quota") {
				common.LogInfo(c, "token quota insufficient, will try other channels")
				return true
			}
			// 如果是用户配额不足，不重试（用户真的没钱了）
			if strings.Contains(errorMessage, "user quota is not enough") ||
				strings.Contains(errorMessage, "insufficient_user_quota") {
				common.LogInfo(c, "user quota insufficient, will not retry")
				return false
			}
		}
		// 其他本地错误不重试
		return false
	}

	// 特殊处理：检查是否是空回复错误（流式和非流式）
	errorMessage := openaiErr.Error.Message
	if strings.Contains(errorMessage, "empty response") ||
		strings.Contains(errorMessage, "empty_response") ||
		strings.Contains(errorMessage, "stream response is empty") ||
		strings.Contains(errorMessage, "zero completion tokens") ||
		openaiErr.Error.Type == "empty_stream_response" ||
		openaiErr.Error.Type == "empty_response" {
		common.LogInfo(c, "empty response detected, will try other channels")
		return true
	}

	// 特殊处理：网络连接错误，包括 socket hang up
	if strings.Contains(strings.ToLower(errorMessage), "socket hang up") ||
		strings.Contains(strings.ToLower(errorMessage), "connection reset") ||
		strings.Contains(strings.ToLower(errorMessage), "connection refused") ||
		strings.Contains(strings.ToLower(errorMessage), "network is unreachable") ||
		strings.Contains(strings.ToLower(errorMessage), "no route to host") ||
		strings.Contains(strings.ToLower(errorMessage), "timeout") ||
		strings.Contains(strings.ToLower(errorMessage), "deadline exceeded") ||
		strings.Contains(strings.ToLower(errorMessage), "eof") ||
		strings.Contains(strings.ToLower(errorMessage), "unexpected eof") {
		common.LogInfo(c, "network error detected, will try other channels")
		return true
	}

	if openaiErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if openaiErr.StatusCode == 307 {
		return true
	}
	if openaiErr.StatusCode/100 == 5 {
		// 5xx 错误，允许重试
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
		// azure处理超时，允许重试
		return true
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
	maxRetries := common.GetEffectiveMaxRetryTimes()
	channelId := c.GetInt("channel_id")
	relayMode := c.GetInt("relay_mode")
	group := c.GetString("group")
	originalModel := c.GetString("original_model")
	c.Set("use_channel", []string{fmt.Sprintf("%d", channelId)})
	taskErr := taskRelayHandler(c, relayMode)
	if taskErr == nil {
		maxRetries = 0
	}
	for i := 0; shouldRetryTaskRelay(c, channelId, taskErr, maxRetries) && i < maxRetries; i++ {
		channel, err := model.CacheGetRandomSatisfiedChannel(group, originalModel, i)
		if err != nil {
			common.LogError(c, fmt.Sprintf("CacheGetRandomSatisfiedChannel failed: %s", err.Error()))
			break
		}
		channelId = channel.Id
		useChannel := c.GetStringSlice("use_channel")
		useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
		c.Set("use_channel", useChannel)
		common.LogInfo(c, fmt.Sprintf("using channel #%d to retry (remain times %d)", channel.Id, maxRetries-i))
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
		if taskErr.StatusCode == http.StatusTooManyRequests {
			taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
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
		//if taskErr.StatusCode == 504 || taskErr.StatusCode == 524 {
		//	return false
		//}
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
