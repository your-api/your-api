package dto

import (
	"encoding/base64"
	"encoding/json"
	"strconv"
	"strings"
)

type EmbeddingOptions struct {
	Seed             int      `json:"seed,omitempty"`
	Temperature      *float64 `json:"temperature,omitempty"`
	TopK             int      `json:"top_k,omitempty"`
	TopP             *float64 `json:"top_p,omitempty"`
	FrequencyPenalty *float64 `json:"frequency_penalty,omitempty"`
	PresencePenalty  *float64 `json:"presence_penalty,omitempty"`
	NumPredict       int      `json:"num_predict,omitempty"`
	NumCtx           int      `json:"num_ctx,omitempty"`
}

type EmbeddingRequest struct {
	Model            string   `json:"model"`
	Input            any      `json:"input"`
	EncodingFormat   string   `json:"encoding_format,omitempty"`
	Dimensions       int      `json:"dimensions,omitempty"`
	User             string   `json:"user,omitempty"`
	Seed             float64  `json:"seed,omitempty"`
	Temperature      *float64 `json:"temperature,omitempty"`
	TopP             float64  `json:"top_p,omitempty"`
	FrequencyPenalty float64  `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64  `json:"presence_penalty,omitempty"`
}

func (r EmbeddingRequest) ParseInput() []string {
	if r.Input == nil {
		return nil
	}
	var input []string
	switch r.Input.(type) {
	case string:
		input = []string{r.Input.(string)}
	case []any:
		input = make([]string, 0, len(r.Input.([]any)))
		for _, item := range r.Input.([]any) {
			if str, ok := item.(string); ok {
				input = append(input, str)
			}
		}
	}
	return input
}

// FlexibleEmbedding 支持多种格式的embedding数据
// 这个结构体解决了不同AI服务商返回不同格式embedding数据的问题：
// 1. 标准格式：[]float64 数组
// 2. Base64编码格式：字符串形式的base64编码数据
// 3. 逗号分隔格式：字符串形式的逗号分隔数值
// 4. JSON字符串格式：字符串形式的JSON数组
//
// 使用示例：
//   var embedding FlexibleEmbedding
//   // 自动处理各种格式
//   embedding.UnmarshalJSON(jsonData)
//   // 获取标准化的[]float64数据
//   floatArray := embedding.GetData()
type FlexibleEmbedding struct {
	data []float64
}

// UnmarshalJSON 自定义JSON反序列化，支持[]float64, string(base64), string(逗号分隔)等格式
func (f *FlexibleEmbedding) UnmarshalJSON(data []byte) error {
	// 尝试解析为[]float64
	var floatSlice []float64
	if err := json.Unmarshal(data, &floatSlice); err == nil {
		f.data = floatSlice
		return nil
	}

	// 尝试解析为字符串
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		// 尝试base64解码
		if decoded, err := f.parseBase64Embedding(str); err == nil {
			f.data = decoded
			return nil
		}
		
		// 尝试逗号分隔的字符串
		if parsed, err := f.parseCommaSeparatedString(str); err == nil {
			f.data = parsed
			return nil
		}
		
		// 尝试其他字符串格式
		if parsed, err := f.parseOtherStringFormat(str); err == nil {
			f.data = parsed
			return nil
		}
	}

	return json.Unmarshal(data, &floatSlice)
}

// MarshalJSON 序列化为[]float64格式
func (f *FlexibleEmbedding) MarshalJSON() ([]byte, error) {
	return json.Marshal(f.data)
}

// GetData 获取embedding数据
func (f *FlexibleEmbedding) GetData() []float64 {
	return f.data
}

// parseBase64Embedding 解析base64编码的embedding数据
func (f *FlexibleEmbedding) parseBase64Embedding(str string) ([]float64, error) {
	decoded, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return nil, err
	}
	
	// 假设每个float64是8字节
	if len(decoded)%8 != 0 {
		return nil, json.Unmarshal(decoded, &[]float64{})
	}
	
	var result []float64
	// 这里可以根据实际情况调整解析逻辑
	return result, json.Unmarshal(decoded, &result)
}

// parseCommaSeparatedString 解析逗号分隔的字符串
func (f *FlexibleEmbedding) parseCommaSeparatedString(str string) ([]float64, error) {
	parts := strings.Split(str, ",")
	result := make([]float64, 0, len(parts))
	
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		
		val, err := strconv.ParseFloat(part, 64)
		if err != nil {
			return nil, err
		}
		result = append(result, val)
	}
	
	return result, nil
}

// parseOtherStringFormat 解析其他字符串格式
func (f *FlexibleEmbedding) parseOtherStringFormat(str string) ([]float64, error) {
	// 尝试JSON数组字符串
	var result []float64
	if err := json.Unmarshal([]byte(str), &result); err == nil {
		return result, nil
	}
	
	// 可以在这里添加其他格式的解析逻辑
	return nil, json.Unmarshal([]byte(str), &result)
}

type EmbeddingResponseItem struct {
	Object    string             `json:"object"`
	Index     int                `json:"index"`
	Embedding FlexibleEmbedding  `json:"embedding"`
}

// GetEmbedding 获取embedding数据的便捷方法
func (e *EmbeddingResponseItem) GetEmbedding() []float64 {
	return e.Embedding.GetData()
}

type EmbeddingResponse struct {
	Object string                  `json:"object"`
	Data   []EmbeddingResponseItem `json:"data"`
	Model  string                  `json:"model"`
	Usage  `json:"usage"`
}
