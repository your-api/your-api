package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/model"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-contrib/sessions"
)

// 第三方微信扫码API响应结构
type WeChatQRResponse struct {
	Ticket string `json:"ticket"`
	URL    string `json:"url"`
}

type WeChatLoginCheckResponse struct {
	Code int `json:"code"`
	Data *WeChatLoginData `json:"data"`
	Msg  string `json:"msg"`
}

type WeChatLoginData struct {
	UserID        string         `json:"userId"`
	AppUserInfoVO *AppUserInfoVO `json:"appUserInfoVO"`
	AccessToken   string         `json:"accessToken"`
	RefreshToken  string         `json:"refreshToken"`
	ExpiresTime   int64          `json:"expiresTime"`
}

type AppUserInfoVO struct {
	ID                      string  `json:"id"`
	Username                string  `json:"username"`
	Email                   string  `json:"email"`
	Mobile                  string  `json:"mobile"`
	UserLevel               int     `json:"userLevel"`
	LinuxTrustLevel         *int    `json:"linuxTrustLevel"`
	UserSignExpireTime      int64   `json:"userSignExpireTime"`
	UserPackage             int     `json:"userPackage"`
	UserPackageExpireTime   int64   `json:"userPackageExpireTime"`
	Avatar                  string  `json:"avatar"`
	InviteCode              string  `json:"inviteCode"`
	HasSignIn               bool    `json:"hasSignIn"`
	LoginDate               int64   `json:"loginDate"`
	Integral                int     `json:"integral"`
	UserPackage2            *int    `json:"userPackage2"`
	Integral2               *int    `json:"integral2"`
	UserPackageExpireTime2  *int64  `json:"userPackageExpireTime2"`
	MorePackageTime         *int64  `json:"morePackageTime"`
	InviterUsers            *string `json:"inviterUsers"`
	TotalAmount             float64 `json:"totalAmount"`
	Settled                 *string `json:"settled"`
	Comment                 *string `json:"comment"`
	IsFirstOrder            bool    `json:"isFirstOrder"`
	PhoneNum                *string `json:"phoneNum"`
	LdName                  *string `json:"ldName"`
	WechatName              *string `json:"wechatName"`
	ExperiencePackageVO     *string `json:"experiencePackageVO"`
}

// 获取微信扫码二维码
func GetWeChatQRCode(c *gin.Context) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get("https://api.aicnn.cn/app-api/wechat/getQrCode")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取二维码失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	var qrResp WeChatQRResponse
	if err := json.NewDecoder(resp.Body).Decode(&qrResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "解析响应失败: " + err.Error(),
		})
		return
	}

	if qrResp.Ticket == "" || qrResp.URL == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取二维码信息不完整",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"ticket": qrResp.Ticket,
			"qr_url": qrResp.URL,
		},
	})
}

// 检查微信扫码登录状态
func CheckWeChatQRLogin(c *gin.Context) {
	ticket := c.Query("ticket")
	if ticket == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "缺少ticket参数",
		})
		return
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	url := fmt.Sprintf("https://api.aicnn.cn/app-api/wechat/checkLogin?ticket=%s", ticket)
	resp, err := client.Get(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "检查登录状态失败: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	var loginResp WeChatLoginCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "解析响应失败: " + err.Error(),
		})
		return
	}

	// 检查响应码
	switch loginResp.Code {
	case 1002000016:
		// 用户未扫码
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"status": "waiting",
			"message": "等待用户扫码",
		})
		return
	case 0:
		// 扫码成功，处理用户登录/注册
		if loginResp.Data == nil || loginResp.Data.AppUserInfoVO == nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "扫码成功但获取用户信息失败",
			})
			return
		}

		// 处理用户登录/注册逻辑
		err := handleWeChatQRUser(loginResp.Data.AppUserInfoVO, c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		return
	default:
		// 其他错误
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"status": "error",
			"message": loginResp.Msg,
		})
		return
	}
}

// 处理微信扫码用户登录/注册
func handleWeChatQRUser(userInfo *AppUserInfoVO, c *gin.Context) error {
	// 使用第三方用户ID作为唯一标识
	thirdPartyID := userInfo.ID
	username := userInfo.Username

	// 检查是否已存在该用户（通过username查找，因为这是唯一的）
	user := model.User{Username: username}
	err := model.DB.Where("username = ?", username).First(&user).Error
	
	if err != nil {
		// 用户不存在，创建新用户
		if !common.RegisterEnabled {
			return fmt.Errorf("管理员已关闭新用户注册")
		}

		// 处理邀请码
		var inviterId int = 0
		if affCode := c.Query("aff"); affCode != "" {
			inviterId, _ = model.GetUserIdByAffCode(affCode)
		}

		user = model.User{
			Username:    username,
			DisplayName: fmt.Sprintf("微信用户_%s", userInfo.ID),
			Role:        common.RoleCommonUser,
			Status:      common.UserStatusEnabled,
			RegisterIP:  c.ClientIP(),
			// 可以存储第三方用户ID到WeChatId字段
			WeChatId:    thirdPartyID,
			InviterId:   inviterId,
		}

		if err := user.Insert(inviterId); err != nil {
			return fmt.Errorf("创建用户失败: %s", err.Error())
		}
	} else {
		// 用户已存在，检查状态
		if user.Status != common.UserStatusEnabled {
			return fmt.Errorf("用户已被封禁")
		}
		
		// 更新微信ID（如果之前没有设置）
		if user.WeChatId == "" {
			user.WeChatId = thirdPartyID
			user.Update(false)
		}
	}

	// 设置登录会话（但不发送响应）
	session := sessions.Default(c)
	session.Set("id", user.Id)
	session.Set("username", user.Username)
	session.Set("role", user.Role)
	session.Set("status", user.Status)
	session.Set("group", user.Group)
	err = session.Save()
	if err != nil {
		return fmt.Errorf("无法保存会话信息: %s", err.Error())
	}
	
	// 发送登录成功响应，包含status字段
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  "success",
		"message": "登录成功",
		"data":    user,
	})
	
	return nil
} 