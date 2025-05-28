package model

import (
	"errors"
	"fmt"
	"one-api/common"
	"time"

	"gorm.io/gorm"
)

// OrderInfo 表示订单信息的数据库结构体
type OrderInfo struct {
	OutTradeNo string    `json:"out_trade_no" gorm:"primaryKey;size:80;not null;comment:'交易订单号'"`
	UserId     int       `json:"user_id" gorm:"not null;comment:'用户ID'"`
	PayAmount  float64   `json:"pay_amount" gorm:"not null;comment:'付款金额'"`
	GetAmount  float64   `json:"get_amount" gorm:"not null;comment:'到账金额'"`
	QRCode     string    `json:"qr_code" gorm:"size:100;not null;comment:'QRCode'"`
	Status     int       `json:"status" gorm:"not null;comment:'状态 0未完成 1终止 2完成'"`
	Msg        string    `json:"msg" gorm:"size:2064;default:'';comment:'原因'"`
	CreateTime time.Time `json:"create_time" gorm:"autoCreateTime;comment:'创建时间'"`
}

// CreateOrder 创建新订单并写入数据库
func CreateOrder(outTradeNo string, qrCode string, userId int, payAmount, getAmount float64) (*OrderInfo, error) {
	if outTradeNo == "" {
		return nil, errors.New("订单号不能为空")
	}
	if userId <= 0 {
		return nil, errors.New("用户ID无效")
	}
	if payAmount <= 0 {
		return nil, errors.New("支付金额必须大于0")
	}

	order := &OrderInfo{
		OutTradeNo: outTradeNo,
		UserId:     userId,
		PayAmount:  payAmount,
		GetAmount:  getAmount,
		QRCode:     qrCode,
		Status:     0, // 默认状态为未完成
		CreateTime: time.Now(),
	}

	err := DB.Create(order).Error
	if err != nil {
		return nil, err
	}
	return order, nil
}

// CompleteOrder 根据订单号完成订单，设置状态为 2（完成），可选更新 Msg 字段
func CompleteOrder(outTradeNo string) error {
	if outTradeNo == "" {
		return errors.New("订单号不能为空")
	}

	// 查询订单
	var order OrderInfo
	if err := DB.Where("out_trade_no = ?", outTradeNo).First(&order).Error; err != nil {
		return errors.New("订单未找到: " + err.Error())
	}

	user, err := GetUserById(order.UserId, true)
	if err != nil {
		return err
	}

	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer tx.Rollback()

	// 更新用户额度
	user.Quota += (int)(order.GetAmount * common.QuotaPerUnit)
	user.PayCount++
	if err := tx.Save(&user).Error; err != nil {
		return errors.New("订单失败: " + err.Error())
	}

	// 处理邀请充值返利：用户前三次充值时给邀请者返利
	if user.InviterId > 0 && user.PayCount <= 3 {
		// 计算返利额度：充值额度的5%
		commissionQuota := int(float64(order.GetAmount * common.QuotaPerUnit) * 0.05)
		
		// 给邀请者分配返利
		if commissionQuota > 0 {
			err = tx.Model(&User{}).
				Where("id = ?", user.InviterId).
				Update("reward_quota", gorm.Expr("reward_quota + ?", commissionQuota)).Error
			if err != nil {
				return fmt.Errorf("分配邀请充值返利失败: %v", err)
			}
			
			// 记录邀请者的返利日志
			RecordLog(user.InviterId, LogTypeSystem, 
				fmt.Sprintf("邀请用户充值返利 %s (来自用户: %s, 第%d次充值)", 
					common.LogQuota(commissionQuota), user.Username, user.PayCount))
		}
	}

	// 更新订单状态
	order.Status = 2
	if err := tx.Save(&order).Error; err != nil {
		return errors.New("更新订单状态失败: " + err.Error())
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return err
	}

	// 记录用户充值日志
	RecordLog(order.UserId, LogTypeTopup,
		fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%v", int(order.GetAmount), int(order.PayAmount)))

	return nil
}
