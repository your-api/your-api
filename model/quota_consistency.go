package model

import (
	"fmt"
	"one-api/common"
	"sync"
	"time"
)

// QuotaConsistencyChecker 用于定期检查和修复额度一致性问题
type QuotaConsistencyChecker struct {
	mu       sync.Mutex
	running  bool
	interval time.Duration
}

var quotaChecker *QuotaConsistencyChecker

// InitQuotaConsistencyChecker 初始化额度一致性检查器
func InitQuotaConsistencyChecker(intervalMinutes int) {
	quotaChecker = &QuotaConsistencyChecker{
		interval: time.Duration(intervalMinutes) * time.Minute,
	}
	quotaChecker.Start()
}

// Start 启动定期检查
func (q *QuotaConsistencyChecker) Start() {
	q.mu.Lock()
	defer q.mu.Unlock()
	
	if q.running {
		return
	}
	
	q.running = true
	go q.run()
}

// Stop 停止定期检查
func (q *QuotaConsistencyChecker) Stop() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.running = false
}

func (q *QuotaConsistencyChecker) run() {
	ticker := time.NewTicker(q.interval)
	defer ticker.Stop()
	
	// 首次启动立即检查一次
	q.checkAndFixInconsistencies()
	
	for {
		select {
		case <-ticker.C:
			q.mu.Lock()
			if !q.running {
				q.mu.Unlock()
				return
			}
			q.mu.Unlock()
			
			q.checkAndFixInconsistencies()
		}
	}
}

// checkAndFixInconsistencies 检查并修复额度不一致问题
func (q *QuotaConsistencyChecker) checkAndFixInconsistencies() {
	common.LogInfo(nil, "开始检查用户额度一致性...")
	
	// 查询有额度不一致问题的用户
	var inconsistentUsers []struct {
		ID           int
		Username     string
		Quota        int
		UsedQuota    int
		TotalTopup   int
		TotalRedeem  int
		RewardQuota  int
		Difference   int
	}
	
	query := `
		SELECT 
			u.id,
			u.username,
			u.quota,
			u.used_quota,
			COALESCE(t.total_topup, 0) as total_topup,
			COALESCE(r.total_redeemed, 0) as total_redeemed,
			u.reward_quota,
			(u.quota + u.used_quota) - (COALESCE(t.total_topup, 0) + COALESCE(r.total_redeemed, 0) + u.reward_quota) as difference
		FROM users u
		LEFT JOIN (
			SELECT user_id, SUM(amount * ?) as total_topup
			FROM topups
			WHERE status = 'success'
			GROUP BY user_id
		) t ON u.id = t.user_id
		LEFT JOIN (
			SELECT user_id, SUM(quota) as total_redeemed
			FROM redemptions
			WHERE status = 3
			GROUP BY user_id
		) r ON u.id = r.user_id
		WHERE u.deleted_at IS NULL
		HAVING ABS(difference) > 100
		LIMIT 100
	`
	
	err := DB.Raw(query, common.QuotaPerUnit).Scan(&inconsistentUsers).Error
	if err != nil {
		common.LogError(nil, fmt.Sprintf("检查额度一致性失败: %v", err))
		return
	}
	
	if len(inconsistentUsers) == 0 {
		common.LogInfo(nil, "所有用户额度正常，无需修复")
		return
	}
	
	common.LogInfo(nil, fmt.Sprintf("发现 %d 个用户存在额度不一致问题", len(inconsistentUsers)))
	
	// 修复每个用户的额度
	for _, user := range inconsistentUsers {
		q.fixUserQuota(user.ID, user.Username, user.Quota, user.Difference)
	}
}

// fixUserQuota 修复单个用户的额度
func (q *QuotaConsistencyChecker) fixUserQuota(userID int, username string, currentQuota int, difference int) {
	// 如果差异太小，忽略
	if difference > -100 && difference < 100 {
		return
	}
	
	correctQuota := currentQuota - difference
	
	// 开始事务
	tx := DB.Begin()
	defer tx.Rollback()
	
	// 更新用户额度
	err := tx.Model(&User{}).Where("id = ?", userID).Update("quota", correctQuota).Error
	if err != nil {
		common.LogError(nil, fmt.Sprintf("修复用户 %s (ID: %d) 额度失败: %v", username, userID, err))
		return
	}
	
	// 记录修复日志
	logContent := fmt.Sprintf("系统自动修复额度差异: 调整 %d quota (原额度: %d, 修正后: %d)", 
		-difference, currentQuota, correctQuota)
	
	err = tx.Create(&Log{
		UserId:     userID,
		Type:       LogTypeSystem,
		Content:    logContent,
		Username:   username,
		TokenName:  "system",
		Quota:      -difference,
		CreatedAt:  time.Now().Unix(),
	}).Error
	
	if err != nil {
		common.LogError(nil, fmt.Sprintf("记录修复日志失败: %v", err))
		return
	}
	
	// 提交事务
	if err = tx.Commit().Error; err != nil {
		common.LogError(nil, fmt.Sprintf("提交修复事务失败: %v", err))
		return
	}
	
	common.LogInfo(nil, fmt.Sprintf("成功修复用户 %s (ID: %d) 的额度差异: %d", username, userID, -difference))
}

// CheckUserQuotaConsistency 检查单个用户的额度一致性
func CheckUserQuotaConsistency(userID int) (isConsistent bool, difference int, err error) {
	var result struct {
		CurrentTotal int
		ShouldHave   int
		Difference   int
	}
	
	query := `
		SELECT 
			u.quota + u.used_quota as current_total,
			COALESCE(t.total_topup, 0) + COALESCE(r.total_redeemed, 0) + u.reward_quota as should_have,
			(u.quota + u.used_quota) - (COALESCE(t.total_topup, 0) + COALESCE(r.total_redeemed, 0) + u.reward_quota) as difference
		FROM users u
		LEFT JOIN (
			SELECT user_id, SUM(amount * ?) as total_topup
			FROM topups
			WHERE status = 'success' AND user_id = ?
			GROUP BY user_id
		) t ON u.id = t.user_id
		LEFT JOIN (
			SELECT user_id, SUM(quota) as total_redeemed
			FROM redemptions
			WHERE status = 3 AND user_id = ?
			GROUP BY user_id
		) r ON u.id = r.user_id
		WHERE u.id = ? AND u.deleted_at IS NULL
	`
	
	err = DB.Raw(query, common.QuotaPerUnit, userID, userID, userID).Scan(&result).Error
	if err != nil {
		return false, 0, err
	}
	
	isConsistent = result.Difference == 0
	difference = result.Difference
	
	return isConsistent, difference, nil
}