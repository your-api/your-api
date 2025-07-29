package service

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// ConnectionPoolManager 连接池管理器
type ConnectionPoolManager struct {
	pools           map[string]*HostConnectionPool
	mu              sync.RWMutex
	maxConnsPerHost int
	maxIdleTime     time.Duration
}

// HostConnectionPool 单个主机的连接池
type HostConnectionPool struct {
	host            string
	activeConns     int64
	maxConns        int
	semaphore       chan struct{}
	lastAccessTime  time.Time
	mu              sync.Mutex
}

var (
	globalPoolManager *ConnectionPoolManager
	poolManagerOnce   sync.Once
)

// GetConnectionPoolManager 获取全局连接池管理器
func GetConnectionPoolManager() *ConnectionPoolManager {
	poolManagerOnce.Do(func() {
		globalPoolManager = NewConnectionPoolManager(200, 5*time.Minute)
		// 启动清理协程
		go globalPoolManager.cleanupRoutine()
	})
	return globalPoolManager
}

// NewConnectionPoolManager 创建连接池管理器
func NewConnectionPoolManager(maxConnsPerHost int, maxIdleTime time.Duration) *ConnectionPoolManager {
	return &ConnectionPoolManager{
		pools:           make(map[string]*HostConnectionPool),
		maxConnsPerHost: maxConnsPerHost,
		maxIdleTime:     maxIdleTime,
	}
}

// AcquireConnection 获取连接许可
func (cpm *ConnectionPoolManager) AcquireConnection(ctx context.Context, host string) error {
	pool := cpm.getOrCreatePool(host)
	
	select {
	case <-ctx.Done():
		return ctx.Err()
	case pool.semaphore <- struct{}{}:
		atomic.AddInt64(&pool.activeConns, 1)
		pool.updateLastAccess()
		return nil
	}
}

// ReleaseConnection 释放连接许可
func (cpm *ConnectionPoolManager) ReleaseConnection(host string) {
	cpm.mu.RLock()
	pool, exists := cpm.pools[host]
	cpm.mu.RUnlock()
	
	if exists && pool != nil {
		select {
		case <-pool.semaphore:
			atomic.AddInt64(&pool.activeConns, -1)
		default:
			// 防止panic，如果通道已满则忽略
		}
	}
}

// getOrCreatePool 获取或创建主机连接池
func (cpm *ConnectionPoolManager) getOrCreatePool(host string) *HostConnectionPool {
	cpm.mu.RLock()
	pool, exists := cpm.pools[host]
	cpm.mu.RUnlock()
	
	if exists {
		return pool
	}
	
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	
	// 双重检查
	if pool, exists = cpm.pools[host]; exists {
		return pool
	}
	
	pool = &HostConnectionPool{
		host:           host,
		maxConns:       cpm.maxConnsPerHost,
		semaphore:      make(chan struct{}, cpm.maxConnsPerHost),
		lastAccessTime: time.Now(),
	}
	cpm.pools[host] = pool
	
	return pool
}

// updateLastAccess 更新最后访问时间
func (hcp *HostConnectionPool) updateLastAccess() {
	hcp.mu.Lock()
	hcp.lastAccessTime = time.Now()
	hcp.mu.Unlock()
}

// cleanupRoutine 定期清理空闲连接池
func (cpm *ConnectionPoolManager) cleanupRoutine() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		cpm.cleanup()
	}
}

// cleanup 清理空闲的连接池
func (cpm *ConnectionPoolManager) cleanup() {
	cpm.mu.Lock()
	defer cpm.mu.Unlock()
	
	now := time.Now()
	for host, pool := range cpm.pools {
		pool.mu.Lock()
		activeConns := atomic.LoadInt64(&pool.activeConns)
		idleTime := now.Sub(pool.lastAccessTime)
		pool.mu.Unlock()
		
		// 如果没有活跃连接且空闲时间超过阈值，删除池
		if activeConns == 0 && idleTime > cpm.maxIdleTime {
			delete(cpm.pools, host)
		}
	}
}

// GetPoolStats 获取连接池统计信息
func (cpm *ConnectionPoolManager) GetPoolStats() map[string]interface{} {
	cpm.mu.RLock()
	defer cpm.mu.RUnlock()
	
	stats := make(map[string]interface{})
	stats["total_pools"] = len(cpm.pools)
	
	poolDetails := make([]map[string]interface{}, 0)
	for host, pool := range cpm.pools {
		poolDetails = append(poolDetails, map[string]interface{}{
			"host":         host,
			"active_conns": atomic.LoadInt64(&pool.activeConns),
			"max_conns":    pool.maxConns,
		})
	}
	stats["pools"] = poolDetails
	
	return stats
}

// ConnectionLimitedTransport 带连接限制的Transport
type ConnectionLimitedTransport struct {
	Base        http.RoundTripper
	PoolManager *ConnectionPoolManager
}

// RoundTrip 实现RoundTripper接口
func (t *ConnectionLimitedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	host := req.URL.Host
	
	// 获取连接许可
	ctx := req.Context()
	if err := t.PoolManager.AcquireConnection(ctx, host); err != nil {
		return nil, fmt.Errorf("failed to acquire connection: %w", err)
	}
	
	// 确保释放连接
	defer t.PoolManager.ReleaseConnection(host)
	
	// 执行实际请求
	return t.Base.RoundTrip(req)
}