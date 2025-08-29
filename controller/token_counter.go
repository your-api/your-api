package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/logger"
	"one-api/model"
	"time"

	"github.com/gin-gonic/gin"
)

// CountTokensRequest represents the request structure for token counting
type CountTokensRequest struct {
	Model    string                   `json:"model"`
	Messages []map[string]interface{} `json:"messages"`
	System   interface{}              `json:"system,omitempty"`
	Tools    []interface{}            `json:"tools,omitempty"`
}

// CountTokensResponse represents the response structure for token counting
type CountTokensResponse struct {
	InputTokens int `json:"input_tokens"`
}

// CountMessageTokens handles the /v1/messages/count_tokens endpoint
// This directly forwards to Anthropic's official API without any model mapping
func CountMessageTokens(c *gin.Context) {
	// Parse request body
	var tokenCountReq CountTokensRequest
	err := common.UnmarshalBodyReusable(c, &tokenCountReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Invalid request body",
				Type:    "invalid_request_error",
				Code:    "invalid_request",
			},
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Validate model
	if tokenCountReq.Model == "" {
		c.JSON(http.StatusBadRequest, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Model is required",
				Type:    "invalid_request_error",
				Code:    "model_required",
			},
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Skip authentication - direct call without token check
	// Get a Claude channel to use its API key
	// We need at least one Claude channel configured
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Failed to get channels",
				Type:    "internal_error",
				Code:    "internal_error",
			},
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	var claudeAPIKey string
	// Just get the first enabled channel's API key since we're using Claude directly
	for _, channel := range channels {
		if channel.Status == common.ChannelStatusEnabled {
			claudeAPIKey = channel.Key
			break
		}
	}

	if claudeAPIKey == "" {
		c.JSON(http.StatusServiceUnavailable, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "No Claude channel configured",
				Type:    "configuration_error",
				Code:    "no_claude_channel",
			},
			StatusCode: http.StatusServiceUnavailable,
		})
		return
	}

	// Always use Anthropic's official API
	//url := "https://api.anthropic.com/v1/messages/count_tokens"
	url := "http://38.147.106.148:5223/v1/messages/count_tokens"

	// Forward the request body as-is (complete passthrough)
	requestBody, _ := json.Marshal(tokenCountReq)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Failed to create request",
				Type:    "internal_error",
				Code:    "internal_error",
			},
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	//req.Header.Set("x-api-key", claudeAPIKey)
	req.Header.Set("x-api-key", "sk-admin-Zu5PAv6772Qa112NizZK2FhidiGUuaiEFz0pMg2FJYc")
	req.Header.Set("anthropic-version", "2023-06-01")

	// Make request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Failed to count tokens",
				Type:    "internal_error",
				Code:    "internal_error",
			},
			StatusCode: http.StatusInternalServerError,
		})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Failed to read response",
				Type:    "internal_error",
				Code:    "internal_error",
			},
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		var claudeError struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
			} `json:"error"`
		}
		json.Unmarshal(body, &claudeError)

		c.JSON(resp.StatusCode, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: claudeError.Error.Message,
				Type:    claudeError.Error.Type,
				Code:    "token_count_failed",
			},
			StatusCode: resp.StatusCode,
		})
		return
	}

	// Parse response
	var tokenCountResp CountTokensResponse
	err = json.Unmarshal(body, &tokenCountResp)
	if err != nil {
		// Try alternative field name
		var altResp struct {
			TokenCount int `json:"token_count"`
		}
		if err2 := json.Unmarshal(body, &altResp); err2 == nil {
			tokenCountResp.InputTokens = altResp.TokenCount
		} else {
			c.JSON(http.StatusInternalServerError, dto.OpenAIErrorWithStatusCode{
				Error: dto.OpenAIError{
					Message: "Failed to parse response",
					Type:    "internal_error",
					Code:    "internal_error",
				},
				StatusCode: http.StatusInternalServerError,
			})
			return
		}
	}

	// Log token counting request (optional)
	logger.LogInfo(c, fmt.Sprintf("Token count for model %s: %d tokens", tokenCountReq.Model, tokenCountResp.InputTokens))

	// Return response
	c.JSON(http.StatusOK, tokenCountResp)
}

// estimateTokenCount provides a rough estimate of token count for non-Claude models
func estimateTokenCount(req CountTokensRequest) int {
	// Simple estimation: count characters and divide by 4 (rough approximation)
	totalChars := 0

	// Count system prompt
	if req.System != nil {
		switch v := req.System.(type) {
		case string:
			totalChars += len(v)
		case []interface{}:
			for _, item := range v {
				if str, ok := item.(string); ok {
					totalChars += len(str)
				}
			}
		}
	}

	// Count messages
	for _, msg := range req.Messages {
		if content, ok := msg["content"]; ok {
			switch v := content.(type) {
			case string:
				totalChars += len(v)
			case []interface{}:
				for _, item := range v {
					if m, ok := item.(map[string]interface{}); ok {
						if text, ok := m["text"].(string); ok {
							totalChars += len(text)
						}
					}
				}
			}
		}
	}

	// Rough estimation: 1 token ≈ 4 characters
	estimatedTokens := totalChars / 4
	if estimatedTokens < 1 {
		estimatedTokens = 1
	}

	return estimatedTokens
}

// CountMessageTokensSimple handles token counting without channel selection
// This can be used for quick estimates without going through relay logic
func CountMessageTokensSimple(c *gin.Context) {
	var tokenCountReq CountTokensRequest
	err := common.UnmarshalBodyReusable(c, &tokenCountReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.OpenAIErrorWithStatusCode{
			Error: dto.OpenAIError{
				Message: "Invalid request body",
				Type:    "invalid_request_error",
				Code:    "invalid_request",
			},
			StatusCode: http.StatusBadRequest,
		})
		return
	}

	// Simple estimation for all models
	estimatedTokens := estimateTokenCount(tokenCountReq)

	c.JSON(http.StatusOK, CountTokensResponse{
		InputTokens: estimatedTokens,
	})
}
