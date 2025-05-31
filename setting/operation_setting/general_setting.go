package operation_setting

import (
	"encoding/json"
	"one-api/common/event"
	"one-api/setting/config"
	"sync"
)

type GeneralSetting struct {
	DocsLink            string `json:"docs_link"`
	PingIntervalEnabled bool   `json:"ping_interval_enabled"`
	PingIntervalSeconds int    `json:"ping_interval_seconds"`
}

type ModelProvider struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Icon     string   `json:"icon"`
	Includes []string `json:"includes"`
}

type AdvantagesModel struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
}

type ModelDescription struct {
	ModelName   string `json:"model_name"`
	Description string `json:"description"`
}

type DiscountTier struct {
	MinAmount float64 `json:"min_amount"`
	Rate      float64 `json:"rate"`
}

// 默认配置
var generalSetting = GeneralSetting{
	DocsLink:            "https://openai.apifox.cn",
	PingIntervalEnabled: false,
	PingIntervalSeconds: 60,
}

// 导航栏配置
type CustomNavLink struct {
	Text    string `json:"text"`
	ItemKey string `json:"item_key"`
	URL     string `json:"url"`
}

var (
	CustomNavLinks = []CustomNavLink{
		{Text: "自定义导航(可配置)", ItemKey: "自定义导航(可配置)", URL: "/setting?tab=operation"},
		{Text: "同款搭建", ItemKey: "同款搭建", URL: "https://github.com/your-api/your-api.git"},
	}
)

var (
	Providers = []ModelProvider{
		{ID: "全部", Name: "全部", Icon: "/models/all.png", Includes: []string{}},
		{ID: "OpenAI", Name: "OpenAI", Icon: "/models/openai1.png", Includes: []string{"gpt", "gpt-4.5-preview", "gpt-4.5-preview-2025-02-27", "o3", "o3-2025-04-16", "o3-mini", "o3-mini-2025-01-31", "o1", "o1-2024-12-17", "o4-mini", "o4-mini-2025-04-16", "o1-mini", "o1-mini-2024-09-12", "o1-preview", "o1-preview-2024-09-12", "chatgpt-4o-latest", "gpt-4.1-2025-04-14", "gpt-4o", "gpt-image-1", "gpt-4.1-mini-2025-04-14", "gpt-4o-2024-05-13", "gpt-4.1-nano-2025-04-14", "gpt-4o-2024-08-06", "gpt-4o-2024-11-20", "gpt-4o-mini", "gpt-4o-mini-2024-07-18", "gpt-4-turbo", "gpt-4o-transcribe", "gpt-4-turbo-2024-04-09", "gpt-4o-mini-transcribe", "dall-e-3", "gpt-4o-audio-preview-2024-10-01", "gpt-4o-realtime-preview", "gpt-4o-realtime-preview-2024-10-01", "gpt-4-vision-preview", "gpt-4o-audio-preview", "gpt-4o-audio-preview-2024-12-17", "gpt-4-1106-preview", "gpt-4-0125-preview", "gpt-4-turbo-preview", "gpt-4", "gpt-4-0613", "gpt-4-0314", "gpt-4-32k", "gpt-4-32k-0613", "gpt-3.5-turbo", "gpt-3.5-turbo-0613", "gpt-3.5-turbo-1106", "gpt-3.5-turbo-0125", "gpt-3.5-turbo-instruct", "gpt-3.5-turbo-16k", "gpt-3.5-turbo-16k-0613", "tts-1", "tts-1-1106", "tts-1-hd", "tts-1-hd-1106", "whisper-1", "babbage-002", "davinci-002", "text-ada-001", "text-embedding-ada-002", "text-embedding-3-small", "text-embedding-3-large", "text-davinci-edit-001", "text-curie-001", "gpt-4-32K-0613", "gpt-3.5-turbo-instruct-0914", "text-babbage-001", "text-moderation-latest", "text-moderation-stable", "gpt-4.5-preview", "gpt-4.5-preview-2025-02-27", "o3", "o3-2025-04-16", "o3-mini", "o3-mini-2025-01-31", "o1", "o1-2024-12-17", "o4-mini", "o4-mini-2025-04-16", "o1-mini", "o1-mini-2024-09-12", "o1-preview", "o1-preview-2024-09-12", "chatgpt-4o-latest", "gpt-4.1-2025-04-14", "gpt-4o", "gpt-image-1", "gpt-4.1-mini-2025-04-14", "gpt-4o-2024-05-13", "gpt-4.1-nano-2025-04-14", "gpt-4o-2024-08-06", "gpt-4o-2024-11-20", "gpt-4o-mini", "gpt-4o-mini-2024-07-18", "gpt-4-turbo", "gpt-4o-transcribe", "gpt-4-turbo-2024-04-09", "gpt-4o-mini-transcribe", "dall-e-3", "gpt-4o-audio-preview-2024-10-01", "gpt-4o-realtime-preview", "gpt-4o-realtime-preview-2024-10-01", "gpt-4-vision-preview", "gpt-4o-audio-preview", "gpt-4o-audio-preview-2024-12-17", "gpt-4-1106-preview", "gpt-4-0125-preview", "gpt-4-turbo-preview", "gpt-4", "gpt-4-0613", "gpt-4-0314", "gpt-4-32k", "gpt-4-32k-0613", "gpt-3.5-turbo", "gpt-3.5-turbo-0613", "gpt-3.5-turbo-1106", "gpt-3.5-turbo-0125", "gpt-3.5-turbo-instruct", "gpt-3.5-turbo-16k", "gpt-3.5-turbo-16k-0613", "tts-1", "tts-1-1106", "tts-1-hd", "tts-1-hd-1106", "whisper-1", "babbage-002", "davinci-002", "text-ada-001", "text-embedding-ada-002", "text-embedding-3-small", "text-embedding-3-large", "text-davinci-edit-001", "text-curie-001", "gpt-4-32K-0613", "gpt-3.5-turbo-instruct-0914", "text-babbage-001", "text-moderation-latest", "text-moderation-stable", "o1-all", "o1-pro-all", "o3-mini-all", "o3-mini-high-all", "gpt-image-1-all", "gpt-4-gizmo-*", "gpt-4-all", "gpt-4o-all", "gpt-4o-search-preview-2025-03-11", "o1-mini-all", "o1-preview-all", "gpt-4o-image-vip", "sora_image"}},
		{ID: "Claude", Name: "Claude", Icon: "/models/claude.jpeg", Includes: []string{"claude", "claude-3-7-sonnet-20250219-thinking", "claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20240620", "claude-3-5-sonnet-20241022", "claude-3-5-sonnet-latest", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307", "claude-3-sonnet-20240229", "claude-3-opus-20240229", "claude-3-5-sonnet-all"}},
		{ID: "DeepSeek", Name: "DeepSeek", Icon: "/models/deepseek.png", Includes: []string{"deepseek", "deepseek-r1-searching", "deepseek-chat", "deepseek-coder", "deepseek-reasoner", "deepseek-r1-2025-01-20", "deepseek-v3-250324", "deepseek-r1", "deepseek-v3"}},
		{ID: "谷歌(Gemini)", Name: "谷歌(Gemini)", Icon: "/models/gemini.svg", Includes: []string{"gemini", "gemini-2.0-flash", "gemini-2.0-flash-exp-image-generation", "gemini-2.0-flash-lite-preview-02-05", "gemini-2.0-pro-exp-02-05", "gemini-2.0-flash-lite", "gemini-2.0-flash-thinking-exp", "gemini-2.0-flash-thinking-exp-01-21", "gemini-2.0-flash-thinking-exp-1219", "gemini-2.0-flash-exp", "gemini-2.5-pro-preview-05-06", "gemini-2.5-pro-preview-05-06-nothinking", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro-001", "gemini-1.5-pro-002", "gemini-1.5-flash-latest", "gemini-1.5-pro-latest", "gemini-1.5-flash-002", "gemini-2.5-pro-exp-03-25", "gemini-2.5-pro-preview-03-25", "gemini-2.5-flash-preview-04-17"}},
		{ID: "Grok", Name: "Grok", Icon: "/models/grok.png", Includes: []string{"grok", "grok-beta", "grok-2-1212", "grok-3", "grok-3-reasoner", "grok-3-deepsearch", "grok-3-reasoning", "grok-3-beta", "grok-3-fast-beta", "grok-3-mini-beta", "grok-3-mini-fast-beta", "grok-3-deepersearch", "grok-3-image"}},
		{ID: "阿里", Name: "阿里", Icon: "/models/ali.png", Includes: []string{"qwq", "qwen", "qwq-32b", "qwen-plus", "qwen-turbo", "qwen-max", "qwen-max-2025-01-25", "qwen-vl-max", "qwen2.5-32b-instruct", "qwen2.5-72b-instruct", "qwen2.5-7b-instruct", "qwen-turbo-2024-11-01", "qwq-32b-preview", "qwen-qwq-32b", "qvq-72b-preview", "qwen-max-latest", "qwen-plus-latest", "qwen-turbo-1101", "qwq-plus-latest", "qvq-72b-preview-0310", "qwen3-32b", "qwen3-30b-a3b", "qwen3-235b-a22b", "qwen3-235b-a22b-think", "qwen3-30b-a3b-think", "qwen2.5-vl-72b-instruct", "qwen2.5-vl-32b-instruct", "qwen-vl-plus", "qwen-omni-turbo", "qwq-72b-preview", "qwq-plus"}},
		{ID: "智普", Name: "智普", Icon: "/models/zhipu.png", Includes: []string{"glm", "glm-3-turbo", "glm-4", "glm-4-long", "glm-4-airx", "glm-4-air", "glm-4-flash"}},
		{ID: "豆包", Name: "豆包", Icon: "/models/doubao.png", Includes: []string{"doubao", "doubao-1-5-pro-256k-250115", "doubao-1-5-pro-32k-250115", "doubao-1.5-pro-32k", "doubao-1.5-vision-pro-32k", "doubao-pro-32k-241215", "doubao-1-5-lite-32k-250115", "doubao-1-5-vision-pro-32k-250115", "doubao-1-5-thinking-pro-250415", "doubao-1-5-thinking-pro-m-250415", "doubao-1-5-vision-pro-250328", "doubao-1-5-thinking-vision-pro-250428"}},
		{ID: "Midjourney", Name: "Midjourney", Icon: "/models/mj.png", Includes: []string{"mj", "mj_uploads", "mj_blend", "mj_custom_zoom", "mj_describe", "mj_high_variation", "mj_imagine", "mj_inpaint", "mj_low_variation", "mj_modal", "mj_pan", "mj_reroll", "mj_shorten", "mj_upload", "mj_upscale", "mj_variation", "mj_zoom", "swap_face"}},
		{ID: "Suno", Name: "Suno", Icon: "/models/suno.png", Includes: []string{"suno", "suno_music", "suno_lyrics"}},
		{ID: "luma", Name: "Kling", Icon: "/models/luma.png", Includes: []string{"luma", "luma-video", "luma_video_api", "luma_video_extend_api"}},
		{ID: "Kling", Name: "Kling", Icon: "/models/keling.png", Includes: []string{"kling", "kling-video_std_5", "kling-image", "kling-video_std_10", "kling-video_pro_5", "kling-video_pro_10"}},
		{ID: "Ideogram", Name: "Ideogram", Icon: "/models/ideo.svg", Includes: []string{"ideogram"}},
		{ID: "Flux", Name: "Flux", Icon: "/models/flux.png", Includes: []string{"flux"}},
		{ID: "Coze", Name: "Coze", Icon: "/models/coze.jpeg", Includes: []string{"coze"}},
		{ID: "Runway", Name: "Runway", Icon: "/models/runway.png", Includes: []string{"runway"}},
		{ID: "Moonshot", Name: "Moonshot", Icon: "/models/moon.webp", Includes: []string{"moonshot"}},
		{ID: "udio", Name: "udio", Icon: "/models/udio.png", Includes: []string{"udio"}},
		{ID: "百度(Baidu)", Name: "百度(Baidu)", Icon: "/models/baidu.png", Includes: []string{"ernie", "ERNIE-4.0-8K", "ERNIE-Lite-8K-0308", "ERNIE-Lite-8K-0922", "ERNIE-Speed-128K", "ERNIE-Speed-8K", "ERNIE-3.5-8K"}},
		{ID: "零一万物", Name: "零一万物", Icon: "/models/lingyi.png", Includes: []string{"yi-", "yi-lightning", "yi-large", "yi-large-rag", "yi-large-turbo", "yi-vision", "yi-medium-200k"}},
		{ID: "讯飞星火", Name: "讯飞星火", Icon: "/models/xufei.png", Includes: []string{"Spark", "SparkDesk", "SparkDesk-v1.1", "SparkDesk-v2.1", "SparkDesk-v3.1", "SparkDesk-v3.5"}},
		{ID: "LangChain", Name: "LangChain", Icon: "/models/langchaine.png", Includes: []string{"langchain"}},
		{ID: "腾讯混元", Name: "腾讯混元", Icon: "/models/hunyuan.png", Includes: []string{"hunyuan"}},
		{ID: "Llama", Name: "Llama", Icon: "/models/llama.jpeg", Includes: []string{"llama", "llama-2-13b", "llama-2-70b", "llama-3.1-405b", "llama-3.1-405b-instruct", "llama-3-sonar-large-32k-chat", "llama-3-sonar-small-32k-chat", "meta-llama/llama-4-scout", "meta-llama/llama-4-maverick"}},
		{ID: "Stable-Diffusion", Name: "Stable-Diffusion", Icon: "/models/sd.png", Includes: []string{"sd", "stable-", "stable-diffusion", "stable-diffusion-3-2b", "stable-diffusion-xl-1024-v1-0", "sd3.5-large", "sd3.5-large-turbo", "sd3.5-medium"}},
		{ID: "其他", Name: "其他", Icon: "/models/other.webp", Includes: []string{}},
	}
	providersListMutex = sync.RWMutex{}
)

var (
	Advantages = []AdvantagesModel{
		{ID: "1", Title: "稳定快速", Description: "全球多机房API部署，API将会最近节点到达，为您的客户提高响应速度", Icon: "fa-star", Color: "rgb(147, 36, 244)"},
		{ID: "2", Title: "低价费率", Description: "相对于市面的费率，我们的价格至少优惠30%及以上，帮助您节省成本", Icon: "fa-car", Color: "rgb(74, 108, 241)"},
		{ID: "3", Title: "高效集成", Description: "提供完整的文档和SDK，支持快速和便捷地对接开发", Icon: "fa-plug", Color: "rgb(76, 175, 80)"},
		{ID: "4", Title: "高度安全", Description: "通过TLS加密及多层防护，保障数据传输安全", Icon: "fa-lock", Color: "rgb(244, 67, 54)"},
		{ID: "5", Title: "灵活扩展", Description: "API支持多种扩展模式，满足从初创到企业级的需求", Icon: "fa-expand", Color: "rgb(33, 150, 243)"},
		{ID: "6", Title: "实时监控", Description: "提供完善的API使用监控和报表，确保服务质量", Icon: "fa-chart-bar", Color: "rgb(255, 152, 0)"},
		{ID: "7", Title: "多语言支持", Description: "支持多种语言和地区化，轻松服务全球客户", Icon: "fa-language", Color: "rgb(103, 58, 183)"},
		{ID: "8", Title: "弹性计费", Description: "根据使用量动态计费，帮助企业轻松控制预算", Icon: "fa-balance-scale", Color: "rgb(0, 150, 136)"},
		{ID: "9", Title: "技术支持", Description: "提供全天候的技术支持，快速解决问题，减少停机时间", Icon: "fa-headset", Color: "rgb(255, 87, 34)"},
		{ID: "10", Title: "高可用性", Description: "基于容错架构设计，确保API能承载高流量请求", Icon: "fa-check-circle", Color: "rgb(63, 81, 181)"},
	}
	advantageListMutex = sync.RWMutex{}
)

var (
	DiscountTiers = []DiscountTier{
		{MinAmount: 3, Rate: 0.99},    // 满 3 元享 9.9 折 —— “3 元套餐”，极低门槛，强刺激初次尝试
		{MinAmount: 10, Rate: 0.98},   // 满 10 元享 9.8 折 —— “10 元套餐”，小额加购引导
		{MinAmount: 99, Rate: 0.97},   // 满 99 元享 9.6 折 —— “不到百元”尾数定价
		{MinAmount: 199, Rate: 0.95},  // 满 199 元享 9.4 折 —— 中档跃层，省幅度明显
		{MinAmount: 499, Rate: 0.93},  // 满 499 元享 9.2 折 —— 大额门槛＋锁定高客单
		{MinAmount: 999, Rate: 0.91},  // 满 999 元享 9 折 —— 最高折扣，锚定最优价值
		{MinAmount: 1999, Rate: 0.89}, // 满 1999 元享 89 折 —— 最高折扣，锚定最优价值
	}
	discountTiersMutex = sync.RWMutex{}
)

var (
	ModelDescriptions = map[string]string{
		"gpt-4o-mini": "GPT-4o-Mini是OpenAI最新推出的多模态模型，支持文本、图像和音频输入，适用于多种应用场景。",
		"gpt-4o":      "GPT-4o是OpenAI最新推出的多模态模型，支持文本、图像和音频输入，适用于多种应用场景。",
	}
	modelDescriptionsMutex = sync.RWMutex{}
)

var (
	TypingList = []string{
		"赶上这趟列车",
		"开启AI新体验",
		"全面支持主流模型",
		"高性能 高颜值",
		"一站式AI解决方案",
		"可在控制台-系统设置中配置",
	}
	typingListMutex = sync.RWMutex{}
)

var (
	imageReadProxy      = ""
	imageReadProxyMutex = sync.RWMutex{}
)

func GetDiscountRateForOrder(amount float64) float64 {
	// 按金额从小到大排序（确保逻辑正确）
	//sort.Slice(DiscountTiers, func(i, j int) bool {
	//	return DiscountTiers[i].MinAmount > DiscountTiers[j].MinAmount
	//})

	for i := len(DiscountTiers) - 1; i >= 0; i-- {
		tier := DiscountTiers[i]
		if amount >= tier.MinAmount {
			return tier.Rate
		}
	}
	return 1.0 // 无折扣
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("general_setting", &generalSetting)
}

func GetCustomNavLinks() []CustomNavLink {
	return CustomNavLinks
}

func GetDiscountTiers() []DiscountTier {
	return DiscountTiers
}

func UpdateDiscountTiers(jsonStr string) error {
	discountTiersMutex.Lock()
	defer discountTiersMutex.Unlock()

	// 创建临时变量
	var newDiscountTiers []DiscountTier

	// 反序列化到临时变量
	err := json.Unmarshal([]byte(jsonStr), &newDiscountTiers)
	if err != nil {
		return err
	}

	// 更新全局变量
	DiscountTiers = newDiscountTiers
	return nil
}

func UpdateCustomNavLinks(jsonStr string) error {
	providersListMutex.Lock()
	defer providersListMutex.Unlock()

	// 创建临时变量
	var newCustomNavLinks []CustomNavLink

	// 反序列化到临时变量
	err := json.Unmarshal([]byte(jsonStr), &newCustomNavLinks)
	if err != nil {
		return err
	}

	// 更新全局变量
	CustomNavLinks = newCustomNavLinks
	return nil
}

func GetGeneralSetting() *GeneralSetting {
	return &generalSetting
}

func UpdateProviders(jsonStr string) error {
	providersListMutex.Lock()
	defer providersListMutex.Unlock()

	// 创建临时变量
	var newProviders []ModelProvider

	// 反序列化到临时变量
	err := json.Unmarshal([]byte(jsonStr), &newProviders)
	if err != nil {
		return err
	}

	// 更新全局变量
	Providers = newProviders
	return nil
}

func UpdateAdvantages(jsonStr string) error {
	advantageListMutex.Lock()
	defer advantageListMutex.Unlock()

	// 创建临时变量
	var newAdvantages []AdvantagesModel

	// 反序列化到临时变量
	err := json.Unmarshal([]byte(jsonStr), &newAdvantages)
	if err != nil {
		return err
	}

	// 更新全局变量
	Advantages = newAdvantages
	return nil
}

func GetProviders() []ModelProvider {
	return Providers
}

func GetAdvantages() []AdvantagesModel {
	return Advantages
}

func GetTypingList() []string {
	return TypingList
}

func UpdateTypingList(jsonStr string) error {
	typingListMutex.Lock()
	defer typingListMutex.Unlock()

	// 创建临时变量
	var newAdvantages []string

	// 反序列化到临时变量
	err := json.Unmarshal([]byte(jsonStr), &newAdvantages)
	if err != nil {
		return err
	}

	// 更新全局变量
	TypingList = newAdvantages
	return nil
}

func GetModelDescriptionsByID(modelID string) string {
	modelDescriptionsMutex.RLock()
	defer modelDescriptionsMutex.RUnlock()

	// 获取模型描述
	description, exists := ModelDescriptions[modelID]
	if !exists {
		return ""
	}
	return description
}

func GetModelDescriptions() map[string]string {
	return ModelDescriptions
}

func UpdateModelDescriptions(jsonStr string) error {
	typingListMutex.Lock()
	defer typingListMutex.Unlock()

	// 创建临时变量
	var newDescriptions map[string]string

	// 反序列化到临时变量
	err := json.Unmarshal([]byte(jsonStr), &newDescriptions)
	if err != nil {
		return err
	}

	// 更新全局变量
	ModelDescriptions = newDescriptions
	go func() {
		event.Publish(event.ModelDescriptionsUpdated, newDescriptions)
	}()

	return nil
}

func GetImageReadProxy() string {
	return imageReadProxy
}

func UpdateImageReadProxy(jsonStr string) error {
	imageReadProxyMutex.Lock()
	defer imageReadProxyMutex.Unlock()

	// 更新全局变量
	imageReadProxy = jsonStr

	return nil
}
