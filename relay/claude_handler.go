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
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting/model_setting"
	"strings"
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

	// 检查 User-Agent 是否包含 "cli"，如果包含则完全透传
	userAgent := c.Request.Header.Get("User-Agent")
	if strings.Contains(strings.ToLower(userAgent), "cli") {
		return ClaudePassthroughHelper(c, relayInfo)
	}

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

// ClaudePassthroughHelper 完全透传 Claude 请求，不做任何修改
func ClaudePassthroughHelper(c *gin.Context, relayInfo *relaycommon.RelayInfo) (claudeError *dto.ClaudeErrorWithStatusCode) {
	// 读取原始请求体
	requestBody, err := common.GetRequestBody(c)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "read_request_body_failed", http.StatusBadRequest)
	}

	// 尝试解析请求以获取基本信息（仅用于记录，不修改）
	var textRequest dto.ClaudeRequest
	json.Unmarshal(requestBody, &textRequest)
	
	// 设置流模式标志
	if textRequest.Stream {
		relayInfo.IsStream = true
	}

	// 获取适配器
	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return service.ClaudeErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
	}
	adaptor.Init(relayInfo)

	// 直接使用原始请求体，不做任何修改
	bodyReader := bytes.NewBuffer(requestBody)

	// 执行请求
	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, relayInfo, bodyReader)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "do_request_failed", http.StatusInternalServerError)
	}

	if resp != nil {
		httpResp = resp.(*http.Response)
		relayInfo.IsStream = relayInfo.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			openaiErr := service.RelayErrorHandler(httpResp, false)
			service.ResetStatusCode(openaiErr, statusCodeMappingStr)
			return service.OpenAIErrorToClaudeError(openaiErr)
		}
	}

	// 处理响应
	if relayInfo.IsStream {
		// 流式响应：直接透传
		return ClaudePassthroughStreamHandler(c, httpResp, relayInfo)
	} else {
		// 非流式响应：直接透传
		return ClaudePassthroughHandler(c, httpResp, relayInfo)
	}
}

// ClaudePassthroughStreamHandler 透传流式响应
func ClaudePassthroughStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *dto.ClaudeErrorWithStatusCode {
	defer resp.Body.Close()
	
	// 设置响应头
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	
	// 开始响应
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Flush()
	
	// 直接透传流数据
	scanner := bufio.NewScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	
	for scanner.Scan() {
		line := scanner.Text()
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
	
	return nil
}

// ClaudePassthroughHandler 透传非流式响应
func ClaudePassthroughHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *dto.ClaudeErrorWithStatusCode {
	defer resp.Body.Close()
	
	// 读取响应体
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return service.ClaudeErrorWrapperLocal(err, "read_response_body_failed", http.StatusInternalServerError)
	}
	
	// 设置响应头
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	
	// 直接写入原始响应
	_, err = c.Writer.Write(responseBody)
	if err != nil {
		common.LogError(c, fmt.Sprintf("write response failed: %v", err))
	}
	
	return nil
}
