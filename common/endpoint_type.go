package common

// EndpointType 端点类型定义
type EndpointType string

const (
	EndpointTypeOpenAI          EndpointType = "openai"
	EndpointTypeOpenAIResponse  EndpointType = "openai-response"
	EndpointTypeAnthropic       EndpointType = "anthropic"
	EndpointTypeGemini          EndpointType = "gemini"
	EndpointTypeJinaRerank      EndpointType = "jina-rerank"
	EndpointTypeImageGeneration EndpointType = "image-generation"
	//EndpointTypeMidjourney     EndpointType = "midjourney-proxy"
	//EndpointTypeSuno           EndpointType = "suno-proxy"
	//EndpointTypeKling          EndpointType = "kling"
	//EndpointTypeJimeng         EndpointType = "jimeng"
)

// GetEndpointTypesByChannelType 获取渠道最优先端点类型（所有的渠道都支持 OpenAI 端点）
func GetEndpointTypesByChannelType(channelType int, modelName string) []EndpointType {
	switch channelType {
	case ChannelTypeOpenAI:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeAzure:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeAnthropic:
		return []EndpointType{EndpointTypeAnthropic, EndpointTypeOpenAI}
	case ChannelTypeGemini:
		return []EndpointType{EndpointTypeGemini, EndpointTypeOpenAI}
	case ChannelTypeJina:
		// Jina 支持重排序和嵌入
		return []EndpointType{EndpointTypeJinaRerank, EndpointTypeOpenAI}
	case ChannelTypeBaidu, ChannelTypeBaiduV2:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeZhipu, ChannelTypeZhipu_v4:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeAli:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeXunfei:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeTencent:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeOllama:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypePerplexity:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeAws:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeCohere:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeDify:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeSiliconFlow:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeVertexAi:
		return []EndpointType{EndpointTypeGemini, EndpointTypeOpenAI}
	case ChannelTypeMistral:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeDeepSeek:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeMokaAI:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeVolcEngine:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeOpenRouter:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeXinference:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeXai:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeCoze:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeMoonshot:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeLingYiWanWu:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypeMiniMax:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelType360:
		return []EndpointType{EndpointTypeOpenAI}
	case ChannelTypePaLM:
		return []EndpointType{EndpointTypeGemini, EndpointTypeOpenAI}
	default:
		// 默认支持 OpenAI 端点
		return []EndpointType{EndpointTypeOpenAI}
	}
} 