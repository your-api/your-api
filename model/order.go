package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"one-api/common"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// OrderInfo 表示订单信息的数据库结构体
type OrderInfo struct {
	OutTradeNo string    `json:"out_trade_no" gorm:"primaryKey;size:80;not null;comment:'交易订单号'"`
	UserId     int       `json:"user_id" gorm:"not null;comment:'用户ID'"`
	PayAmount  float64   `json:"pay_amount" gorm:"type:decimal(10,2);not null;comment:'付款金额'"`
	GetAmount  float64   `json:"get_amount" gorm:"type:decimal(10,2);not null;comment:'到账金额'"`
	QRCode     string    `json:"qr_code" gorm:"size:100;not null;comment:'QRCode'"`
	PayWay     int       `json:"pay_way" gorm:"not null;default:0;comment:'支付方式 0支付宝 1微信'"`
	Status     int       `json:"status" gorm:"not null;comment:'状态 0未完成 1终止 2完成'"`
	Msg        string    `json:"msg" gorm:"size:2064;default:'';comment:'原因'"`
	CreateTime time.Time `json:"create_time" gorm:"autoCreateTime;comment:'创建时间'"`
}

// CreateOrder 创建新订单并写入数据库
func CreateOrder(outTradeNo string, qrCode string, userId int, payAmount, getAmount float64, payWay int) (*OrderInfo, error) {
	if outTradeNo == "" {
		return nil, errors.New("订单号不能为空")
	}
	if userId <= 0 {
		return nil, errors.New("用户ID无效")
	}
	if payAmount <= 0 {
		return nil, errors.New("支付金额必须大于0")
	}

	// 先检查订单是否已存在
	var existingOrder OrderInfo
	if err := DB.Where("out_trade_no = ?", outTradeNo).First(&existingOrder).Error; err == nil {
		common.SysLog(fmt.Sprintf("订单已存在，跳过创建: OutTradeNo=%s, Status=%d", outTradeNo, existingOrder.Status))
		return &existingOrder, nil
	}

	order := &OrderInfo{
		OutTradeNo: outTradeNo,
		UserId:     userId,
		PayAmount:  payAmount,
		GetAmount:  getAmount,
		QRCode:     qrCode,
		PayWay:     payWay,
		Status:     0, // 默认状态为未完成
		CreateTime: time.Now(),
	}

	common.SysLog(fmt.Sprintf("创建订单: OutTradeNo=%s, UserId=%d, PayAmount=%.2f, GetAmount=%.2f, PayWay=%d", 
		outTradeNo, userId, payAmount, getAmount, payWay))

	err := DB.Create(order).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("订单创建失败: %v", err))
		return nil, err
	}
	
	common.SysLog(fmt.Sprintf("订单创建成功: OutTradeNo=%s", outTradeNo))
	return order, nil
}

// CompleteOrder 根据订单号完成订单，设置状态为 2（完成），可选更新 Msg 字段
func CompleteOrder(outTradeNo string) error {
	if outTradeNo == "" {
		return errors.New("订单号不能为空")
	}

	// 先查询订单，不限制状态
	var order OrderInfo
	if err := DB.Where("out_trade_no = ?", outTradeNo).First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.SysLog(fmt.Sprintf("订单不存在: %s", outTradeNo))
			return errors.New("订单不存在")
		}
		return errors.New("订单未找到: " + err.Error())
	}

	// 如果订单已经完成，检查用户额度是否已经增加
	if order.Status == 2 {
		// 检查用户是否已经收到额度
		user, err := GetUserById(order.UserId, true)
		if err != nil {
			common.SysLog(fmt.Sprintf("查询用户失败: %s, 用户ID: %d", outTradeNo, order.UserId))
			return err
		}
		
		// 检查充值日志是否存在
		var logCount int64
		DB.Model(&Log{}).Where("user_id = ? AND type = ? AND content LIKE ?", 
			order.UserId, LogTypeTopup, "%"+outTradeNo+"%").Count(&logCount)
		
		if logCount > 0 {
			// 如果日志存在，说明额度已经加过了
			common.SysLog(fmt.Sprintf("订单已经完成且额度已添加，忽略重复处理: %s", outTradeNo))
			return nil
		}
		
		// 如果订单状态是完成但是没有日志，说明可能是之前处理失败了，需要补充添加额度
		common.SysLog(fmt.Sprintf("订单状态已完成但额度未添加，开始补充处理: %s", outTradeNo))
		
		// 开始事务补充添加额度
		tx := DB.Begin()
		if tx.Error != nil {
			return tx.Error
		}
		defer tx.Rollback()
		
		// 计算并添加额度
		dAmount := decimal.NewFromFloat(order.GetAmount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
		
		common.SysLog(fmt.Sprintf("补充处理-计算额度: GetAmount=%.2f, QuotaPerUnit=%.0f, quotaToAdd=%d", 
			order.GetAmount, common.QuotaPerUnit, quotaToAdd))
		
		oldQuota := user.Quota
		user.Quota += quotaToAdd
		user.PayCount++
		
		common.SysLog(fmt.Sprintf("补充处理-更新用户额度: UserId=%d, 原额度=%d, 新额度=%d, 增加额度=%d", 
			user.Id, oldQuota, user.Quota, quotaToAdd))
		
		if err := tx.Save(&user).Error; err != nil {
			common.SysLog(fmt.Sprintf("补充更新用户额度失败: 订单=%s, 用户ID=%d, 错误=%v", outTradeNo, user.Id, err))
			return errors.New("补充订单失败: " + err.Error())
		}
		
		// 处理邀请充值返利：与正常流程保持一致
		if user.InviterId > 0 && user.PayCount <= 3000000 {
			commissionQuota := int(float64(quotaToAdd) * 0.02)
			if commissionQuota > 0 {
				err = tx.Model(&User{}).
					Where("id = ?", user.InviterId).
					Update("reward_quota", gorm.Expr("reward_quota + ?", commissionQuota)).Error
				if err != nil {
					return fmt.Errorf("补充分配邀请充值返利失败: %v", err)
				}
				
				RecordLog(user.InviterId, LogTypeSystem,
					fmt.Sprintf("邀请用户充值返利 %s (补充处理，来自某位邀请用户的第%d次充值)",
						logger.LogQuota(commissionQuota), user.PayCount))
			}
		}
		
		// 提交事务
		if err := tx.Commit().Error; err != nil {
			common.SysLog(fmt.Sprintf("补充处理事务提交失败: 订单=%s, 错误=%v", outTradeNo, err))
			return err
		}
		
		common.SysLog(fmt.Sprintf("订单补充处理成功: %s, 用户ID: %d, 增加额度: %d", outTradeNo, order.UserId, quotaToAdd))
		
		// 记录用户充值日志
		RecordLog(order.UserId, LogTypeTopup,
			fmt.Sprintf("使用在线充值成功（补充处理），订单号: %s，充值金额: %v，支付金额：%v", order.OutTradeNo, logger.LogQuota(quotaToAdd), order.PayAmount))
		
		return nil
	}

	// 如果订单状态不是0、1或999，则不能处理
	// 状态1是终止状态，但如果用户实际已支付，我们仍需要处理
	if order.Status != 0 && order.Status != 1 && order.Status != 999 {
		common.SysLog(fmt.Sprintf("订单状态不正确，无法处理: %s, 状态: %d", outTradeNo, order.Status))
		return errors.New("订单状态不正确")
	}
	
	// 如果是状态1（终止），记录日志说明这是补救处理
	if order.Status == 1 {
		common.SysLog(fmt.Sprintf("订单已被标记为终止，但用户已支付，开始补救处理: %s", outTradeNo))
	}

	common.SysLog(fmt.Sprintf("开始处理订单: %s, 用户ID: %d, 支付金额: %.2f, 到账金额: %.2f", 
		outTradeNo, order.UserId, order.PayAmount, order.GetAmount))

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

	// 更新用户额度 - 使用decimal精确计算
	dAmount := decimal.NewFromFloat(order.GetAmount)
	dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
	
	common.SysLog(fmt.Sprintf("计算额度: GetAmount=%.2f, QuotaPerUnit=%.0f, quotaToAdd=%d", 
		order.GetAmount, common.QuotaPerUnit, quotaToAdd))
	
	oldQuota := user.Quota
	user.Quota += quotaToAdd
	user.PayCount++
	
	common.SysLog(fmt.Sprintf("更新用户额度: UserId=%d, 原额度=%d, 新额度=%d, 增加额度=%d", 
		user.Id, oldQuota, user.Quota, quotaToAdd))
	
	if err := tx.Save(&user).Error; err != nil {
		common.SysLog(fmt.Sprintf("更新用户额度失败: 订单=%s, 用户ID=%d, 错误=%v", outTradeNo, user.Id, err))
		return errors.New("订单失败: " + err.Error())
	}

	// 处理邀请充值返利：用户前三次充值时给邀请者返利
	if user.InviterId > 0 && user.PayCount <= 3000000 {
		// 计算返利额度：使用实际增加的额度的比例
		commissionQuota := int(float64(quotaToAdd) * 0.02)

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
				fmt.Sprintf("邀请用户充值返利 %s (来自某位邀请用户的第%d次充值)",
					logger.LogQuota(commissionQuota), user.PayCount))
		}
	}

	// 更新订单状态为完成（状态2）
	// 允许从状态0、1、999更新到状态2
	result := tx.Model(&OrderInfo{}).
		Where("out_trade_no = ? AND (status = ? OR status = ? OR status = ?)", outTradeNo, 0, 1, 999).
		Update("status", 2)
	
	if result.Error != nil {
		common.SysLog(fmt.Sprintf("更新订单状态失败: 订单=%s, 错误=%v", outTradeNo, result.Error))
		return errors.New("更新订单状态失败: " + result.Error.Error())
	}
	
	if result.RowsAffected == 0 {
		common.SysLog(fmt.Sprintf("更新订单状态失败: 订单=%s, 没有行被更新（可能状态不正确）", outTradeNo))
		return errors.New("更新订单状态失败: 没有行被更新")
	}
	
	common.SysLog(fmt.Sprintf("订单状态更新成功: 订单=%s, 更新行数=%d", outTradeNo, result.RowsAffected))

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		common.SysLog(fmt.Sprintf("事务提交失败: 订单=%s, 错误=%v", outTradeNo, err))
		return err
	}

	common.SysLog(fmt.Sprintf("订单完成成功: %s, 用户ID: %d, 增加额度: %d", outTradeNo, order.UserId, quotaToAdd))

	// 记录用户充值日志
	RecordLog(order.UserId, LogTypeTopup,
		fmt.Sprintf("使用在线充值成功，订单号: %s，充值金额: %v，支付金额：%v", order.OutTradeNo, logger.LogQuota(quotaToAdd), order.PayAmount))

	return nil
}

// ProcessTimeoutOrders 处理超时订单：查询创建时间超过10分钟且状态为0的订单，检查支付状态并更新 订单补偿
func ProcessTimeoutOrders() error {
	// 查询创建时间超过10分钟且状态为0的订单，使用 FOR UPDATE 行锁防止并发处理
	var timeoutOrders []OrderInfo
	tenMinutesAgo := time.Now().Add(-10 * time.Minute) // 改为10分钟，给用户更多支付时间

	// 开始事务并使用 FOR UPDATE 锁
	tx := DB.Begin()
	if tx.Error != nil {
		return fmt.Errorf("开始事务失败: %v", tx.Error)
	}
	defer tx.Rollback()

	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("status = ? AND create_time < ?", 0, tenMinutesAgo).
		Find(&timeoutOrders).Error
	if err != nil {
		return fmt.Errorf("查询超时订单失败: %v", err)
	}

	if len(timeoutOrders) == 0 {
		tx.Commit() // 提交事务释放锁
		return nil  // 没有超时订单
	}

	common.SysLog(fmt.Sprintf("发现 %d 个超时订单，开始处理", len(timeoutOrders)))

	// 处理每个订单
	for _, order := range timeoutOrders {
		// 这里需要根据实际的支付接口来查询订单状态
		// 示例：假设有一个查询支付状态的方法
		paymentStatus, err := checkPaymentStatus(order.OutTradeNo)
		if err != nil {
			common.SysLog(fmt.Sprintf("查询订单 %s 支付状态失败: %v", order.OutTradeNo, err))
			continue
		}

		// 判断paymentStatus是否是SUCCESS
		if paymentStatus == "SUCCESS" {
			// 先更新订单状态为处理中，避免其他实例重复处理
			err = tx.Model(&OrderInfo{}).
				Where("out_trade_no = ? AND status = ?", order.OutTradeNo, 0).
				Update("status", 999). // 临时状态，表示正在处理
				Error
			if err != nil {
				common.SysLog(fmt.Sprintf("更新订单 %s 处理状态失败: %v", order.OutTradeNo, err))
				continue
			}

			// 提交事务释放锁
			if err = tx.Commit().Error; err != nil {
				common.SysLog(fmt.Sprintf("提交事务失败: %v", err))
				return err
			}

			// 在新事务中完成订单
			err = CompleteOrder(order.OutTradeNo)
			if err != nil {
				common.SysLog(fmt.Sprintf("完成订单 %s 失败: %v", order.OutTradeNo, err))
				// 恢复订单状态
				DB.Model(&OrderInfo{}).
					Where("out_trade_no = ? AND status = ?", order.OutTradeNo, 999).
					Update("status", 0)
			} else {
				common.SysLog(fmt.Sprintf("订单 %s 支付成功，已完成", order.OutTradeNo))
			}
			return nil // 处理完成，结束本次轮询
		} else {
			err = tx.Model(&OrderInfo{}).
				Where("out_trade_no = ? AND status = ?", order.OutTradeNo, 0).
				Updates(map[string]interface{}{
					"status": 1,
					"msg":    "支付超时或失败",
				}).Error
			if err != nil {
				common.SysLog(fmt.Sprintf("终止订单 %s 失败: %v", order.OutTradeNo, err))
			} else {
				common.SysLog(fmt.Sprintf("订单 %s 支付失败，已终止", order.OutTradeNo))
			}
		}

		//switch paymentStatus {
		//case "SUCCESS": // 支付成功
		//	// 先更新订单状态为处理中，避免其他实例重复处理
		//	err = tx.Model(&OrderInfo{}).
		//		Where("out_trade_no = ? AND status = ?", order.OutTradeNo, 0).
		//		Update("status", 999). // 临时状态，表示正在处理
		//		Error
		//	if err != nil {
		//		common.SysLog(fmt.Sprintf("更新订单 %s 处理状态失败: %v", order.OutTradeNo, err))
		//		continue
		//	}
		//
		//	// 提交事务释放锁
		//	if err = tx.Commit().Error; err != nil {
		//		common.SysLog(fmt.Sprintf("提交事务失败: %v", err))
		//		return err
		//	}
		//
		//	// 在新事务中完成订单
		//	err = CompleteOrder(order.OutTradeNo)
		//	if err != nil {
		//		common.SysLog(fmt.Sprintf("完成订单 %s 失败: %v", order.OutTradeNo, err))
		//		// 恢复订单状态
		//		DB.Model(&OrderInfo{}).
		//			Where("out_trade_no = ? AND status = ?", order.OutTradeNo, 999).
		//			Update("status", 0)
		//	} else {
		//		common.SysLog(fmt.Sprintf("订单 %s 支付成功，已完成", order.OutTradeNo))
		//	}
		//	return nil // 处理完成，结束本次轮询
		//
		//case "FAILED", "TIMEOUT", "CANCELLED": // 支付失败、超时或取消
		//	err = tx.Model(&OrderInfo{}).
		//		Where("out_trade_no = ? AND status = ?", order.OutTradeNo, 0).
		//		Updates(map[string]interface{}{
		//			"status": 1,
		//			"msg":    "支付超时或失败",
		//		}).Error
		//	if err != nil {
		//		common.SysLog(fmt.Sprintf("终止订单 %s 失败: %v", order.OutTradeNo, err))
		//	} else {
		//		common.SysLog(fmt.Sprintf("订单 %s 支付失败，已终止", order.OutTradeNo))
		//	}
		//default:
		//	// 支付状态不明确，继续等待
		//	common.SysLog(fmt.Sprintf("订单 %s 支付状态不明确: %s，继续等待", order.OutTradeNo, paymentStatus))
		//}
	}

	// 提交事务
	err = tx.Commit().Error
	if err != nil {
		return fmt.Errorf("提交事务失败: %v", err)
	}

	return nil
}

// checkPaymentStatus 查询支付状态（使用现有的支付接口查询）
func checkPaymentStatus(outTradeNo string) (string, error) {
	// 先查询订单获取支付方式
	var order OrderInfo
	err := DB.Where("out_trade_no = ?", outTradeNo).Select("pay_way").First(&order).Error
	if err != nil {
		return "UNKNOWN", fmt.Errorf("查询订单信息失败: %v", err)
	}

	// 使用订单中的支付方式查询状态
	payWay := fmt.Sprintf("%d", order.PayWay)
	resp, err := queryQRStatusAllFromModel(outTradeNo, payWay)
	if err != nil {
		return "UNKNOWN", fmt.Errorf("查询支付状态失败: %v", err)
	}

	// 根据返回的状态映射到我们需要的状态
	switch resp.Status {
	case "OK":
		return "SUCCESS", nil
	case "FAIL", "TIMEOUT", "CANCEL":
		return "FAILED", nil
	default:
		return "PENDING", nil
	}
}

// queryQRStatusAllFromModel 从model层调用controller层的查询方法
// 注意：这里需要重新实现查询逻辑，因为controller层的方法依赖gin.Context
func queryQRStatusAllFromModel(outTradeNo string, payWay string) (*qrStatusData, error) {
	// 由于我们不能直接调用controller层的方法（它需要gin.Context），
	// 我们需要重新实现查询逻辑

	// 支付网关查询地址
	const queryGatewayURL = "https://api.aicnn.cn/app-api/pay/queryQRStatusAll"
	// 鉴权 Token
	const authToken = "zzzqqqfsadfsa"

	// 构建 URL 带参数
	url := fmt.Sprintf("%s?outTradeNo=%s&payWay=%s", queryGatewayURL, outTradeNo, payWay)

	// 创建 HTTP 客户端
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// 创建 GET 请求
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("构建支付状态请求失败: %v", err)
	}

	// 设置头
	req.Header.Set("Authorization", "Bearer "+authToken)

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用支付状态查询接口失败: %v", err)
	}
	defer resp.Body.Close()

	// 解析响应
	var qrResp qrStatusResp
	if err := json.NewDecoder(resp.Body).Decode(&qrResp); err != nil {
		return nil, fmt.Errorf("解析支付状态响应失败: %v", err)
	}

	// 返回错误状态
	if qrResp.Code != 0 || qrResp.Data == nil {
		msg := qrResp.Msg
		if msg == "" {
			msg = "支付状态返回失败"
		}
		return nil, fmt.Errorf(msg)
	}

	return qrResp.Data, nil
}

// 响应结构体定义（从controller层复制过来）
type qrStatusResp struct {
	Code int           `json:"code"`
	Msg  string        `json:"msg"`
	Data *qrStatusData `json:"data"`
}

type qrStatusData struct {
	OutTradeNo string `json:"outTradeNo"`
	Status     string `json:"status"`
}
