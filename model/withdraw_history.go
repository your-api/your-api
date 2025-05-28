package model

import "time"

type WithdrawHistory struct {
	ID             uint64    `json:"id" gorm:"primaryKey;autoIncrement;column:id;comment:'主键ID'"`
	WithdrawQuota  int       `json:"withdraw_quota" gorm:"type:int;default:0;column:withdraw_quota"`   // 邀请新用户奖励的提现额度
	WithdrawStatus int       `json:"withdraw_status" gorm:"type:int;default:0;column:withdraw_status"` // 提现的状态
	Comment        string    `json:"comment" gorm:"type:varchar(320);column:comment"`
	CreateTime     time.Time `json:"create_time" gorm:"autoCreateTime;comment:'创建时间'"`
	UpdateTime     time.Time `json:"update_time" gorm:"autoCreateTime;comment:'更新时间'"`
}
