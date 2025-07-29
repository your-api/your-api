package common

import (
	"fmt"
	"sync"
	"time"
)

// AsyncLogger 异步日志记录器
type AsyncLogger struct {
	logChannel chan LogEntry
	bufferSize int
	flushInterval time.Duration
	wg         sync.WaitGroup
	stopChan   chan struct{}
}

// LogEntry 日志条目
type LogEntry struct {
	Level     string
	Message   string
	Context   interface{}
	Timestamp time.Time
}

var (
	asyncLogger     *AsyncLogger
	asyncLoggerOnce sync.Once
)

// GetAsyncLogger 获取全局异步日志记录器
func GetAsyncLogger() *AsyncLogger {
	asyncLoggerOnce.Do(func() {
		asyncLogger = NewAsyncLogger(10000, 100*time.Millisecond)
		asyncLogger.Start()
	})
	return asyncLogger
}

// NewAsyncLogger 创建异步日志记录器
func NewAsyncLogger(bufferSize int, flushInterval time.Duration) *AsyncLogger {
	return &AsyncLogger{
		logChannel:    make(chan LogEntry, bufferSize),
		bufferSize:    bufferSize,
		flushInterval: flushInterval,
		stopChan:      make(chan struct{}),
	}
}

// Start 启动异步日志处理
func (al *AsyncLogger) Start() {
	al.wg.Add(1)
	go al.processLogs()
}

// Stop 停止异步日志处理
func (al *AsyncLogger) Stop() {
	close(al.stopChan)
	al.wg.Wait()
	close(al.logChannel)
}

// processLogs 处理日志
func (al *AsyncLogger) processLogs() {
	defer al.wg.Done()
	
	ticker := time.NewTicker(al.flushInterval)
	defer ticker.Stop()
	
	batch := make([]LogEntry, 0, 100)
	
	for {
		select {
		case entry, ok := <-al.logChannel:
			if !ok {
				al.flushBatch(batch)
				return
			}
			batch = append(batch, entry)
			
			// 批量达到一定大小时立即刷新
			if len(batch) >= 100 {
				al.flushBatch(batch)
				batch = batch[:0]
			}
			
		case <-ticker.C:
			// 定期刷新
			if len(batch) > 0 {
				al.flushBatch(batch)
				batch = batch[:0]
			}
			
		case <-al.stopChan:
			// 刷新剩余日志
			al.flushBatch(batch)
			return
		}
	}
}

// flushBatch 批量写入日志
func (al *AsyncLogger) flushBatch(batch []LogEntry) {
	if len(batch) == 0 {
		return
	}
	
	// 批量写入日志
	for _, entry := range batch {
		switch entry.Level {
		case "INFO":
			LogInfo(entry.Context, entry.Message)
		case "ERROR":
			LogError(entry.Context, entry.Message)
		case "WARNING":
			LogWarning(entry.Context, entry.Message)
		case "DEBUG":
			if DebugEnabled {
				LogDebug(entry.Context, entry.Message)
			}
		}
	}
}

// LogAsync 异步记录日志
func (al *AsyncLogger) LogAsync(level string, context interface{}, message string) {
	select {
	case al.logChannel <- LogEntry{
		Level:     level,
		Message:   message,
		Context:   context,
		Timestamp: time.Now(),
	}:
		// 成功加入队列
	default:
		// 队列满时直接记录，避免阻塞
		switch level {
		case "ERROR":
			LogError(context, "Log queue full! "+message)
		default:
			// 其他级别的日志可以丢弃
		}
	}
}

// LogInfoAsync 异步记录信息日志
func LogInfoAsync(context interface{}, message string) {
	GetAsyncLogger().LogAsync("INFO", context, message)
}

// LogErrorAsync 异步记录错误日志
func LogErrorAsync(context interface{}, message string) {
	GetAsyncLogger().LogAsync("ERROR", context, message)
}

// LogWarningAsync 异步记录警告日志
func LogWarningAsync(context interface{}, message string) {
	GetAsyncLogger().LogAsync("WARNING", context, message)
}

// LogDebugAsync 异步记录调试日志
func LogDebugAsync(context interface{}, message string) {
	if DebugEnabled {
		GetAsyncLogger().LogAsync("DEBUG", context, message)
	}
}

// RequestLogger 请求日志优化器
type RequestLogger struct {
	skipLargeRequests bool
	maxLogSize        int
}

// NewRequestLogger 创建请求日志记录器
func NewRequestLogger() *RequestLogger {
	return &RequestLogger{
		skipLargeRequests: true,
		maxLogSize:        1024, // 1KB
	}
}

// LogRequest 记录请求（优化版）
func (rl *RequestLogger) LogRequest(context interface{}, method, path string, body []byte) {
	if rl.skipLargeRequests && len(body) > rl.maxLogSize {
		// 对于大请求，只记录摘要信息
		LogInfoAsync(context, fmt.Sprintf("%s %s - Request size: %d bytes (content omitted)", 
			method, path, len(body)))
	} else {
		// 小请求可以记录完整内容
		LogInfoAsync(context, fmt.Sprintf("%s %s - Body: %s", 
			method, path, string(body)))
	}
}

// PerformanceLogger 性能日志记录器
type PerformanceLogger struct {
	thresholds map[string]time.Duration
	mu         sync.RWMutex
}

// NewPerformanceLogger 创建性能日志记录器
func NewPerformanceLogger() *PerformanceLogger {
	return &PerformanceLogger{
		thresholds: map[string]time.Duration{
			"api_request":  5 * time.Second,
			"db_query":     1 * time.Second,
			"cache_lookup": 100 * time.Millisecond,
		},
	}
}

// LogPerformance 记录性能指标
func (pl *PerformanceLogger) LogPerformance(operation string, duration time.Duration, context interface{}) {
	pl.mu.RLock()
	threshold, exists := pl.thresholds[operation]
	pl.mu.RUnlock()
	
	if !exists {
		threshold = 1 * time.Second // 默认阈值
	}
	
	// 只有超过阈值的操作才记录
	if duration > threshold {
		LogWarningAsync(context, fmt.Sprintf("Slow operation '%s': %v (threshold: %v)", 
			operation, duration, threshold))
	} else if DebugEnabled {
		LogDebugAsync(context, fmt.Sprintf("Operation '%s' completed in %v", 
			operation, duration))
	}
}