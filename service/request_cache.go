package service

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"
	"one-api/common"
	"one-api/dto"
)

// RequestCache 请求缓存
type RequestCache struct {
	cache           map[string]*CacheEntry
	mu              sync.RWMutex
	maxSize         int
	ttl             time.Duration
	cleanupInterval time.Duration
	stopChan        chan struct{}
}

// CacheEntry 缓存条目
type CacheEntry struct {
	Response    interface{}
	Usage       *dto.Usage
	CreatedAt   time.Time
	LastAccess  time.Time
	HitCount    int64
	Size        int
}

var (
	globalRequestCache *RequestCache
	cacheOnce          sync.Once
)

// GetRequestCache 获取全局请求缓存
func GetRequestCache() *RequestCache {
	cacheOnce.Do(func() {
		globalRequestCache = NewRequestCache(
			1000,              // 最多缓存1000个请求
			5*time.Minute,     // TTL 5分钟
			1*time.Minute,     // 每分钟清理一次
		)
		globalRequestCache.Start()
	})
	return globalRequestCache
}

// NewRequestCache 创建请求缓存
func NewRequestCache(maxSize int, ttl, cleanupInterval time.Duration) *RequestCache {
	return &RequestCache{
		cache:           make(map[string]*CacheEntry),
		maxSize:         maxSize,
		ttl:             ttl,
		cleanupInterval: cleanupInterval,
		stopChan:        make(chan struct{}),
	}
}

// Start 启动缓存清理协程
func (rc *RequestCache) Start() {
	go rc.cleanupRoutine()
}

// Stop 停止缓存
func (rc *RequestCache) Stop() {
	close(rc.stopChan)
}

// GenerateCacheKey 生成缓存键
func (rc *RequestCache) GenerateCacheKey(request interface{}) (string, error) {
	// 序列化请求
	data, err := json.Marshal(request)
	if err != nil {
		return "", err
	}
	
	// 生成MD5哈希
	hasher := md5.New()
	hasher.Write(data)
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// ShouldCache 判断是否应该缓存
func (rc *RequestCache) ShouldCache(request *dto.GeneralOpenAIRequest) bool {
	// 不缓存流式请求
	if request.Stream {
		return false
	}
	
	// 不缓存包含工具调用的请求
	if len(request.Tools) > 0 || request.ToolChoice != nil {
		return false
	}
	
	// 不缓存温度大于0的请求（需要随机性）
	if request.Temperature != nil && *request.Temperature > 0 {
		return false
	}
	
	// 不缓存太大的请求
	if len(request.Messages) > 10 {
		return false
	}
	
	return true
}

// Get 获取缓存
func (rc *RequestCache) Get(key string) (interface{}, *dto.Usage, bool) {
	rc.mu.RLock()
	entry, exists := rc.cache[key]
	rc.mu.RUnlock()
	
	if !exists {
		return nil, nil, false
	}
	
	// 检查是否过期
	if time.Since(entry.CreatedAt) > rc.ttl {
		rc.mu.Lock()
		delete(rc.cache, key)
		rc.mu.Unlock()
		return nil, nil, false
	}
	
	// 更新访问信息
	rc.mu.Lock()
	entry.LastAccess = time.Now()
	entry.HitCount++
	rc.mu.Unlock()
	
	common.LogInfoAsync(nil, fmt.Sprintf("Cache hit for key: %s (hits: %d)", key, entry.HitCount))
	
	return entry.Response, entry.Usage, true
}

// Set 设置缓存
func (rc *RequestCache) Set(key string, response interface{}, usage *dto.Usage) {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	
	// 检查缓存大小限制
	if len(rc.cache) >= rc.maxSize {
		// 移除最旧的条目
		rc.evictOldest()
	}
	
	// 估算响应大小
	responseData, _ := json.Marshal(response)
	size := len(responseData)
	
	rc.cache[key] = &CacheEntry{
		Response:   response,
		Usage:      usage,
		CreatedAt:  time.Now(),
		LastAccess: time.Now(),
		HitCount:   0,
		Size:       size,
	}
	
	common.LogInfoAsync(nil, fmt.Sprintf("Cached response for key: %s (size: %d bytes)", key, size))
}

// evictOldest 移除最旧的缓存条目
func (rc *RequestCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	
	for key, entry := range rc.cache {
		if oldestKey == "" || entry.LastAccess.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.LastAccess
		}
	}
	
	if oldestKey != "" {
		delete(rc.cache, oldestKey)
	}
}

// cleanupRoutine 定期清理过期缓存
func (rc *RequestCache) cleanupRoutine() {
	ticker := time.NewTicker(rc.cleanupInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			rc.cleanup()
		case <-rc.stopChan:
			return
		}
	}
}

// cleanup 清理过期缓存
func (rc *RequestCache) cleanup() {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	
	now := time.Now()
	expiredKeys := make([]string, 0)
	
	for key, entry := range rc.cache {
		if now.Sub(entry.CreatedAt) > rc.ttl {
			expiredKeys = append(expiredKeys, key)
		}
	}
	
	for _, key := range expiredKeys {
		delete(rc.cache, key)
	}
	
	if len(expiredKeys) > 0 {
		common.LogInfoAsync(nil, fmt.Sprintf("Cleaned up %d expired cache entries", len(expiredKeys)))
	}
}

// GetStats 获取缓存统计信息
func (rc *RequestCache) GetStats() map[string]interface{} {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	
	totalSize := 0
	totalHits := int64(0)
	
	for _, entry := range rc.cache {
		totalSize += entry.Size
		totalHits += entry.HitCount
	}
	
	return map[string]interface{}{
		"entries":     len(rc.cache),
		"total_size":  totalSize,
		"total_hits":  totalHits,
		"max_size":    rc.maxSize,
		"ttl_seconds": rc.ttl.Seconds(),
	}
}

// CacheMiddleware 缓存中间件
type CacheMiddleware struct {
	cache *RequestCache
}

// NewCacheMiddleware 创建缓存中间件
func NewCacheMiddleware() *CacheMiddleware {
	return &CacheMiddleware{
		cache: GetRequestCache(),
	}
}

// CheckCache 检查缓存
func (cm *CacheMiddleware) CheckCache(request *dto.GeneralOpenAIRequest) (interface{}, *dto.Usage, bool) {
	if !cm.cache.ShouldCache(request) {
		return nil, nil, false
	}
	
	key, err := cm.cache.GenerateCacheKey(request)
	if err != nil {
		common.LogErrorAsync(nil, fmt.Sprintf("Failed to generate cache key: %v", err))
		return nil, nil, false
	}
	
	return cm.cache.Get(key)
}

// SaveToCache 保存到缓存
func (cm *CacheMiddleware) SaveToCache(request *dto.GeneralOpenAIRequest, response interface{}, usage *dto.Usage) {
	if !cm.cache.ShouldCache(request) {
		return
	}
	
	key, err := cm.cache.GenerateCacheKey(request)
	if err != nil {
		common.LogErrorAsync(nil, fmt.Sprintf("Failed to generate cache key: %v", err))
		return
	}
	
	cm.cache.Set(key, response, usage)
}