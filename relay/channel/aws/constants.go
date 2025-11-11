package aws

import (
	"fmt"
	"strings"
)

var awsModelIDMap = map[string]string{
	"claude-instant-1.2":         "anthropic.claude-instant-v1",
	"claude-2.0":                 "anthropic.claude-v2",
	"claude-2.1":                 "anthropic.claude-v2:1",
	"claude-3-sonnet-20240229":   "anthropic.claude-3-sonnet-20240229-v1:0",
	"claude-3-opus-20240229":     "anthropic.claude-3-opus-20240229-v1:0",
	"claude-3-haiku-20240307":    "anthropic.claude-3-haiku-20240307-v1:0",
	"claude-3-5-sonnet-20240620": "anthropic.claude-3-5-sonnet-20240620-v1:0",
	"claude-3-5-sonnet-20241022": "anthropic.claude-3-5-sonnet-20241022-v2:0",
	"claude-3-5-haiku-20241022":  "anthropic.claude-3-5-haiku-20241022-v1:0",
	"claude-3-7-sonnet-20250219": "anthropic.claude-3-7-sonnet-20250219-v1:0",
	"claude-sonnet-4-20250514":   "anthropic.claude-sonnet-4-20250514-v1:0",
	"claude-opus-4-20250514":     "anthropic.claude-opus-4-20250514-v1:0",
	"claude-opus-4-1-20250805":   "anthropic.claude-opus-4-1-20250805-v1:0",
	"claude-sonnet-4-5-20250929": "anthropic.claude-sonnet-4-5-20250929-v1:0",
	"claude-haiku-4-5-20251001":  "anthropic.claude-haiku-4-5-20251001-v1:0",
	// Nova models
	"nova-micro-v1:0":   "amazon.nova-micro-v1:0",
	"nova-lite-v1:0":    "amazon.nova-lite-v1:0",
	"nova-pro-v1:0":     "amazon.nova-pro-v1:0",
	"nova-premier-v1:0": "amazon.nova-premier-v1:0",
	"nova-canvas-v1:0":  "amazon.nova-canvas-v1:0",
	"nova-reel-v1:0":    "amazon.nova-reel-v1:0",
	"nova-reel-v1:1":    "amazon.nova-reel-v1:1",
	"nova-sonic-v1:0":   "amazon.nova-sonic-v1:0",
}

// AWS Bedrock beta features support mapping
var awsBetaFeatures = map[string]bool{
	"computer-use-2024-10-22":       true,
	"computer-use-2025-01-24":       true,
	"token-efficient-tools-2025-02-19": true,
	"interleaved-thinking-2025-05-14": true,
	"output-128k-2025-02-19":        true,
	"dev-full-thinking-2025-05-14":  true,
	"context-1m-2025-08-07":         true,
	"context-management-2025-06-27": true,
}

// Beta features model compatibility
var awsBetaModelCompatibility = map[string][]string{
	"computer-use-2024-10-22": {
		"anthropic.claude-3-7-sonnet-20250219-v1:0",
	},
	"computer-use-2025-01-24": {
		"anthropic.claude-3-7-sonnet-20250219-v1:0",
	},
	"token-efficient-tools-2025-02-19": {
		"anthropic.claude-3-7-sonnet-20250219-v1:0",
		"anthropic.claude-sonnet-4-20250514-v1:0",
		"anthropic.claude-opus-4-20250514-v1:0",
		"anthropic.claude-opus-4-1-20250805-v1:0",
		"anthropic.claude-sonnet-4-5-20250929-v1:0",
		"anthropic.claude-haiku-4-5-20251001-v1:0",
	},
	"interleaved-thinking-2025-05-14": {
		"anthropic.claude-sonnet-4-20250514-v1:0",
		"anthropic.claude-opus-4-20250514-v1:0",
		"anthropic.claude-opus-4-1-20250805-v1:0",
		"anthropic.claude-sonnet-4-5-20250929-v1:0",
		"anthropic.claude-haiku-4-5-20251001-v1:0",
	},
	"output-128k-2025-02-19": {
		"anthropic.claude-3-7-sonnet-20250219-v1:0",
	},
	"dev-full-thinking-2025-05-14": {
		"anthropic.claude-sonnet-4-20250514-v1:0",
		"anthropic.claude-opus-4-20250514-v1:0",
		"anthropic.claude-opus-4-1-20250805-v1:0",
		"anthropic.claude-sonnet-4-5-20250929-v1:0",
		"anthropic.claude-haiku-4-5-20251001-v1:0",
	},
	"context-1m-2025-08-07": {
		"anthropic.claude-sonnet-4-20250514-v1:0",
	},
	"context-management-2025-06-27": {
		"anthropic.claude-sonnet-4-5-20250929-v1:0",
		"anthropic.claude-haiku-4-5-20251001-v1:0",
	},
}

var awsModelCanCrossRegionMap = map[string]map[string]bool{
	"anthropic.claude-3-sonnet-20240229-v1:0": {
		"us": true,
		"eu": true,
		"ap": true,
	},
	"anthropic.claude-3-opus-20240229-v1:0": {
		"us": true,
	},
	"anthropic.claude-3-haiku-20240307-v1:0": {
		"us": true,
		"eu": true,
		"ap": true,
	},
	"anthropic.claude-3-5-sonnet-20240620-v1:0": {
		"us": true,
		"eu": true,
		"ap": true,
	},
	"anthropic.claude-3-5-sonnet-20241022-v2:0": {
		"us": true,
		"ap": true,
	},
	"anthropic.claude-3-5-haiku-20241022-v1:0": {
		"us": true,
	},
	"anthropic.claude-3-7-sonnet-20250219-v1:0": {
		"us": true,
		"ap": true,
		"eu": true,
	},
	"anthropic.claude-sonnet-4-20250514-v1:0": {
		"us": true,
		"ap": true,
		"eu": true,
	},
	"anthropic.claude-opus-4-20250514-v1:0": {
		"us": true,
	},
	"anthropic.claude-opus-4-1-20250805-v1:0": {
		"us": true,
	},
	"anthropic.claude-sonnet-4-5-20250929-v1:0": {
		"us": true,
		"ap": true,
		"eu": true,
	},
	"anthropic.claude-haiku-4-5-20251001-v1:0": {
		"us": true,
		"ap": true,
		"eu": true,
	},
	// Nova models - all support three major regions
	"amazon.nova-micro-v1:0": {
		"us":   true,
		"eu":   true,
		"apac": true,
	},
	"amazon.nova-lite-v1:0": {
		"us":   true,
		"eu":   true,
		"apac": true,
	},
	"amazon.nova-pro-v1:0": {
		"us":   true,
		"eu":   true,
		"apac": true,
	},
	"amazon.nova-premier-v1:0": {
		"us": true,
	},
	"amazon.nova-canvas-v1:0": {
		"us":   true,
		"eu":   true,
		"apac": true,
	},
	"amazon.nova-reel-v1:0": {
		"us":   true,
		"eu":   true,
		"apac": true,
	},
	"amazon.nova-reel-v1:1": {
		"us": true,
	},
	"amazon.nova-sonic-v1:0": {
		"us":   true,
		"eu":   true,
		"apac": true,
	},
}

var awsRegionCrossModelPrefixMap = map[string]string{
	"us": "us",
	"eu": "eu",
	"ap": "apac",
}

var ChannelName = "aws"

// 判断是否为Nova模型
func isNovaModel(modelId string) bool {
	return strings.Contains(modelId, "nova-")
}

// 验证beta功能是否被支持
func isBetaFeatureSupported(betaFeature string) bool {
	return awsBetaFeatures[betaFeature]
}

// 验证beta功能与模型的兼容性
func isBetaFeatureCompatibleWithModel(betaFeature, awsModelID string) bool {
	supportedModels, exists := awsBetaModelCompatibility[betaFeature]
	if !exists {
		return false
	}

	for _, model := range supportedModels {
		if model == awsModelID {
			return true
		}
	}
	return false
}

// 验证请求中的beta功能
func validateBetaFeatures(betaFeatures []string, awsModelID string) error {
	if len(betaFeatures) == 0 {
		return nil
	}

	for _, betaFeature := range betaFeatures {
		if !isBetaFeatureSupported(betaFeature) {
			return fmt.Errorf("unsupported beta feature: %s", betaFeature)
		}

		if !isBetaFeatureCompatibleWithModel(betaFeature, awsModelID) {
			return fmt.Errorf("beta feature '%s' is not compatible with model '%s'", betaFeature, awsModelID)
		}
	}

	return nil
}
