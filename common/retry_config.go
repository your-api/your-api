package common

import (
	"fmt"
	"math/rand"
)

// RetryConfig 重试配置结构
type RetryConfig struct {
	MaxRetryTimes      int  // 最大重试次数
	EnableCyclicRetry  bool // 是否启用循环重试
	RetryAllPriorities bool // 是否尝试所有优先级的渠道
}

// GetRetryConfig 获取当前的重试配置
func GetRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetryTimes:      MaxRetryTimes,
		EnableCyclicRetry:  EnableCyclicRetry,
		RetryAllPriorities: RetryAllPriorities,
	}
}

// GetEffectiveMaxRetryTimes 获取有效的最大重试次数
func GetEffectiveMaxRetryTimes() int {
	if RetryTimes > 0 {
		// 如果设置了传统的RetryTimes，使用它作为最大值
		return RetryTimes
	}
	return MaxRetryTimes
}

// ShouldUseCyclicRetry 判断是否应该使用循环重试
func ShouldUseCyclicRetry() bool {
	return EnableCyclicRetry
}

// ShouldRetryAllPriorities 判断是否应该尝试所有优先级
func ShouldRetryAllPriorities() bool {
	return RetryAllPriorities
}

// CalculateRetryIndex 计算重试时的优先级索引
// 如果启用了循环重试，使用模运算；否则限制在优先级数量内
func CalculateRetryIndex(retryCount int, priorityCount int) int {
	if priorityCount == 0 {
		return 0
	}
	
	if EnableCyclicRetry {
		// 使用模运算实现循环
		return retryCount % priorityCount
	} else {
		// 不循环，限制在最后一个优先级
		if retryCount >= priorityCount {
			return priorityCount - 1
		}
		return retryCount
	}
}

// ShuffleChannels 对同优先级的渠道进行随机排序，实现负载均衡
// 使用Fisher-Yates洗牌算法
// 注意：此函数使用Go 1.18+的泛型语法，如果使用较老版本的Go，请使用下面的非泛型版本
func ShuffleChannels[T any](slice []T) {
	for i := len(slice) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		slice[i], slice[j] = slice[j], slice[i]
	}
}

// GetRetryLogMessage 生成重试日志消息
func GetRetryLogMessage(retryCount int, priorityIndex int, totalPriorities int) string {
	if EnableCyclicRetry && retryCount >= totalPriorities {
		cycle := retryCount / totalPriorities
		return fmt.Sprintf("重试 #%d (第%d轮循环, 优先级索引: %d/%d)", 
			retryCount, cycle+1, priorityIndex, totalPriorities-1)
	}
	return fmt.Sprintf("重试 #%d (优先级索引: %d/%d)", 
		retryCount, priorityIndex, totalPriorities-1)
} 