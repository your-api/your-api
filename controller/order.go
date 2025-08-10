package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"one-api/model"
	"one-api/setting/operation_setting"
)

// 根据充值金额计算折扣
func getDiscountRateForOrder(amount float64) float64 {
	return operation_setting.GetDiscountRateForOrder(amount)
}

// 计算实际到账金额
func getCreditAmountForOrder(amount float64, group string) float64 {
	// 到账金额就是原价金额
	return amount
}

// 新增：计算实际支付金额（应用折扣）
func getDiscountPayAmountForOrder(amount float64, group string) float64 {
	// 获取折扣率
	discountRate := getDiscountRateForOrder(amount)

	// 计算折扣后的支付金额，保留2位小数
	result := amount * discountRate
	return math.Round(result*100) / 100
}

// —— 全局变量 & 常量 ——

// 全局复用的 HTTP 客户端，带 10s 超时
var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// 支付网关地址
// const paymentGatewayURL = "https://api.aicnn.cn/app-api/pay/getTradeAll"
// const paymentGatewayURL = "http://localhost:31020/app-api/pay/getTradeAll"
// const ueryGatewayURL = "http://localhost:31020/app-api/pay/queryQRStatusAll"
const paymentGatewayURL = "https://api.aicnn.cn/app-api/pay/getTradeAll"
const ueryGatewayURL = "https://api.aicnn.cn/app-api/pay/queryQRStatusAll"

// 鉴权 Token
const authToken = "zzzqqqfsadfsa"

// —— 请求／响应结构 ——

// 请求参数
type OrderReq struct {
	Amount   float64 `json:"amount" binding:"required,gt=0"`
	PayWay   int     `json:"payWay" binding:"oneof=0 1"` //0 支付宝 1 微信
	Platform string  `json:"platform"`
	Callback string  `json:"callback"`
}

// 支付网关返回的标准结构
type payResp struct {
	Code int        `json:"code"`
	Msg  string     `json:"msg"`
	Data *tradeData `json:"data"`
}

type tradeData struct {
	QRCode     string `json:"qrCode"`
	OutTradeNo string `json:"outTradeNo"`
}

type qrStatusResp struct {
	Code int           `json:"code"`
	Msg  string        `json:"msg"`
	Data *qrStatusData `json:"data"`
}

type qrStatusData struct {
	OutTradeNo string `json:"outTradeNo"`
	Status     string `json:"status"`
}

// 统一成功响应格式
type successResp struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
}

// —— Handler ——

// GET /order/getTradeInfo
func GetOrderInfo(c *gin.Context) {

	var req OrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, "无效的请求参数: "+err.Error())
		return
	}
	req.Platform = "yourapi"

	precision := 100.0
	if math.Round(req.Amount*precision) != req.Amount*precision {
		respondError(c, "订单创建失败")
		return
	}

	// 获取用户分组信息
	userId := c.GetInt("id")
	group, err := model.GetUserGroup(userId, true)
	if err != nil {
		respondError(c, "获取用户分组失败")
		return
	}

	// 直接使用请求金额进行折扣计算（元为单位）
	discountPayAmount := getDiscountPayAmountForOrder(req.Amount, group)
	creditAmount := getCreditAmountForOrder(req.Amount, group)

	// 修改请求金额为折扣后的金额，传递给支付网关
	req.Amount = discountPayAmount

	// 调用支付服务
	td, err := fetchTrade(c.Request.Context(), &req)
	if err != nil {
		respondError(c, err.Error())
		return
	}

	// 创建订单前记录日志
	fmt.Printf("准备创建订单: OutTradeNo=%s, UserId=%d, PayAmount=%.2f, GetAmount=%.2f, PayWay=%d\n", 
		td.OutTradeNo, userId, discountPayAmount, creditAmount, req.PayWay)

	if _, err := model.CreateOrder(td.OutTradeNo, td.QRCode, userId, discountPayAmount, creditAmount, req.PayWay); err != nil {
		fmt.Printf("订单创建失败: %v\n", err)
		respondError(c, "订单创建失败: " + err.Error())
		return
	}

	fmt.Printf("订单创建成功: OutTradeNo=%s\n", td.OutTradeNo)

	// 返回前端
	c.JSON(http.StatusOK, gin.H{
		"message": "",
		"success": true,
		"data":    td,
	})
}

// GET /order/queryTradeStatus
func QueryTradeStatus(c *gin.Context) {
	// 获取 outTradeNo 参数
	outTradeNo := c.Query("outTradeNo")
	// 获取 payWay 参数
	payWay := c.Query("payWay")

	resp, err := queryQRStatusAll(c, outTradeNo, payWay)

	if err != nil {
		respondError(c, err.Error())
		return
	}

	// 判断status是否等于OK
	if strings.EqualFold(resp.Status, "OK") {
		// 先记录日志
		fmt.Printf("支付状态查询成功，开始处理订单: %s\n", outTradeNo)
		
		err := model.CompleteOrder(outTradeNo)
		if err != nil {
			// 如果是重复处理或已经完成，仍然返回成功
			if strings.Contains(err.Error(), "已经完成") || strings.Contains(err.Error(), "已添加") {
				fmt.Printf("订单已处理: %s\n", outTradeNo)
				c.JSON(http.StatusOK, gin.H{
					"message": "",
					"success": true,
					"data":    "OK",
				})
				return
			}
			// 其他错误，记录详细日志
			fmt.Printf("CompleteOrder 失败: outTradeNo=%s, error=%v\n", outTradeNo, err)
			// 返回错误给前端，让用户知道出了问题
			respondError(c, "订单处理失败，请联系管理员: " + err.Error())
			return
		}
		
		fmt.Printf("订单处理成功: %s\n", outTradeNo)
		// 返回前端
		c.JSON(http.StatusOK, gin.H{
			"message": "",
			"success": true,
			"data":    "OK",
		})
		return
	} else {
		// 返回前端
		c.JSON(http.StatusOK, gin.H{
			"message": "",
			"success": true,
			"data":    "false",
		})
		return
	}
}

// —— 支付服务调用 ——

// fetchTrade 调用支付网关，返回 tradeData 或 错误
func fetchTrade(ctx context.Context, req *OrderReq) (*tradeData, error) {
	// 构建请求体
	payload := map[string]interface{}{
		"amount":   req.Amount,
		"payWay":   req.PayWay,
		"platform": req.Platform,
	}
	body, _ := json.Marshal(payload)

	// NewRequestWithContext 绑定 gin 的 Context
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		paymentGatewayURL,
		bytes.NewBuffer(body),
	)
	if err != nil {
		return nil, errors.New("构建支付请求失败: " + err.Error())
	}

	// 设置头
	httpReq.Header.Set("Authorization", "Bearer "+authToken)
	httpReq.Header.Set("Content-Type", "application/json")

	// 使用全局 httpClient 发送
	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, errors.New("支付服务请求失败: " + err.Error())
	}
	defer resp.Body.Close()

	// 解析
	var pr payResp
	if err := json.NewDecoder(resp.Body).Decode(&pr); err != nil {
		return nil, errors.New("解析支付响应失败: " + err.Error())
	}

	if pr.Code != 0 || pr.Data == nil {
		msg := pr.Msg
		if msg == "" {
			msg = "支付服务返回错误状态"
		}
		return nil, errors.New(msg)
	}
	return pr.Data, nil
}

func queryQRStatusAll(ctx context.Context, outTradeNo string, payWay string) (*qrStatusData, error) {
	// 构建 URL 带参数
	url := fmt.Sprintf("%s?outTradeNo=%s&payWay=%s", ueryGatewayURL, outTradeNo, payWay)

	// 创建 GET 请求
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	// 设置头
	req.Header.Set("Authorization", "Bearer "+authToken)
	if err != nil {
		return nil, errors.New("构建支付状态请求失败: " + err.Error())
	}

	// 发送请求
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, errors.New("调用支付状态查询接口失败: " + err.Error())
	}
	defer resp.Body.Close()

	// 解析响应
	var qrResp qrStatusResp
	if err := json.NewDecoder(resp.Body).Decode(&qrResp); err != nil {
		return nil, errors.New("解析支付状态响应失败: " + err.Error())
	}

	// 返回错误状态
	if qrResp.Code != 0 || qrResp.Data == nil {
		msg := qrResp.Msg
		if msg == "" {
			msg = "支付状态返回失败"
		}
		return nil, errors.New(msg)
	}

	return qrResp.Data, nil
}

// PaymentCallback 处理支付回调
func PaymentCallback(c *gin.Context) {
	// 支付回调结构体
	type CallbackData struct {
		OutTradeNo string `json:"outTradeNo"`
		Status     string `json:"status"`
		PayWay     int    `json:"payWay"`
		Amount     float64 `json:"amount"`
		Sign       string `json:"sign"`
	}

	var data CallbackData
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid callback data",
		})
		return
	}

	// TODO: 验证签名
	// if !verifySignature(data) {
	//     c.JSON(http.StatusUnauthorized, gin.H{
	//         "success": false,
	//         "message": "Invalid signature",
	//     })
	//     return
	// }

	// 如果状态是成功
	if strings.EqualFold(data.Status, "OK") || strings.EqualFold(data.Status, "SUCCESS") {
		err := model.CompleteOrder(data.OutTradeNo)
		if err != nil && !strings.Contains(err.Error(), "已经完成") {
			fmt.Printf("PaymentCallback CompleteOrder error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to process order",
			})
			return
		}
	}

	// 返回成功响应给支付网关
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Callback processed",
	})
}

// —— 错误统一响应 ——

// respondError 使用 success=false 并保留 HTTP 200
func respondError(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": msg,
	})
}
