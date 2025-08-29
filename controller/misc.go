package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/console_setting"
	"one-api/setting/operation_setting"
	"one-api/setting/system_setting"
	"strings"

	"github.com/gin-gonic/gin"
)

func TestStatus(c *gin.Context) {
	err := model.PingDB()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "数据库连接失败",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Server is running",
	})
	return
}

func GetStatus(c *gin.Context) {
	cs := console_setting.GetConsoleSetting()

	data := gin.H{
		"version":                     common.Version,
		"start_time":                  common.StartTime,
		"email_verification":          common.EmailVerificationEnabled,
		"github_oauth":                common.GitHubOAuthEnabled,
		"github_client_id":            common.GitHubClientId,
		"linuxdo_oauth":               common.LinuxDOOAuthEnabled,
		"linuxdo_client_id":           common.LinuxDOClientId,
		"linuxdo_minimum_trust_level": common.LinuxDOMinimumTrustLevel,
		"telegram_oauth":              common.TelegramOAuthEnabled,
		"telegram_bot_name":           common.TelegramBotName,
		"system_name":                 common.SystemName,
		"logo":                        common.Logo,
		"footer_html":                 common.Footer,
		"wechat_qrcode":               common.WeChatAccountQRCodeImageURL,
		"wechat_login":                common.WeChatAuthEnabled,
		"server_address":              setting.ServerAddress,
		"price":                       setting.Price,
		"stripe_unit_price":           setting.StripeUnitPrice,
		"min_topup":                   setting.MinTopUp,
		"stripe_min_topup":            setting.StripeMinTopUp,
		"turnstile_check":             common.TurnstileCheckEnabled,
		"turnstile_site_key":          common.TurnstileSiteKey,
		"top_up_link":                 common.TopUpLink,
		"docs_link":                   operation_setting.GetGeneralSetting().DocsLink,
		"quota_per_unit":              common.QuotaPerUnit,
		"display_in_currency":         common.DisplayInCurrencyEnabled,
		"enable_batch_update":         common.BatchUpdateEnabled,
		"enable_drawing":              common.DrawingEnabled,
		"enable_task":                 common.TaskEnabled,
		"enable_data_export":          common.DataExportEnabled,
		"data_export_default_time":    common.DataExportDefaultTime,
		"default_collapse_sidebar":    common.DefaultCollapseSidebar,
		"enable_online_topup":         setting.PayAddress != "" && setting.EpayId != "" && setting.EpayKey != "",
		"enable_stripe_topup":         setting.StripeApiSecret != "" && setting.StripeWebhookSecret != "" && setting.StripePriceId != "",
		"mj_notify_enabled":           setting.MjNotifyEnabled,
		"chats":                       setting.Chats,
		"demo_site_enabled":           operation_setting.DemoSiteEnabled,
		"self_use_mode_enabled":       operation_setting.SelfUseModeEnabled,
		"default_use_auto_group":      setting.DefaultUseAutoGroup,
		"pay_methods":                 setting.PayMethods,
		"usd_exchange_rate":           setting.USDExchangeRate,

		// 面板启用开关
		"api_info_enabled":      cs.ApiInfoEnabled,
		"uptime_kuma_enabled":   cs.UptimeKumaEnabled,
		"announcements_enabled": cs.AnnouncementsEnabled,
		"faq_enabled":           cs.FAQEnabled,

		"oidc_enabled":                system_setting.GetOIDCSettings().Enabled,
		"oidc_client_id":              system_setting.GetOIDCSettings().ClientId,
		"oidc_authorization_endpoint": system_setting.GetOIDCSettings().AuthorizationEndpoint,
		"setup":                       constant.Setup,
	}

	// 根据启用状态注入可选内容
	if cs.ApiInfoEnabled {
		data["api_info"] = console_setting.GetApiInfo()
	}
	if cs.AnnouncementsEnabled {
		data["announcements"] = console_setting.GetAnnouncements()
	}
	if cs.FAQEnabled {
		data["faq"] = console_setting.GetFAQ()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
	return
}

func GetNotice(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["Notice"],
	})
	return
}

func GetAbout(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["About"],
	})
	return
}

func GetContact(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()

	// 获取ContactInfo JSON字符串
	contactInfoStr, exists := common.OptionMap["ContactInfo"]
	if !exists || contactInfoStr == "" {
		// 如果没有ContactInfo，返回默认值
		defaultContactInfo := gin.H{
			"ContactPhone":       "",
			"ContactEmail":       "",
			"ContactAddress":     "",
			"ContactWeChat":      "",
			"ContactQQ":          "",
			"ContactTelegram":    "",
			"ContactWorkTime":    "周一至周五 9:00-18:00",
			"ContactDescription": "如有任何问题或建议，请随时联系我们的客服团队。我们将竭诚为您服务！",
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    defaultContactInfo,
		})
		return
	}

	// 解析JSON
	var contactInfo gin.H
	if err := json.Unmarshal([]byte(contactInfoStr), &contactInfo); err != nil {
		// JSON解析失败，返回默认值
		defaultContactInfo := gin.H{
			"ContactPhone":       "",
			"ContactEmail":       "",
			"ContactAddress":     "",
			"ContactWeChat":      "",
			"ContactQQ":          "",
			"ContactTelegram":    "",
			"ContactWorkTime":    "周一至周五 9:00-18:00",
			"ContactDescription": "如有任何问题或建议，请随时联系我们的客服团队。我们将竭诚为您服务！",
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    defaultContactInfo,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    contactInfo,
	})
	return
}

func GetMidjourney(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["Midjourney"],
	})
	return
}

func GetHomePageContent(c *gin.Context) {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    common.OptionMap["HomePageContent"],
	})
	return
}

// GetPaymentConfig 获取支付配置（公开接口，供普通用户使用）
func GetPaymentConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"wechat_pay_enabled": setting.WechatPayEnabled,
			"alipay_enabled":     true, // 支付宝始终可用
			"online_topup_enabled": setting.PayAddress != "" && setting.EpayId != "" && setting.EpayKey != "",
		},
	})
	return
}

func SendEmailVerification(c *gin.Context) {
	email := c.Query("email")
	imageCaptchaId := c.Query("image_captcha_id")
	imageCaptchaCode := c.Query("image_captcha_code")

	// 验证图片验证码
	if imageCaptchaId != "" && imageCaptchaCode != "" {
		if !VerifyImageCaptcha(imageCaptchaId, imageCaptchaCode) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片验证码错误或已过期",
			})
			return
		}
	} else {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请先完成图片验证码验证",
		})
		return
	}

	if err := common.Validate.Var(email, "required,email"); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的邮箱地址",
		})
		return
	}
	localPart := parts[0]
	domainPart := parts[1]

	// 检查是否为QQ或Gmail邮箱
	if domainPart != "qq.com" && domainPart != "gmail.com" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "仅支持QQ邮箱(@qq.com)和Gmail邮箱(@gmail.com)",
		})
		return
	}

	if common.EmailDomainRestrictionEnabled {
		allowed := false
		for _, domain := range common.EmailDomainWhitelist {
			if domainPart == domain {
				allowed = true
				break
			}
		}
		if !allowed {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "The administrator has enabled the email domain name whitelist, and your email address is not allowed due to special symbols or it's not in the whitelist.",
			})
			return
		}
	}
	if common.EmailAliasRestrictionEnabled {
		containsSpecialSymbols := strings.Contains(localPart, "+") || strings.Contains(localPart, ".")
		if containsSpecialSymbols {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。",
			})
			return
		}
	}

	if model.IsEmailAlreadyTaken(email) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "邮箱地址已被占用",
		})
		return
	}
	code := common.GenerateNumericVerificationCode(6)
	common.RegisterVerificationCodeWithKey(email, code, common.EmailVerificationPurpose)
	subject := fmt.Sprintf("%s邮箱验证邮件", common.SystemName)
	content := fmt.Sprintf("<p>您好，你正在进行%s邮箱验证。</p>"+
		"<p>您的验证码为: <strong>%s</strong></p>"+
		"<p>验证码 %d 分钟内有效，如果不是本人操作，请忽略。</p>", common.SystemName, code, common.VerificationValidMinutes)
	err := common.SendEmail(subject, email, content)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func SendPhoneVerification(c *gin.Context) {
	var req struct {
		Phone            string `json:"phone"`
		Code             string `json:"code"`
		Purpose          string `json:"purpose"`            // register, login, reset_password
		ImageCaptchaId   string `json:"image_captcha_id"`   // 图片验证码ID
		ImageCaptchaCode string `json:"image_captcha_code"` // 图片验证码
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// 对于注册、重置密码和绑定，需要验证图片验证码
	purpose := req.Purpose
	if purpose == "" {
		purpose = "register" // 默认为注册
	}

	if purpose == "register" || purpose == "reset_password" || purpose == "bind" {
		// 验证图片验证码
		if req.ImageCaptchaId != "" && req.ImageCaptchaCode != "" {
			if !VerifyImageCaptcha(req.ImageCaptchaId, req.ImageCaptchaCode) {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "图片验证码错误或已过期",
				})
				return
			}
		} else {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请先完成图片验证码验证",
			})
			return
		}
	}

	// 验证手机号格式
	if len(req.Phone) != 11 || req.Phone[:1] != "1" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的手机号格式",
		})
		return
	}

	// 根据用途检查手机号状态
	phoneExists := model.IsPhoneAlreadyTaken(req.Phone, 0)

	switch purpose {
	case "register":
		if phoneExists {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "手机号已被注册",
			})
			return
		}
	case "login", "reset_password":
		if !phoneExists {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "手机号未注册",
			})
			return
		}
	case "bind":
		if phoneExists {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "该手机号已被其他用户绑定",
			})
			return
		}
	default:
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用途参数",
		})
		return
	}

	// 生成6位纯数字验证码
	code := common.GenerateNumericVerificationCode(6)
	common.RegisterVerificationCodeWithKey(req.Phone, code, common.PhoneVerificationPurpose)

	// 调用外部短信API发送验证码
	err := sendSMSCode(req.Phone, code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "发送验证码失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "验证码发送成功",
	})
	return
}

// SMSResponse 短信API响应结构
type SMSResponse struct {
	Code int         `json:"code"`
	Data interface{} `json:"data"`
	Msg  string      `json:"msg"`
}

// sendSMSCode 发送短信验证码
func sendSMSCode(phone, code string) error {
	// 构建请求数据
	requestData := map[string]string{
		"phone": phone,
		"code":  code,
	}

	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return fmt.Errorf("构建请求数据失败: %v", err)
	}

	// 创建HTTP请求
	req, err := http.NewRequest("POST", "https://api.aicnn.cn/app-api/system/user/sendSms", bytes.NewBuffer(jsonData))
	//req, err := http.NewRequest("POST", "http://localhost:31020/app-api/system/user/sendSms", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("创建请求失败: %v", err)
	}

	// 设置请求头
	req.Header.Set("Authorization", "Bearer zzzqqqfsadfsa")
	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("读取响应失败: %v", err)
	}

	// 检查HTTP状态码
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP请求失败，状态码: %d, 响应: %s", resp.StatusCode, string(body))
	}

	// 解析JSON响应
	var smsResp SMSResponse
	if err := json.Unmarshal(body, &smsResp); err != nil {
		return fmt.Errorf("解析响应JSON失败: %v, 响应内容: %s", err, string(body))
	}

	// 检查业务状态码
	// 根据您提供的错误信息，成功的状态码应该不是1002000010
	if smsResp.Code != 200 && smsResp.Code != 0 { // 假设成功状态码是200或0
		return fmt.Errorf("短信发送失败: %s (错误码: %d)", smsResp.Msg, smsResp.Code)
	}

	return nil
}

func SendPasswordResetEmail(c *gin.Context) {
	email := c.Query("email")
	if err := common.Validate.Var(email, "required,email"); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if !model.IsEmailAlreadyTaken(email) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该邮箱地址未注册",
		})
		return
	}
	code := common.GenerateNumericVerificationCode(6)
	common.RegisterVerificationCodeWithKey(email, code, common.PasswordResetPurpose)
	link := fmt.Sprintf("%s/user/reset?email=%s&token=%s", setting.ServerAddress, email, code)
	subject := fmt.Sprintf("%s密码重置", common.SystemName)
	content := fmt.Sprintf("<p>您好，你正在进行%s密码重置。</p>"+
		"<p>点击 <a href='%s'>此处</a> 进行密码重置。</p>"+
		"<p>如果链接无法点击，请尝试点击下面的链接或将其复制到浏览器中打开：<br> %s </p>"+
		"<p>重置链接 %d 分钟内有效，如果不是本人操作，请忽略。</p>", common.SystemName, link, link, common.VerificationValidMinutes)
	err := common.SendEmail(subject, email, content)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type PasswordResetRequest struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

func ResetPassword(c *gin.Context) {
	var req PasswordResetRequest
	err := json.NewDecoder(c.Request.Body).Decode(&req)
	if req.Email == "" || req.Token == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if !common.VerifyCodeWithKey(req.Email, req.Token, common.PasswordResetPurpose) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "重置链接非法或已过期",
		})
		return
	}
	password := common.GenerateVerificationCode(12)
	err = model.ResetUserPasswordByEmail(req.Email, password)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	common.DeleteKey(req.Email, common.PasswordResetPurpose)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    password,
	})
	return
}

type PhonePasswordResetRequest struct {
	Phone       string `json:"phone"`
	PhoneCode   string `json:"phone_code"`
	NewPassword string `json:"new_password"`
}

func ResetPasswordByPhone(c *gin.Context) {
	var req PhonePasswordResetRequest
	err := json.NewDecoder(c.Request.Body).Decode(&req)
	if req.Phone == "" || req.PhoneCode == "" || req.NewPassword == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// 验证新密码长度
	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "密码长度至少6位",
		})
		return
	}

	// 验证手机号格式
	if len(req.Phone) != 11 || req.Phone[:1] != "1" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "手机号格式不正确",
		})
		return
	}

	// 验证手机验证码
	if !common.VerifyCodeWithKey(req.Phone, req.PhoneCode, common.PhoneVerificationPurpose) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "验证码错误或已过期",
		})
		return
	}

	// 检查手机号是否注册
	if !model.IsPhoneAlreadyTaken(req.Phone, 0) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该手机号未注册",
		})
		return
	}

	// 使用用户提供的新密码 - 需要先加密
	hashedPassword, err := common.Password2Hash(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "密码处理失败",
		})
		return
	}
	
	err = model.ResetUserPasswordByPhone(req.Phone, hashedPassword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 删除已使用的验证码
	common.DeleteKey(req.Phone, common.PhoneVerificationPurpose)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "密码重置成功",
	})
	return
}

func TestIP(c *gin.Context) {
	clientIP := common.GetClientIP(c)
	ginDefaultIP := c.ClientIP()

	headers := map[string]string{
		"X-Real-IP":         c.GetHeader("X-Real-IP"),
		"X-Forwarded-For":   c.GetHeader("X-Forwarded-For"),
		"CF-Connecting-IP":  c.GetHeader("CF-Connecting-IP"),
		"X-Forwarded-Host":  c.GetHeader("X-Forwarded-Host"),
		"X-Forwarded-Proto": c.GetHeader("X-Forwarded-Proto"),
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"client_ip":      clientIP,
			"gin_default_ip": ginDefaultIP,
			"remote_addr":    c.Request.RemoteAddr,
			"headers":        headers,
		},
	})
}
