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

func RelayErrorHandler(resp *http.Response, showBodyWhenFail bool) (newApiErr *types.NewAPIError) {
	newApiErr = types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, resp.StatusCode)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Failed to read response body: %v", err))
		return
	}
	common.CloseResponseBodyGracefully(resp)
	
	// 记录原始响应 - 使用 SysError 确保输出
	common.SysError(fmt.Sprintf("[RelayErrorHandler] Status Code: %d, Response Body: %s", resp.StatusCode, string(responseBody)))
	
	// 先尝试解析为 Claude 错误格式
	var claudeErrResponse dto.ClaudeResponse
	claudeErr := common.Unmarshal(responseBody, &claudeErrResponse)
	if claudeErr == nil && claudeErrResponse.Error != nil {
		common.SysError(fmt.Sprintf("[RelayErrorHandler] Parsed as Claude error: %+v", claudeErrResponse.Error))
		// 成功解析为 Claude 错误格式
		if claudeError := claudeErrResponse.GetClaudeError(); claudeError != nil && claudeError.Type != "" {
			common.SysError(fmt.Sprintf("[RelayErrorHandler] Returning Claude error: Type=%s, Message=%s", claudeError.Type, claudeError.Message))
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
