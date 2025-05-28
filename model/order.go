package model

import (
	"errors"
	"fmt"
	"one-api/common"
	"time"
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

	// 更新用户token
	user.Quota += (int)(order.GetAmount * common.QuotaPerUnit)
	if err := DB.Save(&user).Error; err != nil {
		return errors.New("订单失败: " + err.Error())
	}

	// 更新状态和消息
	order.Status = 2

	RecordLog(order.UserId, LogTypeTopup,
		fmt.Sprintf("使用在线充值成功，充值金额: %v，支付金额：%v", int(order.GetAmount), int(order.PayAmount)))

	if err := DB.Save(&order).Error; err != nil {
		return errors.New("更新订单状态失败: " + err.Error())
	}
	return nil
}
