package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/model"
	"strings"
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

	// 优先通过微信ID查找现有用户（这是最可靠的方式）
	var user model.User
	err := model.DB.Where("wechat_id = ?", thirdPartyID).First(&user).Error
	
	if err == nil {
		// 找到了绑定此微信ID的用户
		if user.Status != common.UserStatusEnabled {
			// 检查是否是被合并的用户
			if strings.Contains(user.DisplayName, "(已合并)") {
				return fmt.Errorf("该微信账号已被合并到其他账号，请使用合并后的账号登录")
			} else {
				return fmt.Errorf("用户已被封禁")
			}
		}
		
		// 用户状态正常，直接登录
	} else {
		// 没有找到微信ID绑定的用户，再尝试通过用户名查找
		user = model.User{Username: username}
		err = model.DB.Where("username = ? AND status = ?", username, common.UserStatusEnabled).First(&user).Error
		
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
			// 找到了用户但没有绑定微信ID，更新微信ID
			if user.WeChatId == "" {
				user.WeChatId = thirdPartyID
				user.Update(false)
			} else if user.WeChatId != thirdPartyID {
				// 用户已经绑定了不同的微信ID
				return fmt.Errorf("该用户已绑定其他微信账号")
			}
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

// 检查微信扫码绑定状态 - 专门用于绑定现有账号
func CheckWeChatQRBind(c *gin.Context) {
	ticket := c.Query("ticket")
	if ticket == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "缺少ticket参数",
		})
		return
	}

	// 检查用户是否已登录
	session := sessions.Default(c)
	id := session.Get("id")
	if id == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "请先登录",
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
		// 扫码成功，进行绑定操作
		if loginResp.Data == nil || loginResp.Data.AppUserInfoVO == nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "扫码成功但获取用户信息失败",
			})
			return
		}

		// 处理绑定逻辑
		handleWeChatQRBind(loginResp.Data.AppUserInfoVO, c, id.(int))
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

// 处理微信扫码绑定
func handleWeChatQRBind(userInfo *AppUserInfoVO, c *gin.Context, userId int) error {
	// 使用第三方用户ID作为微信ID
	thirdPartyID := userInfo.ID

	// 获取当前用户
	currentUser := model.User{Id: userId}
	err := currentUser.FillUserById()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取用户信息失败: " + err.Error(),
		})
		return nil
	}

	// 检查当前用户是否已经绑定了微信
	if currentUser.WeChatId != "" {
		// 如果已经绑定了相同的微信ID，返回成功
		if currentUser.WeChatId == thirdPartyID {
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"status":  "success",
				"message": "微信已绑定",
				"data": gin.H{
					"action": "already_bound",
				},
			})
			return nil
		} else {
			// 这是一个正常用户的绑定，不允许重新绑定
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"status":  "error",
				"message": "该微信账号已被其他用户绑定，为了防止恶意刷取额度，不支持重新绑定",
			})
			return nil
		}
	}

	// 检查该微信ID是否已被其他用户绑定
	var existingUser model.User
	err = model.DB.Where("wechat_id = ?", thirdPartyID).First(&existingUser).Error
	if err == nil {
		// 找到了其他用户使用这个微信ID
		// 检查是否是微信自动创建的用户，如果是则自动合并
		if strings.HasPrefix(existingUser.Username, "wx-") && existingUser.DisplayName != "" && strings.Contains(existingUser.DisplayName, "微信用户_") {
			// 这是一个微信自动创建的用户，执行账号合并
			err = mergeUserData(&currentUser, &existingUser)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": "账号合并失败: " + err.Error(),
				})
				return nil
			}
			
			// 发送合并成功响应
			c.JSON(http.StatusOK, gin.H{
				"success": true,
				"status":  "success",
				"message": "微信账号合并绑定成功",
				"data": gin.H{
					"action":              "merged",
					"merged_quota":        existingUser.Quota,
					"merged_used_quota":   existingUser.UsedQuota,
					"merged_request_count": existingUser.RequestCount,
					"wechat_username":     existingUser.Username,
				},
			})
			return nil
		} else {
			// 这是一个正常用户的绑定，不允许重新绑定
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"status":  "error",
				"message": "该微信账号已被其他用户绑定，为了防止恶意刷取额度，不支持重新绑定",
			})
			return nil
		}
	}

	// 微信ID未被绑定，直接绑定到当前用户
	currentUser.WeChatId = thirdPartyID
	err = currentUser.Update(false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "绑定失败: " + err.Error(),
		})
		return nil
	}

	// 发送绑定成功响应
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"status":  "success",
		"message": "微信绑定成功",
		"data": gin.H{
			"action": "bound",
		},
	})

	return nil
}

// 执行用户数据合并
func mergeUserData(targetUser *model.User, sourceUser *model.User) error {
	// 开始数据库事务
	tx := model.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 合并数据到目标用户
	targetUser.Quota += sourceUser.Quota                   // 合并余额
	targetUser.UsedQuota += sourceUser.UsedQuota           // 合并历史消耗
	targetUser.RequestCount += sourceUser.RequestCount     // 合并请求次数
	targetUser.AffQuota += sourceUser.AffQuota             // 合并邀请余额
	targetUser.AffHistoryQuota += sourceUser.AffHistoryQuota // 合并邀请历史
	targetUser.AffCount += sourceUser.AffCount             // 合并邀请人数
	targetUser.PayCount += sourceUser.PayCount             // 合并充值次数
	targetUser.RewardQuota += sourceUser.RewardQuota       // 合并奖励余额
	targetUser.WithdrawedQuota += sourceUser.WithdrawedQuota   // 合并提现金额
	targetUser.WithdrawingQuota += sourceUser.WithdrawingQuota // 合并提现中金额
	targetUser.WeChatId = sourceUser.WeChatId               // 绑定微信ID

	// 更新目标用户
	if err := tx.Save(targetUser).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新目标用户失败: %s", err.Error())
	}

	// 更新源用户的邀请关系 - 将源用户邀请的用户转移到目标用户
	if err := tx.Model(&model.User{}).Where("inviter_id = ?", sourceUser.Id).Update("inviter_id", targetUser.Id).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新邀请关系失败: %s", err.Error())
	}

	// 清空源用户的敏感数据并标记为已删除
	sourceUser.WeChatId = ""
	sourceUser.Quota = 0
	sourceUser.UsedQuota = 0
	sourceUser.RequestCount = 0
	sourceUser.AffQuota = 0
	sourceUser.AffHistoryQuota = 0
	sourceUser.AffCount = 0
	sourceUser.PayCount = 0
	sourceUser.RewardQuota = 0
	sourceUser.WithdrawedQuota = 0
	sourceUser.WithdrawingQuota = 0
	sourceUser.Status = common.UserStatusDisabled // 禁用账号
	sourceUser.DisplayName = sourceUser.DisplayName + " (已合并)"

	// 更新源用户
	if err := tx.Save(sourceUser).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新源用户失败: %s", err.Error())
	}

	// 提交事务
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("事务提交失败: %s", err.Error())
	}

	return nil
}

// 账号合并功能 - 将微信账号数据合并到当前账号
// 为了防止刷额度，暂时禁用手动合并功能，只允许自动合并
/*
func MergeWeChatAccount(c *gin.Context) {
	// 检查用户是否已登录
	session := sessions.Default(c)
	id := session.Get("id")
	if id == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "请先登录",
		})
		return
	}

	// 获取请求参数
	var request struct {
		WeChatUsername string `json:"wechat_username"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数格式错误",
		})
		return
	}

	if request.WeChatUsername == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请输入微信账号用户名",
		})
		return
	}

	userId := id.(int)
	
	// 获取当前用户信息
	currentUser := model.User{Id: userId}
	err := currentUser.FillUserById()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取当前用户信息失败",
		})
		return
	}

	// 检查当前用户是否已经绑定了微信
	if currentUser.WeChatId != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "当前账号已绑定微信，无需合并",
		})
		return
	}

	// 查找要合并的微信账号
	var wechatUser model.User
	err = model.DB.Where("username = ?", request.WeChatUsername).First(&wechatUser).Error
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "未找到指定的微信账号",
		})
		return
	}

	// 验证是否是微信自动创建的账号
	if !strings.HasPrefix(wechatUser.Username, "wx-") || wechatUser.WeChatId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "该账号不是微信账号或不支持合并",
		})
		return
	}

	// 检查微信账号状态
	if wechatUser.Status != common.UserStatusEnabled {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "微信账号状态异常，无法合并",
		})
		return
	}

	// 执行账号合并逻辑
	err = mergeUserData(&currentUser, &wechatUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "账号合并失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "账号合并成功",
		"data": gin.H{
			"merged_quota":        wechatUser.Quota,
			"merged_used_quota":   wechatUser.UsedQuota,
			"merged_request_count": wechatUser.RequestCount,
			"wechat_id":           wechatUser.WeChatId,
		},
	})
}
*/ 