package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
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

// OpenAIErrorWrapper wraps an error into an OpenAIErrorWithStatusCode
func OpenAIErrorWrapper(err error, code string, statusCode int) *dto.OpenAIErrorWithStatusCode {
	text := err.Error()
	lowerText := strings.ToLower(text)

	// 网络相关错误处理
	if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
		common.SysLog(fmt.Sprintf("network error: %s", text))

		// 根据错误类型提供更具体的错误信息
		if strings.Contains(lowerText, "timeout") || strings.Contains(lowerText, "deadline") {
			text = "请求上游服务超时，请稍后重试"
		} else if strings.Contains(lowerText, "connection refused") || strings.Contains(lowerText, "dial") {
			text = "无法连接到上游服务，请检查网络连接"
		} else if strings.Contains(lowerText, "tls") || strings.Contains(lowerText, "certificate") {
			text = "SSL/TLS连接失败，请检查证书配置"
		} else if strings.Contains(lowerText, "dns") || strings.Contains(lowerText, "no such host") {
			text = "域名解析失败，请检查网络配置"
		} else {
			text = "请求上游地址失败"
		}

		// 在debug模式下保留原始错误信息
		if common.DebugEnabled {
			text = fmt.Sprintf("%s (原始错误: %s)", text, err.Error())
		}
	}

	openAIError := dto.OpenAIError{
		Message: text,
		Type:    "new_api_error",
		Code:    code,
	}
	return &dto.OpenAIErrorWithStatusCode{
		Error:      openAIError,
		StatusCode: statusCode,
	}
}

func OpenAIErrorWrapperLocal(err error, code string, statusCode int) *dto.OpenAIErrorWithStatusCode {
	openaiErr := OpenAIErrorWrapper(err, code, statusCode)
	openaiErr.LocalError = true
	return openaiErr
}

func ClaudeErrorWrapper(err error, code string, statusCode int) *dto.ClaudeErrorWithStatusCode {
	text := err.Error()
	lowerText := strings.ToLower(text)

	// 网络相关错误处理
	if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
		common.SysLog(fmt.Sprintf("network error: %s", text))

		// 根据错误类型提供更具体的错误信息
		if strings.Contains(lowerText, "timeout") || strings.Contains(lowerText, "deadline") {
			text = "请求上游服务超时，请稍后重试"
		} else if strings.Contains(lowerText, "connection refused") || strings.Contains(lowerText, "dial") {
			text = "无法连接到上游服务，请检查网络连接"
		} else if strings.Contains(lowerText, "tls") || strings.Contains(lowerText, "certificate") {
			text = "SSL/TLS连接失败，请检查证书配置"
		} else if strings.Contains(lowerText, "dns") || strings.Contains(lowerText, "no such host") {
			text = "域名解析失败，请检查网络配置"
		} else {
			text = "请求上游地址失败"
		}

		// 在debug模式下保留原始错误信息
		if common.DebugEnabled {
			text = fmt.Sprintf("%s (原始错误: %s)", text, err.Error())
		}
	}

	claudeError := dto.ClaudeError{
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

func RelayErrorHandler(resp *http.Response, showBodyWhenFail bool) (errWithStatusCode *dto.OpenAIErrorWithStatusCode) {
	errWithStatusCode = &dto.OpenAIErrorWithStatusCode{
		StatusCode: resp.StatusCode,
		Error: dto.OpenAIError{
			Type:  "upstream_error",
			Code:  "bad_response_status_code",
			Param: strconv.Itoa(resp.StatusCode),
		},
	}
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return
	}
	err = resp.Body.Close()
	if err != nil {
		return
	}
	var errResponse dto.GeneralErrorResponse
	err = json.Unmarshal(responseBody, &errResponse)
	if err != nil {
		if showBodyWhenFail {
			errWithStatusCode.Error.Message = string(responseBody)
		} else {
			errWithStatusCode.Error.Message = fmt.Sprintf("bad response status code %d", resp.StatusCode)
		}
		return
	}

	errWithStatusCode.UpstreamError = true
	errWithStatusCode.Error.Message = "上游服务异常，请稍后重试，如有任何问题，请联系我们"
	if errResponse.Error.Message != "" {
		// OpenAI format error, so we override the default one
		errWithStatusCode.UpstreamErrorInfo = errResponse.Error
	} else {
		errWithStatusCode.UpstreamErrorInfo.Message = errResponse.ToMessage()
	}
	if errWithStatusCode.UpstreamErrorInfo.Message == "" {
		errWithStatusCode.UpstreamErrorInfo.Message = fmt.Sprintf("bad response status code %d", resp.StatusCode)
	}
	return
}

func ResetStatusCode(openaiErr *dto.OpenAIErrorWithStatusCode, statusCodeMappingStr string) {
	if statusCodeMappingStr == "" || statusCodeMappingStr == "{}" {
		return
	}
	statusCodeMapping := make(map[string]string)
	err := json.Unmarshal([]byte(statusCodeMappingStr), &statusCodeMapping)
	if err != nil {
		return
	}
	if openaiErr.StatusCode == http.StatusOK {
		return
	}
	codeStr := strconv.Itoa(openaiErr.StatusCode)
	if _, ok := statusCodeMapping[codeStr]; ok {
		intCode, _ := strconv.Atoi(statusCodeMapping[codeStr])
		openaiErr.StatusCode = intCode
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

	// 网络相关错误处理
	if strings.Contains(lowerText, "post") || strings.Contains(lowerText, "dial") || strings.Contains(lowerText, "http") {
		common.SysLog(fmt.Sprintf("network error: %s", text))

		// 根据错误类型提供更具体的错误信息
		if strings.Contains(lowerText, "timeout") || strings.Contains(lowerText, "deadline") {
			text = "请求上游服务超时，请稍后重试"
		} else if strings.Contains(lowerText, "connection refused") || strings.Contains(lowerText, "dial") {
			text = "无法连接到上游服务，请检查网络连接"
		} else if strings.Contains(lowerText, "tls") || strings.Contains(lowerText, "certificate") {
			text = "SSL/TLS连接失败，请检查证书配置"
		} else if strings.Contains(lowerText, "dns") || strings.Contains(lowerText, "no such host") {
			text = "域名解析失败，请检查网络配置"
		} else {
			text = "请求上游地址失败"
		}

		// 在debug模式下保留原始错误信息
		if common.DebugEnabled {
			text = fmt.Sprintf("%s (原始错误: %s)", text, err.Error())
		}
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
