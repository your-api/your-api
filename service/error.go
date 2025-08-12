package service

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/types"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func MidjourneyErrorWrapper(code int, desc string) *dto.MidjourneyResponse {
	return &dto.MidjourneyResponse{
		Code:        code,
		Description: desc,
	}
}

func MidjourneyErrorWithStatusCodeWrapper(code int, desc string, statusCode int) *dto.MidjourneyResponseWithStatusCode {
	return &dto.MidjourneyResponseWithStatusCode{
		StatusCode: statusCode,
		Response:   *MidjourneyErrorWrapper(code, desc),
	}
}

//// OpenAIErrorWrapper wraps an error into an OpenAIErrorWithStatusCode
//func OpenAIErrorWrapper(err error, code string, statusCode int) *dto.OpenAIErrorWithStatusCode {
//	text := err.Error()
//	lowerText := strings.ToLower(text)
//	if !strings.HasPrefix(lowerText, "get file base64 from url") && !strings.HasPrefix(lowerText, "mime type is not supported") {
//		if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
//			common.SysLog(fmt.Sprintf("error: %s", text))
//			text = "请求上游地址失败"
//		}
//	}
//	openAIError := dto.OpenAIError{
//		Message: text,
//		Type:    "new_api_error",
//		Code:    code,
//	}
//	return &dto.OpenAIErrorWithStatusCode{
//		Error:      openAIError,
//		StatusCode: statusCode,
//	}
//}
//
//func OpenAIErrorWrapperLocal(err error, code string, statusCode int) *dto.OpenAIErrorWithStatusCode {
//	openaiErr := OpenAIErrorWrapper(err, code, statusCode)
//	openaiErr.LocalError = true
//	return openaiErr
//}

func ClaudeErrorWrapper(err error, code string, statusCode int) *dto.ClaudeErrorWithStatusCode {
	text := err.Error()
	lowerText := strings.ToLower(text)
	if !strings.HasPrefix(lowerText, "get file base64 from url") {
		if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
			common.SysLog(fmt.Sprintf("error: %s", text))
			text = "请求上游地址失败"
		}
	}
	claudeError := types.ClaudeError{
		Message: text,
		Type:    "new_api_error",
	}
	return &dto.ClaudeErrorWithStatusCode{
		Error:      claudeError,
		StatusCode: statusCode,
	}
}

func ClaudeErrorWrapperLocal(err error, code string, statusCode int) *dto.ClaudeErrorWithStatusCode {
	claudeErr := ClaudeErrorWrapper(err, code, statusCode)
	claudeErr.LocalError = true
	return claudeErr
}

func RelayErrorHandler(c *gin.Context, resp *http.Response, showBodyWhenFail bool) (newApiErr *types.NewAPIError) {
	newApiErr = types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, resp.StatusCode)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Failed to read response body: %v", err))
		return
	}
	common.CloseResponseBodyGracefully(resp)

	// 记录原始响应 - 使用 SysError 确保输出
	common.SysError(fmt.Sprintf("[RelayErrorHandler] Status Code: %d, Response Body: %s", resp.StatusCode, string(responseBody)))

	// 检查是否已经是 clove/CLI 格式的错误（包含 detail.code 和 detail.message）
	var cloveError map[string]interface{}
	if err := common.Unmarshal(responseBody, &cloveError); err == nil {
		if detail, ok := cloveError["detail"].(map[string]interface{}); ok {
			if _, hasCode := detail["code"]; hasCode {
				if _, hasMessage := detail["message"]; hasMessage {
					// 这已经是 clove 格式的错误，提取错误信息
					common.SysError(fmt.Sprintf("[RelayErrorHandler] Detected clove format error, extracting message"))

					// 从 context 中提取错误信息
					errorMessage := ""
					if context, ok := detail["context"].(map[string]interface{}); ok {
						if errorMsg, ok := context["error_message"].(string); ok {
							errorMessage = errorMsg
						}
					}

					// 如果没有 error_message，使用 message 字段
					if errorMessage == "" {
						if msg, ok := detail["message"].(string); ok {
							errorMessage = msg
						}
					}

					// 检查是否是 token 超限错误，如果是则不重试
					if (strings.Contains(errorMessage, "max_tokens") && strings.Contains(errorMessage, "exceed context limit")) ||
						strings.Contains(errorMessage, "input length and max_tokens exceed context limit") {
						common.SysError(fmt.Sprintf("[RelayErrorHandler] Token limit exceeded, marking as non-retryable"))

						// 检查是否是CLI用户代理，如果是则添加/compact提示
						if c != nil {
							userAgent := c.Request.Header.Get("User-Agent")
							if strings.Contains(strings.ToLower(userAgent), "cli") {
								// 直接修改 cloveError 中的 error_message
								if context, ok := detail["context"].(map[string]interface{}); ok {
									originalMsg, _ := context["error_message"].(string)
									context["error_message"] = originalMsg + ". Please run /compact to compact & continue. 上下文超过限制，请先运行 /compact 命令压缩对话历史，然后继续使用。"
								}

								// 同时修改 message 字段
								if msg, ok := detail["message"].(string); ok {
									detail["message"] = msg + ".  Please run /compact to compact & continue. 上下文超过限制，请先运行 /compact 命令压缩对话历史，然后继续使用。"
								}

								// 更新错误消息用于日志
								errorMessage += ".  Please run /compact to compact & continue. 上下文超过限制，请先运行 /compact 命令压缩对话历史，然后继续使用。"
							}
						}

						// 创建一个不可重试的错误，并保存修改后的 clove 格式
						return types.NewErrorWithStatusCode(
							fmt.Errorf(errorMessage),
							types.ErrorCodeBadResponseStatusCode,
							resp.StatusCode,
							types.ErrOptionWithSkipRetry(),
							types.ErrOptionWithRelayError(cloveError),
						)
					}
					// 保存原始的 clove 格式错误
					return types.NewErrorWithStatusCode(
						fmt.Errorf(errorMessage),
						types.ErrorCodeBadResponseStatusCode,
						resp.StatusCode,
						types.ErrOptionWithRelayError(cloveError),
					)
				}
			}
		}
	}

	// 先尝试解析为 Claude 错误格式
	var claudeErrResponse dto.ClaudeResponse
	claudeErr := common.Unmarshal(responseBody, &claudeErrResponse)
	if claudeErr == nil && claudeErrResponse.Error != nil {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Parsed as Claude error: %+v", claudeErrResponse.Error))
		// 成功解析为 Claude 错误格式
		if claudeError := claudeErrResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
			common.SysError(fmt.Sprintf("[RelayErrorHandler] Returning Claude error: Type=%s, Message=%s", claudeError.Type, claudeError.Message))
			// 检查是否是 token 超限错误
			if (strings.Contains(claudeError.Message, "max_tokens") && strings.Contains(claudeError.Message, "exceed context limit")) ||
				strings.Contains(claudeError.Message, "input length and max_tokens exceed context limit") {
				return types.WithClaudeErrorAndContext(c, *claudeError, resp.StatusCode, types.ErrOptionWithSkipRetry())
			}
			return types.WithClaudeError(*claudeError, resp.StatusCode)
		}
	} else if claudeErr != nil {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Failed to parse as Claude error: %v", claudeErr))
	}

	// 尝试解析为通用错误格式
	var errResponse dto.GeneralErrorResponse
	err = common.Unmarshal(responseBody, &errResponse)
	if err != nil {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Failed to parse as GeneralError: %v", err))
		if showBodyWhenFail {
			newApiErr.Err = fmt.Errorf("bad response status code %d, body: %s", resp.StatusCode, string(responseBody))
		} else {
			if common.DebugEnabled {
				println(fmt.Sprintf("bad response status code %d, body: %s", resp.StatusCode, string(responseBody)))
			}
			newApiErr.Err = fmt.Errorf("bad response status code %d", resp.StatusCode)
		}
		return
	}

	common.SysError(fmt.Sprintf("[RelayErrorHandler] Parsed as GeneralError: %+v", errResponse))

	if errResponse.Error.Message != "" {
		// General format error (OpenAI, Anthropic, Gemini, etc.)
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Returning OpenAI error from GeneralError"))
		// 检查是否是 token 超限错误
		if (strings.Contains(errResponse.Error.Message, "max_tokens") && strings.Contains(errResponse.Error.Message, "exceed context limit")) ||
			strings.Contains(errResponse.Error.Message, "input length and max_tokens exceed context limit") {
			return types.WithOpenAIError(errResponse.Error, resp.StatusCode, types.ErrOptionWithSkipRetry())
		}
		newApiErr = types.WithOpenAIError(errResponse.Error, resp.StatusCode)
	} else {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Returning error from ToMessage: %s", errResponse.ToMessage()))
		newApiErr = types.NewOpenAIError(errors.New(errResponse.ToMessage()), types.ErrorCodeBadResponseStatusCode, resp.StatusCode)
	}
	return
}

func ResetStatusCode(newApiErr *types.NewAPIError, statusCodeMappingStr string) {
	if statusCodeMappingStr == "" || statusCodeMappingStr == "{}" {
		return
	}
	statusCodeMapping := make(map[string]string)
	err := common.Unmarshal([]byte(statusCodeMappingStr), &statusCodeMapping)
	if err != nil {
		return
	}
	if newApiErr.StatusCode == http.StatusOK {
		return
	}
	codeStr := strconv.Itoa(newApiErr.StatusCode)
	if _, ok := statusCodeMapping[codeStr]; ok {
		intCode, _ := strconv.Atoi(statusCodeMapping[codeStr])
		newApiErr.StatusCode = intCode
	}
}

func TaskErrorWrapperLocal(err error, code string, statusCode int) *dto.TaskError {
	openaiErr := TaskErrorWrapper(err, code, statusCode)
	openaiErr.LocalError = true
	return openaiErr
}

func TaskErrorWrapper(err error, code string, statusCode int) *dto.TaskError {
	text := err.Error()
	lowerText := strings.ToLower(text)
	if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
		common.SysLog(fmt.Sprintf("error: %s", text))
		text = "请求上游地址失败"
	}
	//避免暴露内部错误
	taskError := &dto.TaskError{
		Code:       code,
		Message:    text,
		StatusCode: statusCode,
		Error:      err,
	}

	return taskError
}
