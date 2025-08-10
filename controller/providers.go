package controller

import (
	"encoding/json"
	"net/http"
	"one-api/common"

	"github.com/gin-gonic/gin"
)

// GetModelProviders returns the list of model providers for the homepage
func GetModelProviders(c *gin.Context) {
	// Default providers
	defaultProviders := []map[string]interface{}{
		{
			"id":      "全部",
			"name":    "全部",
			"icon":    "/models/all.png",
			"includes": []string{},
		},
		{
			"id":      "OpenAI",
			"name":    "OpenAI",
			"icon":    "/models/openai1.png",
			"includes": []string{
				"gpt-4o-mini", "o3", "gpt-4o", "gpt-3.5-turbo", "gpt-3.5-turbo-instruct",
				"gpt-4.1", "gpt-4.1-2025-04-14", "gpt-4.1-mini", "gpt-4.1-mini-2025-04-14",
				"gpt-4.5-preview", "gpt-4.5-preview-2025-02-27", "gpt-4o-2024-11-20",
				"gpt-4o-audio-preview", "gpt-4o-audio-preview-2024-10-01", "gpt-4o-mini-2024-07-18",
				"gpt-4o-mini-realtime-preview", "gpt-4o-mini-realtime-preview-2024-12-17",
				"gpt-4o-mini-search-preview", "gpt-4o-realtime-preview", "gpt-4o-realtime-preview-2024-10-01",
				"gpt-4o-realtime-preview-2024-12-17", "gpt-image-1", "chatgpt-4o-latest",
				"o3-2025-04-16", "o3-mini", "o3-mini-2025-01-31", "o3-mini-2025-01-31-high",
				"o3-mini-2025-01-31-low", "o3-mini-2025-01-31-medium", "o3-mini-high",
				"o3-mini-low", "o3-mini-medium", "o3-pro", "o3-pro-2025-06-10",
				"o4-mini", "o4-mini-2025-04-16", "text-ada-001", "text-babbage-001",
				"text-davinci-edit-001", "text-embedding-3-large", "text-embedding-3-small",
				"text-embedding-ada-002", "text-embedding-v1", "text-moderation-latest",
				"text-moderation-stable", "text-embedding-004", "text-curie-001",
				"gpt-4-1106-preview", "gpt-4-0613", "gpt-4-0125-preview",
				"azure:o4-mini", "azure:gpt-4o", "azure:o3", "azure:gpt-4o-mini",
				"azure:gpt-3.5-turbo", "azure:gpt-4.1", "azure:gpt-4.1-mini",
				"azure:gpt-4.1-nano", "azure:gpt-4o-2024-11-20",
				"discount:gpt-3.5-turbo", "discount:gpt-4.1", "discount:gpt-4.1-mini",
				"discount:gpt-4.1-nano", "discount:gpt-4.5-preview", "discount:gpt-4.5-preview-2025-02-27",
				"discount:gpt-4o", "discount:gpt-4o-2024-11-20", "discount:gpt-4o-mini",
				"discount:o4-mini", "mix:gpt-3.5-turbo", "mix:gpt-4.1", "mix:gpt-4.1-mini",
				"mix:gpt-4.1-nano", "mix:gpt-4.5-preview", "mix:gpt-4.5-preview-2025-02-27",
				"mix:gpt-4o", "mix:gpt-4o-2024-11-20", "mix:gpt-4o-mini",
				"official:o3", "official:gpt-3.5-turbo", "official:gpt-4.1",
				"official:gpt-4.1-mini", "official:gpt-4.1-nano", "official:gpt-4o",
				"official:gpt-4o-2024-11-20", "official:gpt-4o-mini", "official:o4-mini",
				"official:o4-mini-high", "discount:o3", "mix:o3", "mix:o3-pro",
				"discount:o3-pro", "o4-mini-low-thinking", "o4-mini-medium-thinking",
				"o4-mini-high-thinking", "o3-low-thinking", "o3-medium-thinking",
				"o3-high-thinking", "o4-mini-deep-research-thinking", "o3-deep-research-thinking",
				"o4-mini-deep-research", "o3-deep-research",
			},
		},
		{
			"id":      "OpenAI逆向",
			"name":    "OpenAI逆向",
			"icon":    "/models/openai2.png",
			"includes": []string{
				"reverse:o3-pro-all", "reverse:gpt-4o-image-vip", "reverse:gpt-4.1-all",
				"reverse:gpt-4o-all", "reverse:o1-pro-all", "reverse:o3-all",
				"reverse:o4-mini-high-all", "reverse:o4-mini-deepresearch", "reverse:openai-deepresearch",
				"gpt-4o-all", "gpt-4o-image-vip", "o4-mini-high-all", "o4-mini-deepresearch",
				"o3-all", "o1-pro-all", "openai-deepresearch", "o1-all", "gpt-4.1-all",
				"o3-mini-all", "o3-mini-high-all", "o1-mini-all", "o1-preview-all",
			},
		},
		{
			"id":      "Claude",
			"name":    "Claude",
			"icon":    "/models/claude.jpeg",
			"includes": []string{
				"claude-neptune-v3", "claude-neptune-v3-thinking", "claude-sonnet-4-20250514",
				"claude-3-7-sonnet-20250219", "claude-opus-4-20250514", "claude-sonnet-4-20250514-thinking",
				"claude-3-7-sonnet-20250219-thinking", "claude-3-5-sonnet-20240620",
				"claude-3-5-sonnet-20241022", "claude-opus-4-20250514-thinking",
				"claudecode:claude-sonnet-4-20250514", "claudecode:claude-opus-4-20250514-thinking",
				"claudecode:claude-opus-4-20250514", "claudecode:claude-3-7-sonnet-thinking",
				"claudecode:claude-3-7-sonnet-20250219", "claudecode:claude-3-5-haiku-20241022",
				"azure:claude-3-7-sonnet-20250219", "azure:claude-sonnet-4-20250514",
				"awsmix:claude-3-5-sonnet-20240620", "awsmix:claude-3-5-sonnet-20241022",
				"awsmix:claude-3-7-sonnet-20250219", "awsmix:claude-3-7-sonnet-20250219-thinking",
				"awsmix:claude-3-7-sonnet-thinking", "awsmix:claude-3-opus-20240229",
				"awsmix:claude-sonnet-4-20250514", "awsmix:claude-sonnet-4-20250514-thinking",
				"awsmix:claude-opus-4-20250514", "awsmix:claude-opus-4-20250514-thinking",
				"awsmix:claude-3-5-haiku-20241022", "aws:claude-3-5-sonnet-20240620",
				"aws:claude-3-5-sonnet-20241022", "aws:claude-3-7-sonnet-20250219",
				"aws:claude-3-7-sonnet-20250219-thinking", "aws:claude-opus-4-20250514",
				"aws:claude-opus-4-20250514-thinking", "aws:claude-sonnet-4-20250514",
				"aws:claude-sonnet-4-20250514-thinking", "discount:claude-3-7-sonnet-20250219",
				"discount:claude-sonnet-4-20250514", "discount:claude-sonnet-4-20250514-thinking",
				"discount:claude-opus-4-20250514", "discount:claude-3-7-sonnet-20250219-thinking",
				"discount:claude-opus-4-20250514-thinking",
			},
		},
		{
			"id":      "DeepSeek",
			"name":    "DeepSeek",
			"icon":    "/models/deepseek.png",
			"includes": []string{
				"deepseek-v3-250324", "deepseek-r1-250528", "deepseek", "deepseek-r1-searching",
				"deepseek-chat", "deepseek-coder", "deepseek-reasoner", "deepseek-r1-2025-01-20",
				"deepseek-r1", "deepseek-v3",
			},
		},
		{
			"id":      "谷歌(Gemini)",
			"name":    "谷歌(Gemini)",
			"icon":    "/models/gemini.svg",
			"includes": []string{
				"gemini-2.5-pro-all", "free:gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash",
				"gemini-2.0-flash-exp-image-generation", "gemini-2.0-flash-lite-preview-02-05",
				"gemini-2.0-flash-thinking-exp-01-21", "gemini-2.5-pro-preview-05-06",
				"gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.5-pro-exp-03-25",
				"gemini-2.5-pro-preview-03-25", "gemini-2.5-flash-preview-04-17",
				"gemini-2.5-flash-preview-05-2", "gemini-2.5-flash-preview-05-20",
				"gemini-exp-1206", "gemini-2.5-pro-preview-06-05", "gemini-2.5-flash-lite-preview-06-17",
				"gemini-2.5-pro", "discount:gemini-2.5-flash-lite-preview-06-17",
				"discount:gemini-2.5-pro", "gemini-embedding-exp-03-07",
				"discount:gemini-2.5-pro-preview-06-05", "discount:gemini-1.5-flash",
				"discount:gemini-1.5-flash-8b", "discount:gemini-1.5-flash-latest",
				"discount:gemini-1.5-pro", "discount:gemini-1.5-pro-latest",
				"discount:gemini-2.0-flash", "discount:gemini-2.0-flash-exp-image-generation",
				"discount:gemini-2.0-flash-lite-preview", "discount:gemini-2.0-flash-lite-preview-02-05",
				"discount:gemini-2.0-flash-thinking-exp", "discount:gemini-2.0-flash-thinking-exp-01-21",
				"discount:gemini-2.5-flash-preview-04-17", "discount:gemini-2.5-flash-preview-05-2",
				"discount:gemini-2.5-flash-preview-05-20", "discount:gemini-exp-1206",
				"official:gemini-2.5-flash-preview-05-2", "official:gemini-2.5-pro-preview-05-06",
				"discount:imagen-3.0-generate-002",
			},
		},
		{
			"id":      "Grok",
			"name":    "Grok",
			"icon":    "/models/grok.png",
			"includes": []string{
				"reverse:grok-4-pro", "x-ai/grok-4", "x-ai/grok-4-07-09", "reverse:grok-4",
				"grok-3-all", "grok-3-reasoner-all", "grok-3-deepsearch-all", "grok-3-deepersearch-all",
				"grok", "grok-beta", "grok-2-1212", "grok-3", "grok-3-reasoner",
				"grok-3-deepsearch", "grok-3-reasoning", "grok-3-beta", "grok-3-fast-beta",
				"grok-3-mini-beta", "grok-3-mini-fast-beta", "grok-3-deepersearch", "grok-3-image",
			},
		},
		{
			"id":      "智普",
			"name":    "智普",
			"icon":    "/models/zhipu.png",
			"includes": []string{
				"cc:glm4.5", "glm-4.5", "glm", "glm-3-turbo", "glm-4",
				"glm-4-long", "glm-4-airx", "glm-4-air", "glm-4-flash",
			},
		},
		{
			"id":      "阿里",
			"name":    "阿里",
			"icon":    "/models/ali.png",
			"includes": []string{
				"qwen3-235b-a22b-instruct-2507-fp8", "qwq", "qwen", "qwq-32b", "qwen-plus",
				"qwen-turbo", "qwen-max", "qwen-max-2025-01-25", "qwen-vl-max",
				"qwen2.5-32b-instruct", "qwen2.5-72b-instruct", "qwen2.5-7b-instruct",
				"qwen-turbo-2024-11-01", "qwq-32b-preview", "qwen-qwq-32b", "qvq-72b-preview",
				"qwen-max-latest", "qwen-plus-latest", "qwen-turbo-1101", "qwq-plus-latest",
				"qvq-72b-preview-0310", "qwen3-32b", "qwen3-30b-a3b", "qwen3-235b-a22b",
				"qwen3-235b-a22b-think", "qwen3-30b-a3b-think", "qwen2.5-vl-72b-instruct",
				"qwen2.5-vl-32b-instruct", "qwen-vl-plus", "qwen-omni-turbo", "qwq-72b-preview",
				"qwq-plus",
			},
		},
		{
			"id":      "其他",
			"name":    "其他",
			"icon":    "/models/other.webp",
			"includes": []string{
				"reverse:veo3-pro", "reverse:veo3-pro-frames",
			},
		},
	}

	// Try to get providers from options
	providersStr := common.OptionMap["Providers"]
	if providersStr != "" {
		var providers []map[string]interface{}
		err := json.Unmarshal([]byte(providersStr), &providers)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    providers,
			})
			return
		}
	}
	
	// Return default providers if not found or parsing failed
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    defaultProviders,
	})
}

// GetAdvantages returns the advantages list for the homepage
func GetAdvantages(c *gin.Context) {
	// Try to get advantages from options
	advantagesStr := common.OptionMap["Advantages"]
	if advantagesStr != "" {
		var advantages []map[string]interface{}
		err := json.Unmarshal([]byte(advantagesStr), &advantages)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    advantages,
			})
			return
		}
	}

	// Default advantages
	advantages := []map[string]interface{}{
		{
			"id":          1,
			"title":       "多模型支持",
			"description": "支持OpenAI、Claude、Gemini等主流AI模型",
			"icon":        "fa-robot",
			"color":       "#1890ff",
		},
		{
			"id":          2,
			"title":       "高性能架构",
			"description": "采用高性能架构设计，响应速度快",
			"icon":        "fa-rocket",
			"color":       "#52c41a",
		},
		{
			"id":          3,
			"title":       "灵活计费",
			"description": "支持按量计费，灵活充值使用",
			"icon":        "fa-coins",
			"color":       "#faad14",
		},
		{
			"id":          4,
			"title":       "简单易用",
			"description": "接口兼容OpenAI，一键切换无需改代码",
			"icon":        "fa-plug",
			"color":       "#722ed1",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    advantages,
	})
}

// GetTypingList returns the typing animation text list for the homepage
func GetTypingList(c *gin.Context) {
	// Try to get typing list from options
	typingListStr := common.OptionMap["TypingList"]
	if typingListStr != "" {
		var typingList []string
		err := json.Unmarshal([]byte(typingListStr), &typingList)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    typingList,
			})
			return
		}
	}

	// Default typing list
	typingList := []string{
		"体验极速与稳定的强悍性能",
		"享受高性价比带来的非凡魅力",
		"尽在我们为您精心打造的优质服务",
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    typingList,
	})
}

// GetCustomNavLinks returns custom navigation links
func GetCustomNavLinks(c *gin.Context) {
	// Try to get custom nav links from options
	navLinksStr := common.OptionMap["CustomNavLinks"]
	if navLinksStr != "" {
		var navLinks []map[string]interface{}
		err := json.Unmarshal([]byte(navLinksStr), &navLinks)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    navLinks,
			})
			return
		}
	}

	// Return empty array if not set
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    []map[string]interface{}{},
	})
}

// GetDiscountTiers returns discount tiers configuration
func GetDiscountTiers(c *gin.Context) {
	// Try to get discount tiers from options
	discountTiersStr := common.OptionMap["DiscountTiers"]
	if discountTiersStr != "" {
		var discountTiers []map[string]interface{}
		err := json.Unmarshal([]byte(discountTiersStr), &discountTiers)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    discountTiers,
			})
			return
		}
	}

	// Default discount tiers
	discountTiers := []map[string]interface{}{
		{
			"min_amount":  6.8,
			"rate":        1,
			"expire_time": 1249949956,
		},
		{
			"min_amount":  10,
			"rate":        0.99,
			"expire_time": 1249949956,
		},
		{
			"min_amount":  99,
			"rate":        0.98,
			"expire_time": 1249949956,
		},
		{
			"min_amount":  199,
			"rate":        0.97,
			"expire_time": 1249949956,
		},
		{
			"min_amount":  499,
			"rate":        0.96,
			"expire_time": 1249949956,
		},
		{
			"min_amount":  999,
			"rate":        0.95,
			"expire_time": 1249949956,
		},
		{
			"min_amount":  1999,
			"rate":        0.94,
			"expire_time": 1249949956,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    discountTiers,
	})
}

// GetModelDescriptions returns model descriptions
func GetModelDescriptions(c *gin.Context) {
	// Try to get model descriptions from options
	modelDescStr := common.OptionMap["ModelDescriptions"]
	if modelDescStr != "" {
		var modelDesc map[string]string
		err := json.Unmarshal([]byte(modelDescStr), &modelDesc)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"message": "",
				"data":    modelDesc,
			})
			return
		}
	}

	// Return empty object if not set
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    map[string]string{},
	})
}