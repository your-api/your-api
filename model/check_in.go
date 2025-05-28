package model

import (
	"errors"
	"one-api/common"
	"time"

	"gorm.io/gorm"
)

type CheckIn struct {
	Id              int            `json:"id" gorm:"primaryKey"`
	UserId          int            `json:"user_id" gorm:"index;not null"`
	CheckInDate     time.Time      `json:"check_in_date" gorm:"index;not null"`
	QuotaReward     int            `json:"quota_reward" gorm:"not null"`
	ConsecutiveDays int            `json:"consecutive_days" gorm:"not null"`
	CreatedAt       time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// CheckInStatus 用户签到状态
type CheckInStatus struct {
	UserId            int       `json:"user_id"`
	LastCheckInDate   time.Time `json:"last_check_in_date"`
	ConsecutiveDays   int       `json:"consecutive_days"`
	TotalCheckInDays  int       `json:"total_check_in_days"`
	ThisMonthCheckIns int       `json:"this_month_check_ins"`
	HasCheckedInToday bool      `json:"has_checked_in_today"`
	CanCheckIn        bool      `json:"can_check_in"`
	NextRewardQuota   int       `json:"next_reward_quota"`
	ConsecutiveBonus  float64   `json:"consecutive_bonus"`
}

// CheckInCalendar 日历数据
type CheckInCalendar struct {
	Date        string `json:"date"`
	HasCheckIn  bool   `json:"has_check_in"`
	QuotaReward int    `json:"quota_reward"`
	IsToday     bool   `json:"is_today"`
}

// GetUserCheckInStatus 获取用户签到状态
func GetUserCheckInStatus(userId int) (*CheckInStatus, error) {
	var lastCheckIn CheckIn
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	// 获取最后一次签到记录
	err := DB.Where("user_id = ?", userId).Order("check_in_date desc").First(&lastCheckIn).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	status := &CheckInStatus{
		UserId: userId,
	}

	// 如果没有签到记录
	if errors.Is(err, gorm.ErrRecordNotFound) {
		status.ConsecutiveDays = 0
		status.HasCheckedInToday = false
		status.CanCheckIn = true
		status.NextRewardQuota = calculateReward(1)
		status.ConsecutiveBonus = 1.0
	} else {
		status.LastCheckInDate = lastCheckIn.CheckInDate

		// 检查今天是否已签到
		lastCheckInDate := time.Date(lastCheckIn.CheckInDate.Year(), lastCheckIn.CheckInDate.Month(), lastCheckIn.CheckInDate.Day(), 0, 0, 0, 0, time.Local)
		status.HasCheckedInToday = lastCheckInDate.Equal(today)
		status.CanCheckIn = !status.HasCheckedInToday

		// 计算连续签到天数
		if lastCheckInDate.Equal(today) {
			// 今天已签到
			status.ConsecutiveDays = lastCheckIn.ConsecutiveDays
		} else if lastCheckInDate.Equal(today.AddDate(0, 0, -1)) {
			// 昨天签到了，今天还没签到
			status.ConsecutiveDays = lastCheckIn.ConsecutiveDays
		} else {
			// 连续签到中断
			status.ConsecutiveDays = 0
		}

		// 计算下次签到奖励
		nextConsecutiveDays := status.ConsecutiveDays + 1
		if status.HasCheckedInToday {
			nextConsecutiveDays = status.ConsecutiveDays
		}
		status.NextRewardQuota = calculateRewardWithConsecutiveBonus(nextConsecutiveDays)
		status.ConsecutiveBonus = calculateConsecutiveBonus(nextConsecutiveDays)
	}

	// 获取总签到天数
	var totalDays int64
	DB.Model(&CheckIn{}).Where("user_id = ?", userId).Count(&totalDays)
	status.TotalCheckInDays = int(totalDays)

	// 获取本月签到天数
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	monthEnd := monthStart.AddDate(0, 1, 0).Add(-time.Second)
	var thisMonthCount int64
	DB.Model(&CheckIn{}).Where("user_id = ? AND check_in_date >= ? AND check_in_date <= ?", userId, monthStart, monthEnd).Count(&thisMonthCount)
	status.ThisMonthCheckIns = int(thisMonthCount)

	return status, nil
}

// CheckInUser 用户签到
func CheckInUser(userId int) (*CheckIn, error) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)

	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 检查今天是否已经签到
	var existingCheckIn CheckIn
	err := tx.Where("user_id = ? AND DATE(check_in_date) = DATE(?)", userId, today).First(&existingCheckIn).Error
	if err == nil {
		tx.Rollback()
		return nil, errors.New("今天已经签到过了")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		return nil, err
	}

	// 获取最后一次签到记录
	var lastCheckIn CheckIn
	err = tx.Where("user_id = ?", userId).Order("check_in_date desc").First(&lastCheckIn).Error

	consecutiveDays := 1
	if err == nil {
		// 有签到记录
		lastCheckInDate := time.Date(lastCheckIn.CheckInDate.Year(), lastCheckIn.CheckInDate.Month(), lastCheckIn.CheckInDate.Day(), 0, 0, 0, 0, time.Local)
		yesterday := today.AddDate(0, 0, -1)

		if lastCheckInDate.Equal(yesterday) {
			// 连续签到
			consecutiveDays = lastCheckIn.ConsecutiveDays + 1
		}
		// 如果不是连续的，consecutiveDays保持为1
	}

	// 计算奖励额度
	quotaReward := calculateRewardWithConsecutiveBonus(consecutiveDays)

	// 创建签到记录
	checkIn := &CheckIn{
		UserId:          userId,
		CheckInDate:     today,
		QuotaReward:     quotaReward,
		ConsecutiveDays: consecutiveDays,
	}

	if err := tx.Create(checkIn).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 增加用户额度
	if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", quotaReward)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return checkIn, nil
}

// GetUserCheckInCalendar 获取用户签到日历数据
func GetUserCheckInCalendar(userId int, year int, month int) ([]CheckInCalendar, error) {
	if year == 0 {
		year = time.Now().Year()
	}
	if month == 0 {
		month = int(time.Now().Month())
	}

	// 获取月份的第一天和最后一天
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	monthEnd := monthStart.AddDate(0, 1, 0).Add(-time.Second)

	// 获取该月的所有签到记录
	var checkIns []CheckIn
	err := DB.Where("user_id = ? AND check_in_date >= ? AND check_in_date <= ?", userId, monthStart, monthEnd).Find(&checkIns).Error
	if err != nil {
		return nil, err
	}

	// 创建签到记录的映射
	checkInMap := make(map[string]*CheckIn)
	for _, checkIn := range checkIns {
		dateKey := checkIn.CheckInDate.Format("2006-01-02")
		checkInMap[dateKey] = &checkIn
	}

	// 生成日历数据
	var calendar []CheckInCalendar
	today := time.Now().Format("2006-01-02")

	// 获取月份的天数
	daysInMonth := monthEnd.Day()

	for day := 1; day <= daysInMonth; day++ {
		date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
		dateStr := date.Format("2006-01-02")

		calendarDay := CheckInCalendar{
			Date:    dateStr,
			IsToday: dateStr == today,
		}

		if checkIn, exists := checkInMap[dateStr]; exists {
			calendarDay.HasCheckIn = true
			calendarDay.QuotaReward = checkIn.QuotaReward
		}

		calendar = append(calendar, calendarDay)
	}

	return calendar, nil
}

// calculateReward 计算基础奖励额度（0.1-0.5之间的随机值）
func calculateReward(consecutiveDays int) int {
	// 生成0.1到0.5之间的随机额度  1 = 500000
	min := 5000  // 0.01$ = 5000
	max := 25000 // 0.05$ = 25000

	return common.GetRandomInt(min, max+1)
}

// calculateConsecutiveBonus 计算连续签到加成倍率
func calculateConsecutiveBonus(consecutiveDays int) float64 {
	switch {
	case consecutiveDays >= 30:
		return 3.0 // 30天以上：3倍
	case consecutiveDays >= 21:
		return 2.5 // 21-29天：2.5倍
	case consecutiveDays >= 14:
		return 2.0 // 14-20天：2倍
	case consecutiveDays >= 7:
		return 1.5 // 7-13天：1.5倍
	case consecutiveDays >= 3:
		return 1.2 // 3-6天：1.2倍
	default:
		return 1.0 // 1-2天：无加成
	}
}

// calculateRewardWithConsecutiveBonus 计算带连续签到加成的奖励额度
func calculateRewardWithConsecutiveBonus(consecutiveDays int) int {
	baseReward := calculateReward(consecutiveDays)
	bonus := calculateConsecutiveBonus(consecutiveDays)
	return int(float64(baseReward) * bonus)
}

// GetCheckInStats 获取签到统计信息
func GetCheckInStats(userId int) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 总签到天数
	var totalDays int64
	DB.Model(&CheckIn{}).Where("user_id = ?", userId).Count(&totalDays)
	stats["total_check_in_days"] = totalDays

	// 总获得额度
	var totalQuota int64
	DB.Model(&CheckIn{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_reward), 0)").Scan(&totalQuota)
	stats["total_quota_earned"] = totalQuota

	// 最长连续签到天数
	var maxConsecutive int64
	DB.Model(&CheckIn{}).Where("user_id = ?", userId).Select("MAX(consecutive_days)").Scan(&maxConsecutive)
	stats["max_consecutive_days"] = maxConsecutive

	// 本月签到天数
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	monthEnd := monthStart.AddDate(0, 1, 0).Add(-time.Second)
	var thisMonthDays int64
	DB.Model(&CheckIn{}).Where("user_id = ? AND check_in_date >= ? AND check_in_date <= ?", userId, monthStart, monthEnd).Count(&thisMonthDays)
	stats["this_month_check_ins"] = thisMonthDays

	return stats, nil
}
