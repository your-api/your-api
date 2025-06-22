package dto

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"encoding/binary"
	"math"
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
		if decoded, err := f.parseBase64Embedding(str); err == nil && len(decoded) > 0 {
			f.data = decoded
			return nil
		}
		
		// 尝试逗号分隔的字符串
		if parsed, err := f.parseCommaSeparatedString(str); err == nil && len(parsed) > 0 {
			f.data = parsed
			return nil
		}
		
		// 尝试其他字符串格式
		if parsed, err := f.parseOtherStringFormat(str); err == nil && len(parsed) > 0 {
			f.data = parsed
			return nil
		}
		
		// 如果是空字符串，记录但不报错
		if str == "" {
			f.data = []float64{}
			return nil
		}
		
		// 记录无法解析的字符串格式，但设置为空数组以避免错误
		fmt.Printf("WARNING: 无法解析的embedding字符串格式: %s (前100字符)\n", truncateStringHelper(str, 100))
		f.data = []float64{} // 设置为空数组而不是返回错误
		return nil
	}

	// 如果既不能解析为[]float64也不能解析为字符串，返回错误
	return fmt.Errorf("无法解析embedding数据，既不是数组也不是字符串格式")
}

// truncateStringHelper 字符串截断辅助函数
func truncateStringHelper(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
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
		// 尝试URL safe base64解码
		if decoded, err = base64.URLEncoding.DecodeString(str); err != nil {
			fmt.Printf("DEBUG: Base64解码失败: %v\n", err)
			return nil, err
		}
	}
	
	fmt.Printf("DEBUG: Base64解码成功，数据长度: %d 字节\n", len(decoded))
	
	// 首先尝试将解码后的数据作为JSON解析
	var jsonResult []float64
	if err := json.Unmarshal(decoded, &jsonResult); err == nil && len(jsonResult) > 0 {
		fmt.Printf("DEBUG: JSON解析成功，数组长度: %d\n", len(jsonResult))
		return jsonResult, nil
	}
	
	// 启发式处理：尝试跳过可能的头部信息
	for offset := 0; offset < min(len(decoded), 16); offset++ {
		if (len(decoded)-offset)%4 == 0 && len(decoded)-offset >= 4 {
			fmt.Printf("DEBUG: 尝试从偏移量 %d 开始解析float32 (剩余: %d 字节)\n", offset, len(decoded)-offset)
			if binaryResult32, err := f.parseBinaryFloat32ArrayWithOffset(decoded, offset); err == nil && len(binaryResult32) > 0 {
				// 转换float32到float64
				result := make([]float64, len(binaryResult32))
				for i, v := range binaryResult32 {
					result[i] = float64(v)
				}
				fmt.Printf("DEBUG: 二进制float32解析成功(偏移量%d)，数组长度: %d\n", offset, len(result))
				return result, nil
			}
		}
		
		if (len(decoded)-offset)%8 == 0 && len(decoded)-offset >= 8 {
			fmt.Printf("DEBUG: 尝试从偏移量 %d 开始解析float64 (剩余: %d 字节)\n", offset, len(decoded)-offset)
			if binaryResult64, err := f.parseBinaryFloat64ArrayWithOffset(decoded, offset); err == nil && len(binaryResult64) > 0 {
				fmt.Printf("DEBUG: 二进制float64解析成功(偏移量%d)，数组长度: %d\n", offset, len(binaryResult64))
				return binaryResult64, nil
			}
		}
	}
	
	// 如果JSON解析失败，尝试将其作为二进制float32数组解析（更常见）
	if binaryResult32, err := f.parseBinaryFloat32Array(decoded); err == nil && len(binaryResult32) > 0 {
		// 转换float32到float64
		result := make([]float64, len(binaryResult32))
		for i, v := range binaryResult32 {
			result[i] = float64(v)
		}
		fmt.Printf("DEBUG: 二进制float32解析成功，数组长度: %d\n", len(result))
		return result, nil
	}
	
	// 如果float32解析失败，尝试将其作为二进制float64数组解析
	if binaryResult, err := f.parseBinaryFloat64Array(decoded); err == nil && len(binaryResult) > 0 {
		fmt.Printf("DEBUG: 二进制float64解析成功，数组长度: %d\n", len(binaryResult))
		return binaryResult, nil
	}
	
	// 最后尝试作为文本处理（逗号分隔等）
	if textResult, err := f.parseCommaSeparatedString(string(decoded)); err == nil && len(textResult) > 0 {
		fmt.Printf("DEBUG: 文本解析成功，数组长度: %d\n", len(textResult))
		return textResult, nil
	}
	
	fmt.Printf("DEBUG: 所有解析方法都失败了\n")
	return nil, fmt.Errorf("无法解析base64编码的embedding数据，长度: %d", len(decoded))
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

// parseBinaryFloat64Array 解析二进制float64数组
func (f *FlexibleEmbedding) parseBinaryFloat64Array(data []byte) ([]float64, error) {
	// 确保数据长度是8的倍数(float64是8字节)
	if len(data)%8 != 0 {
		return nil, fmt.Errorf("二进制数据长度不是8的倍数: %d", len(data))
	}
	
	numFloats := len(data) / 8
	result := make([]float64, numFloats)
	
	for i := 0; i < numFloats; i++ {
		// 尝试little-endian解析
		bits := binary.LittleEndian.Uint64(data[i*8 : (i+1)*8])
		value := math.Float64frombits(bits)
		
		// 检查是否为有效的float64值
		if math.IsNaN(value) || math.IsInf(value, 0) {
			// 如果little-endian失败，尝试big-endian
			bits = binary.BigEndian.Uint64(data[i*8 : (i+1)*8])
			value = math.Float64frombits(bits)
			if math.IsNaN(value) || math.IsInf(value, 0) {
				return nil, fmt.Errorf("解析到无效的float64值在位置 %d", i)
			}
		}
		
		result[i] = value
	}
	
	return result, nil
}

// parseBinaryFloat32Array 解析二进制float32数组
func (f *FlexibleEmbedding) parseBinaryFloat32Array(data []byte) ([]float32, error) {
	// 确保数据长度是4的倍数(float32是4字节)
	if len(data)%4 != 0 {
		fmt.Printf("DEBUG: float32二进制数据长度不是4的倍数: %d\n", len(data))
		return nil, fmt.Errorf("二进制数据长度不是4的倍数: %d", len(data))
	}
	
	numFloats := len(data) / 4
	fmt.Printf("DEBUG: 尝试解析 %d 个float32值\n", numFloats)
	result := make([]float32, numFloats)
	validValues := 0
	
	for i := 0; i < numFloats; i++ {
		// 尝试little-endian解析
		bits := binary.LittleEndian.Uint32(data[i*4 : (i+1)*4])
		value := math.Float32frombits(bits)
		
		// 检查是否为有效的float32值
		if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
			// 如果little-endian失败，尝试big-endian
			bits = binary.BigEndian.Uint32(data[i*4 : (i+1)*4])
			value = math.Float32frombits(bits)
			if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
				// 跳过无效值而不是立即返回错误
				fmt.Printf("DEBUG: 跳过无效的float32值在位置 %d\n", i)
				continue
			}
		}
		
		result[i] = value
		validValues++
		
		// 只显示前几个值的调试信息
		if i < 5 {
			fmt.Printf("DEBUG: float32[%d] = %f\n", i, value)
		}
	}
	
	if validValues == 0 {
		return nil, fmt.Errorf("没有找到有效的float32值")
	}
	
	fmt.Printf("DEBUG: 成功解析 %d/%d 个有效float32值\n", validValues, numFloats)
	return result[:validValues], nil
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

// parseBinaryFloat32ArrayWithOffset 从指定偏移量开始解析二进制float32数组
func (f *FlexibleEmbedding) parseBinaryFloat32ArrayWithOffset(data []byte, offset int) ([]float32, error) {
	if offset >= len(data) {
		return nil, fmt.Errorf("偏移量超出数据范围")
	}
	
	return f.parseBinaryFloat32Array(data[offset:])
}

// parseBinaryFloat64ArrayWithOffset 从指定偏移量开始解析二进制float64数组
func (f *FlexibleEmbedding) parseBinaryFloat64ArrayWithOffset(data []byte, offset int) ([]float64, error) {
	if offset >= len(data) {
		return nil, fmt.Errorf("偏移量超出数据范围")
	}
	
	return f.parseBinaryFloat64Array(data[offset:])
}

// min 返回两个整数的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
