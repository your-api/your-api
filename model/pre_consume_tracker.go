package model

import (
	"fmt"
	"one-api/logger"
	"sync"
	"time"
	"gorm.io/gorm"
)

// PreConsumedQuotaTracker 用于追踪预扣费并自动恢复丢失的额度
type PreConsumedQuotaTracker struct {
	mu      sync.RWMutex
	records map[string]*PreConsumedRecord
	running bool
}

// PreConsumedRecord 预扣费记录
type PreConsumedRecord struct {
	RequestID        string
	UserID           int
	TokenID          int
	PreConsumedQuota int
	Timestamp        int64
	Returned         bool
}

var quotaTracker *PreConsumedQuotaTracker

// InitPreConsumedQuotaTracker 初始化预扣费追踪器
func InitPreConsumedQuotaTracker() {
	quotaTracker = &PreConsumedQuotaTracker{
		records: make(map[string]*PreConsumedRecord),
		running: true,
	}
	go quotaTracker.cleanupExpiredRecords()
}

// RecordPreConsume 记录预扣费
func RecordPreConsume(requestID string, userID, tokenID, quota int) {
	if quotaTracker == nil {
		return
	}
	
	quotaTracker.mu.Lock()
	defer quotaTracker.mu.Unlock()
	
	quotaTracker.records[requestID] = &PreConsumedRecord{
		RequestID:        requestID,
		UserID:           userID,
		TokenID:          tokenID,
		PreConsumedQuota: quota,
		Timestamp:        time.Now().Unix(),
		Returned:         false,
	}
	
	logger.LogInfo(nil, fmt.Sprintf("记录预扣费: RequestID=%s, UserID=%d, Quota=%d", 
		requestID, userID, quota))
}

// MarkAsReturned 标记预扣费已返还
func MarkAsReturned(requestID string) {
	if quotaTracker == nil {
		return
	}
	
	quotaTracker.mu.Lock()
	defer quotaTracker.mu.Unlock()
	
	if record, exists := quotaTracker.records[requestID]; exists {
		record.Returned = true
		logger.LogInfo(nil, fmt.Sprintf("标记预扣费已返还: RequestID=%s", requestID))
	}
}

// MarkAsConsumed 标记预扣费已正常消费（删除记录）
func MarkAsConsumed(requestID string) {
	if quotaTracker == nil {
		return
	}
	
	quotaTracker.mu.Lock()
	defer quotaTracker.mu.Unlock()
	
	delete(quotaTracker.records, requestID)
	logger.LogInfo(nil, fmt.Sprintf("预扣费已正常消费: RequestID=%s", requestID))
}

// cleanupExpiredRecords 定期清理过期的预扣费记录并返还未返还的额度
func (t *PreConsumedQuotaTracker) cleanupExpiredRecords() {
	ticker := time.NewTicker(5 * time.Minute) // 每5分钟检查一次
	defer ticker.Stop()
	
	for t.running {
		select {
		case <-ticker.C:
			t.processExpiredRecords()
		}
	}
}

// processExpiredRecords 处理过期的预扣费记录
func (t *PreConsumedQuotaTracker) processExpiredRecords() {
	t.mu.Lock()
	defer t.mu.Unlock()
	
	now := time.Now().Unix()
	expiredTime := now - 600 // 10分钟前的记录视为过期
	
	var expiredRecords []*PreConsumedRecord
	
	for requestID, record := range t.records {
		if record.Timestamp < expiredTime {
			if !record.Returned {
				expiredRecords = append(expiredRecords, record)
			}
			delete(t.records, requestID)
		}
	}
	
	// 批量返还未返还的预扣费
	for _, record := range expiredRecords {
		go t.returnExpiredPreConsume(record)
	}
	
	if len(expiredRecords) > 0 {
		logger.LogInfo(nil, fmt.Sprintf("发现 %d 条未返还的预扣费记录，正在自动返还", len(expiredRecords)))
	}
}

// returnExpiredPreConsume 返还过期的预扣费
func (t *PreConsumedQuotaTracker) returnExpiredPreConsume(record *PreConsumedRecord) {
	// 开始事务
	tx := DB.Begin()
	defer tx.Rollback()
	
	// 返还用户额度
	err := tx.Model(&User{}).Where("id = ?", record.UserID).
		Update("quota", gorm.Expr("quota + ?", record.PreConsumedQuota)).Error
	if err != nil {
		logger.LogError(nil, fmt.Sprintf("自动返还预扣费失败 (用户): RequestID=%s, UserID=%d, Error=%v", 
			record.RequestID, record.UserID, err))
		return
	}
	
	// 返还令牌额度
	if record.TokenID > 0 {
		err = tx.Model(&Token{}).Where("id = ?", record.TokenID).
			Update("remain_quota", gorm.Expr("remain_quota + ?", record.PreConsumedQuota)).Error
		if err != nil {
			logger.LogError(nil, fmt.Sprintf("自动返还预扣费失败 (令牌): RequestID=%s, TokenID=%d, Error=%v", 
				record.RequestID, record.TokenID, err))
			return
		}
	}
	
	// 记录返还日志
	logContent := fmt.Sprintf("系统自动返还超时请求的预扣费: %d quota (RequestID: %s)", 
		record.PreConsumedQuota, record.RequestID)
	
	err = tx.Create(&Log{
		UserId:     record.UserID,
		Type:       LogTypeSystem,
		Content:    logContent,
		Username:   "",
		TokenName:  "system",
		Quota:      -record.PreConsumedQuota, // 负数表示返还
		CreatedAt:  time.Now().Unix(),
	}).Error
	
	if err != nil {
		logger.LogError(nil, fmt.Sprintf("记录返还日志失败: %v", err))
		return
	}
	
	// 提交事务
	if err = tx.Commit().Error; err != nil {
		logger.LogError(nil, fmt.Sprintf("提交返还事务失败: %v", err))
		return
	}
	
	logger.LogInfo(nil, fmt.Sprintf("成功自动返还预扣费: RequestID=%s, UserID=%d, Quota=%d", 
		record.RequestID, record.UserID, record.PreConsumedQuota))
}

// GetUnreturnedRecords 获取未返还的预扣费记录（用于监控）
func GetUnreturnedRecords() []PreConsumedRecord {
	if quotaTracker == nil {
		return nil
	}
	
	quotaTracker.mu.RLock()
	defer quotaTracker.mu.RUnlock()
	
	var records []PreConsumedRecord
	for _, record := range quotaTracker.records {
		if !record.Returned {
			records = append(records, *record)
		}
	}
	
	return records
}

// Stop 停止追踪器
func (t *PreConsumedQuotaTracker) Stop() {
	t.running = false
}