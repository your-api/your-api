package openai

import (
	"encoding/json"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"strings"

	"github.com/gin-gonic/gin"
)

// 辅助函数
func handleStreamFormat(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	// 早期检测空数据
	if data == "" {
		return nil
	}

	// 解析并检测空回复
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := json.Unmarshal(common.StringToByteSlice(data), &streamResponse); err == nil {
		// 检查是否为空回复，如果是则直接返回，不增加发送计数
		if isEmptyStreamResponse(&streamResponse) {
			return nil
		}
	}

	info.SendResponseCount++
	switch info.RelayFormat {
	case relaycommon.RelayFormatOpenAI:
		return sendStreamData(c, info, data, forceFormat, thinkToContent)
	case relaycommon.RelayFormatClaude:
		return handleClaudeFormat(c, data, info)
	}
	return nil
}

// isEmptyStreamResponse 检查流回复是否为空，用于过滤无意义的空回复
func isEmptyStreamResponse(response *dto.ChatCompletionsStreamResponse) bool {
	// 检查基本字段是否为空值
	if response.Id == "" && response.Object == "" && response.Created == 0 {
		// 检查choices是否为空或者只包含空的delta
		if response.Choices == nil || len(response.Choices) == 0 {
			return true
		}
		
		// 检查所有choices是否都没有实际内容
		hasValidContent := false
		for _, choice := range response.Choices {
			// 检查delta是否有实际内容
			if choice.Delta.GetContentString() != "" || 
			   choice.Delta.GetReasoningContent() != "" ||
			   choice.Delta.Role != "" ||
			   choice.Delta.ToolCalls != nil && len(choice.Delta.ToolCalls) > 0 ||
			   choice.FinishReason != nil {
				hasValidContent = true
				break
			}
		}
		
		if !hasValidContent {
			return true
		}
	}

	// 检查choices长度为0的情况（用户提到的情况）
	if response.Choices != nil && len(response.Choices) == 1 {
		choice := response.Choices[0]
		// 检查choices.length为0的特殊情况
		if choice.Delta.GetContentString() == "" && 
		   choice.Delta.GetReasoningContent() == "" &&
		   choice.Delta.Role == "" &&
		   (choice.Delta.ToolCalls == nil || len(choice.Delta.ToolCalls) == 0) &&
		   choice.FinishReason == nil {
			return true
		}
	}

	return false
}

func handleClaudeFormat(c *gin.Context, data string, info *relaycommon.RelayInfo) error {
	var streamResponse dto.ChatCompletionsStreamResponse
	if err := json.Unmarshal(common.StringToByteSlice(data), &streamResponse); err != nil {
		return err
	}

	if streamResponse.Usage != nil {
		info.ClaudeConvertInfo.Usage = streamResponse.Usage
	}
	claudeResponses := service.StreamResponseOpenAI2Claude(&streamResponse, info)
	for _, resp := range claudeResponses {
		helper.ClaudeData(c, *resp)
	}
	return nil
}

func ProcessStreamResponse(streamResponse dto.ChatCompletionsStreamResponse, responseTextBuilder *strings.Builder, toolCount *int) error {
	for _, choice := range streamResponse.Choices {
		// 过滤掉"Thinking..."开头的内容，不参与token计费
		content := choice.Delta.GetContentString()
		if !strings.HasPrefix(content, "Thinking...") {
			responseTextBuilder.WriteString(content)
		}
		responseTextBuilder.WriteString(choice.Delta.GetReasoningContent())
		if choice.Delta.ToolCalls != nil {
			if len(choice.Delta.ToolCalls) > *toolCount {
				*toolCount = len(choice.Delta.ToolCalls)
			}
			for _, tool := range choice.Delta.ToolCalls {
				responseTextBuilder.WriteString(tool.Function.Name)
				responseTextBuilder.WriteString(tool.Function.Arguments)
			}
		}
	}
	return nil
}

func processTokens(relayMode int, streamItems []string, responseTextBuilder *strings.Builder, toolCount *int) error {
	streamResp := "[" + strings.Join(streamItems, ",") + "]"

	switch relayMode {
	case relayconstant.RelayModeChatCompletions:
		return processChatCompletions(streamResp, streamItems, responseTextBuilder, toolCount)
	case relayconstant.RelayModeCompletions:
		return processCompletions(streamResp, streamItems, responseTextBuilder)
	}
	return nil
}

func processChatCompletions(streamResp string, streamItems []string, responseTextBuilder *strings.Builder, toolCount *int) error {
	var streamResponses []dto.ChatCompletionsStreamResponse
	if err := json.Unmarshal(common.StringToByteSlice(streamResp), &streamResponses); err != nil {
		// 一次性解析失败，逐个解析
		common.SysError("error unmarshalling stream response: " + err.Error())
		for _, item := range streamItems {
			var streamResponse dto.ChatCompletionsStreamResponse
			if err := json.Unmarshal(common.StringToByteSlice(item), &streamResponse); err != nil {
				return err
			}
			if err := ProcessStreamResponse(streamResponse, responseTextBuilder, toolCount); err != nil {
				common.SysError("error processing stream response: " + err.Error())
			}
		}
		return nil
	}

	// 批量处理所有响应
	for _, streamResponse := range streamResponses {
		for _, choice := range streamResponse.Choices {
			// 过滤掉"Thinking..."开头的内容，不参与token计费
			content := choice.Delta.GetContentString()
			if !strings.HasPrefix(content, "Thinking...") {
				responseTextBuilder.WriteString(content)
			}
			responseTextBuilder.WriteString(choice.Delta.GetReasoningContent())
			if choice.Delta.ToolCalls != nil {
				if len(choice.Delta.ToolCalls) > *toolCount {
					*toolCount = len(choice.Delta.ToolCalls)
				}
				for _, tool := range choice.Delta.ToolCalls {
					responseTextBuilder.WriteString(tool.Function.Name)
					responseTextBuilder.WriteString(tool.Function.Arguments)
				}
			}
		}
	}
	return nil
}

func processCompletions(streamResp string, streamItems []string, responseTextBuilder *strings.Builder) error {
	var streamResponses []dto.CompletionsStreamResponse
	if err := json.Unmarshal(common.StringToByteSlice(streamResp), &streamResponses); err != nil {
		// 一次性解析失败，逐个解析
		common.SysError("error unmarshalling stream response: " + err.Error())
		for _, item := range streamItems {
			var streamResponse dto.CompletionsStreamResponse
			if err := json.Unmarshal(common.StringToByteSlice(item), &streamResponse); err != nil {
				continue
			}
			for _, choice := range streamResponse.Choices {
				responseTextBuilder.WriteString(choice.Text)
			}
		}
		return nil
	}

	// 批量处理所有响应
	for _, streamResponse := range streamResponses {
		for _, choice := range streamResponse.Choices {
			responseTextBuilder.WriteString(choice.Text)
		}
	}
	return nil
}

func handleLastResponse(lastStreamData string, responseId *string, createAt *int64,
	systemFingerprint *string, model *string, usage **dto.Usage,
	containStreamUsage *bool, info *relaycommon.RelayInfo,
	shouldSendLastResp *bool) error {

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := json.Unmarshal(common.StringToByteSlice(lastStreamData), &lastStreamResponse); err != nil {
		return err
	}

	*responseId = lastStreamResponse.Id
	*createAt = lastStreamResponse.Created
	*systemFingerprint = lastStreamResponse.GetSystemFingerprint()
	*model = lastStreamResponse.Model

	if service.ValidUsage(lastStreamResponse.Usage) {
		*containStreamUsage = true
		*usage = lastStreamResponse.Usage
		if !info.ShouldIncludeUsage {
			*shouldSendLastResp = false
		}
	}

	return nil
}

func handleFinalResponse(c *gin.Context, info *relaycommon.RelayInfo, lastStreamData string,
	responseId string, createAt int64, model string, systemFingerprint string,
	usage *dto.Usage, containStreamUsage bool) {

	switch info.RelayFormat {
	case relaycommon.RelayFormatOpenAI:
		if info.ShouldIncludeUsage && !containStreamUsage {
			response := helper.GenerateFinalUsageResponse(responseId, createAt, model, *usage)
			response.SetSystemFingerprint(systemFingerprint)
			helper.ObjectData(c, response)
		}
		helper.Done(c)

	case relaycommon.RelayFormatClaude:
		info.ClaudeConvertInfo.Done = true
		var streamResponse dto.ChatCompletionsStreamResponse
		if err := json.Unmarshal(common.StringToByteSlice(lastStreamData), &streamResponse); err != nil {
			common.SysError("error unmarshalling stream response: " + err.Error())
			return
		}

		info.ClaudeConvertInfo.Usage = usage

		claudeResponses := service.StreamResponseOpenAI2Claude(&streamResponse, info)
		for _, resp := range claudeResponses {
			helper.ClaudeData(c, *resp)
		}
	}
}

func sendResponsesStreamData(c *gin.Context, streamResponse dto.ResponsesStreamResponse, data string) {
	if data == "" {
		return
	}
	helper.ResponseChunkData(c, streamResponse, data)
}
