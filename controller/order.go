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
)

// —— 全局变量 & 常量 ——

// 全局复用的 HTTP 客户端，带 10s 超时
var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

// 支付网关地址
// const paymentGatewayURL = "https://api.aicnn.cn/app-api/pay/getTradeAll"
const paymentGatewayURL = "http://localhost:31020/app-api/pay/getTradeAll"
const ueryGatewayURL = "http://localhost:31020/app-api/pay/queryQRStatusAll"

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

	// 调用支付服务
	td, err := fetchTrade(c.Request.Context(), &req)
	if err != nil {
		respondError(c, err.Error())
		return
	}

	// 入库
	userId := c.GetInt("id")
	if _, err := model.CreateOrder(td.OutTradeNo, td.QRCode, userId, float64(req.Amount), float64(req.Amount)); err != nil {
		respondError(c, "订单创建失败")
		return
	}

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
		err := model.CompleteOrder(outTradeNo)
		if err != nil {
			return
		}
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

// —— 错误统一响应 ——

// respondError 使用 success=false 并保留 HTTP 200
func respondError(c *gin.Context, msg string) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": msg,
	})
}
