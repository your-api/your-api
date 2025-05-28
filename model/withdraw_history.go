package model

import (
	"time"
)

const (
	WithdrawStatusPending  = 0 // 待处理
	WithdrawStatusApproved = 1 // 已通过
	WithdrawStatusRejected = 2 // 已拒绝
	WithdrawStatusPaid     = 3 // 已支付
)

type WithdrawHistory struct {
	ID             uint64    `json:"id" gorm:"primaryKey;autoIncrement;column:id;comment:'主键ID'"`
	UserId         int       `json:"user_id" gorm:"type:int;not null;index;column:user_id;comment:'用户ID'"`
	WithdrawQuota  int       `json:"withdraw_quota" gorm:"type:int;default:0;column:withdraw_quota;comment:'提现额度'"`
	WithdrawStatus int       `json:"withdraw_status" gorm:"type:int;default:0;column:withdraw_status;comment:'提现状态'"`
	AlipayAccount  string    `json:"alipay_account" gorm:"type:varchar(100);column:alipay_account;comment:'支付宝账号'"`
	Contact        string    `json:"contact" gorm:"type:varchar(100);column:contact;comment:'联系方式'"`
	Comment        string    `json:"comment" gorm:"type:varchar(320);column:comment;comment:'备注'"`
	AdminComment   string    `json:"admin_comment" gorm:"type:varchar(320);column:admin_comment;comment:'管理员备注'"`
	CreateTime     time.Time `json:"create_time" gorm:"autoCreateTime;comment:'创建时间'"`
	UpdateTime     time.Time `json:"update_time" gorm:"autoUpdateTime;comment:'更新时间'"`
}

// CreateWithdrawHistory 创建提现申请
func CreateWithdrawHistory(userId int, quota int, alipayAccount, contact string) (*WithdrawHistory, error) {
	withdraw := &WithdrawHistory{
		UserId:         userId,
		WithdrawQuota:  quota,
		WithdrawStatus: WithdrawStatusPending,
		AlipayAccount:  alipayAccount,
		Contact:        contact,
	}

	if err := DB.Create(withdraw).Error; err != nil {
		return nil, err
	}

	return withdraw, nil
}

// GetWithdrawHistoryById 根据ID获取提现记录
func GetWithdrawHistoryById(id uint64) (*WithdrawHistory, error) {
	var withdraw WithdrawHistory
	err := DB.Where("id = ?", id).First(&withdraw).Error
	if err != nil {
		return nil, err
	}
	return &withdraw, nil
}

// GetUserWithdrawHistories 获取用户的提现记录
func GetUserWithdrawHistories(userId int, startIdx, num int) ([]*WithdrawHistory, int64, error) {
	var withdraws []*WithdrawHistory
	var total int64

	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err := tx.Model(&WithdrawHistory{}).Where("user_id = ?", userId).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Where("user_id = ?", userId).Order("id desc").Limit(num).Offset(startIdx).Find(&withdraws).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return withdraws, total, nil
}

// GetAllWithdrawHistories 获取所有提现记录（管理员使用）
func GetAllWithdrawHistories(startIdx, num int) ([]*WithdrawHistory, int64, error) {
	var withdraws []*WithdrawHistory
	var total int64

	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err := tx.Model(&WithdrawHistory{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&withdraws).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return withdraws, total, nil
}

// UpdateWithdrawStatus 更新提现状态
func (w *WithdrawHistory) UpdateStatus(status int, adminComment string) error {
	w.WithdrawStatus = status
	w.AdminComment = adminComment
	return DB.Save(w).Error
}

// GetUserPendingWithdrawQuota 获取用户正在提现的额度总和
func GetUserPendingWithdrawQuota(userId int) (int, error) {
	var totalQuota int64
	err := DB.Model(&WithdrawHistory{}).
		Where("user_id = ? AND withdraw_status = ?", userId, WithdrawStatusPending).
		Select("COALESCE(SUM(withdraw_quota), 0)").
		Scan(&totalQuota).Error
	return int(totalQuota), err
}

// IsUserHasPendingWithdraw 检查用户是否有待处理的提现申请
func IsUserHasPendingWithdraw(userId int) (bool, error) {
	var count int64
	err := DB.Model(&WithdrawHistory{}).
		Where("user_id = ? AND withdraw_status = ?", userId, WithdrawStatusPending).
		Count(&count).Error
	return count > 0, err
}
