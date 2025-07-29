package service

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"one-api/common"
	"one-api/dto"
	"sync"
)

// LargeRequestOptimizer 大请求优化器
type LargeRequestOptimizer struct {
	threshold      int    // 触发优化的请求大小阈值（字节）
	bufferPool     *sync.Pool
	gzipWriterPool *sync.Pool
}

var (
	globalRequestOptimizer *LargeRequestOptimizer
	optimizerOnce          sync.Once
)

// GetLargeRequestOptimizer 获取全局大请求优化器
func GetLargeRequestOptimizer() *LargeRequestOptimizer {
	optimizerOnce.Do(func() {
		globalRequestOptimizer = NewLargeRequestOptimizer(50 * 1024) // 50KB阈值
	})
	return globalRequestOptimizer
}

// NewLargeRequestOptimizer 创建大请求优化器
func NewLargeRequestOptimizer(threshold int) *LargeRequestOptimizer {
	return &LargeRequestOptimizer{
		threshold: threshold,
		bufferPool: &sync.Pool{
			New: func() interface{} {
				return new(bytes.Buffer)
			},
		},
		gzipWriterPool: &sync.Pool{
			New: func() interface{} {
				return gzip.NewWriter(nil)
			},
		},
	}
}

// OptimizeRequest 优化请求
func (lro *LargeRequestOptimizer) OptimizeRequest(request interface{}) (io.Reader, int, error) {
	// 获取缓冲区
	buf := lro.bufferPool.Get().(*bytes.Buffer)
	defer func() {
		buf.Reset()
		lro.bufferPool.Put(buf)
	}()

	// 序列化请求
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal request: %w", err)
	}

	originalSize := len(jsonData)
	
	// 如果请求较小，直接返回
	if originalSize < lro.threshold {
		return bytes.NewReader(jsonData), originalSize, nil
	}

	// 对于大请求，尝试优化
	optimized, err := lro.optimizeJSONData(jsonData)
	if err != nil {
		common.LogError(nil, fmt.Sprintf("Failed to optimize request: %v", err))
		return bytes.NewReader(jsonData), originalSize, nil
	}

	optimizedSize := len(optimized)
	if optimizedSize < originalSize {
		common.LogInfo(nil, fmt.Sprintf("Request optimized: %d -> %d bytes (%.1f%% reduction)", 
			originalSize, optimizedSize, float64(originalSize-optimizedSize)/float64(originalSize)*100))
		return bytes.NewReader(optimized), optimizedSize, nil
	}

	return bytes.NewReader(jsonData), originalSize, nil
}

// optimizeJSONData 优化JSON数据
func (lro *LargeRequestOptimizer) optimizeJSONData(data []byte) ([]byte, error) {
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return data, err
	}

	// 优化工具定义
	if tools, ok := obj["tools"].([]interface{}); ok && len(tools) > 30 {
		obj["tools"] = lro.optimizeTools(tools)
	}

	// 移除不必要的空白字符
	return json.Marshal(obj)
}

// optimizeTools 优化工具定义
func (lro *LargeRequestOptimizer) optimizeTools(tools []interface{}) []interface{} {
	optimized := make([]interface{}, 0, len(tools))
	
	for _, tool := range tools {
		if toolMap, ok := tool.(map[string]interface{}); ok {
			// 简化工具描述
			if desc, ok := toolMap["description"].(string); ok && len(desc) > 200 {
				toolMap["description"] = desc[:197] + "..."
			}
			
			// 简化参数描述
			if function, ok := toolMap["function"].(map[string]interface{}); ok {
				if params, ok := function["parameters"].(map[string]interface{}); ok {
					lro.simplifyParameters(params)
				}
			}
		}
		optimized = append(optimized, tool)
	}
	
	return optimized
}

// simplifyParameters 简化参数定义
func (lro *LargeRequestOptimizer) simplifyParameters(params map[string]interface{}) {
	if properties, ok := params["properties"].(map[string]interface{}); ok {
		for _, prop := range properties {
			if propMap, ok := prop.(map[string]interface{}); ok {
				// 简化属性描述
				if desc, ok := propMap["description"].(string); ok && len(desc) > 100 {
					propMap["description"] = desc[:97] + "..."
				}
			}
		}
	}
}

// StreamingBuffer 流式缓冲区
type StreamingBuffer struct {
	chunks     [][]byte
	totalSize  int
	maxSize    int
	mu         sync.Mutex
}

// NewStreamingBuffer 创建流式缓冲区
func NewStreamingBuffer(maxSize int) *StreamingBuffer {
	return &StreamingBuffer{
		chunks:  make([][]byte, 0, 100),
		maxSize: maxSize,
	}
}

// Write 写入数据
func (sb *StreamingBuffer) Write(data []byte) error {
	sb.mu.Lock()
	defer sb.mu.Unlock()
	
	if sb.totalSize+len(data) > sb.maxSize {
		return fmt.Errorf("buffer size exceeded: %d + %d > %d", sb.totalSize, len(data), sb.maxSize)
	}
	
	chunk := make([]byte, len(data))
	copy(chunk, data)
	sb.chunks = append(sb.chunks, chunk)
	sb.totalSize += len(data)
	
	return nil
}

// ReadAll 读取所有数据
func (sb *StreamingBuffer) ReadAll() []byte {
	sb.mu.Lock()
	defer sb.mu.Unlock()
	
	result := make([]byte, 0, sb.totalSize)
	for _, chunk := range sb.chunks {
		result = append(result, chunk...)
	}
	
	return result
}

// Reset 重置缓冲区
func (sb *StreamingBuffer) Reset() {
	sb.mu.Lock()
	defer sb.mu.Unlock()
	
	sb.chunks = sb.chunks[:0]
	sb.totalSize = 0
}

// RequestSizeMonitor 请求大小监控器
type RequestSizeMonitor struct {
	largeRequestThreshold int
	warningThreshold      int
}

// NewRequestSizeMonitor 创建请求大小监控器
func NewRequestSizeMonitor() *RequestSizeMonitor {
	return &RequestSizeMonitor{
		largeRequestThreshold: 50 * 1024,  // 50KB
		warningThreshold:      100 * 1024, // 100KB
	}
}

// CheckRequestSize 检查请求大小
func (rsm *RequestSizeMonitor) CheckRequestSize(request *dto.GeneralOpenAIRequest, size int) {
	if size > rsm.warningThreshold {
		common.LogWarning(nil, fmt.Sprintf("Very large request detected: %d bytes, model: %s, messages: %d, tools: %d",
			size, request.Model, len(request.Messages), len(request.Tools)))
		
		// 记录详细信息帮助分析
		if len(request.Tools) > 20 {
			common.LogInfo(nil, fmt.Sprintf("Large number of tools: %d", len(request.Tools)))
		}
		
		if request.MaxTokens > 10000 {
			common.LogInfo(nil, fmt.Sprintf("High max_tokens: %d", request.MaxTokens))
		}
	} else if size > rsm.largeRequestThreshold {
		common.LogInfo(nil, fmt.Sprintf("Large request: %d bytes, model: %s", size, request.Model))
	}
}