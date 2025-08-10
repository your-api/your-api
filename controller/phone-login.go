package controller

import (
	"net/http"
	"one-api/common"
	"one-api/model"
	"regexp"

	"github.com/gin-gonic/gin"
)

type PhoneLoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
	Turnstile string `json:"turnstile"`
}

// PhoneLogin 手机号登录
func PhoneLogin(c *gin.Context) {
	var loginRequest PhoneLoginRequest
	err := c.ShouldBindJSON(&loginRequest)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// 验证手机号格式
	phoneRegex := regexp.MustCompile(`^1[3-9]\d{9}$`)
	if !phoneRegex.MatchString(loginRequest.Phone) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "手机号格式不正确",
		})
		return
	}

	// 查找用户
	user, err := model.GetUserByPhone(loginRequest.Phone)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户名或密码错误",
		})
		return
	}

	// 验证密码
	okay := common.ValidatePasswordAndHash(loginRequest.Password, user.Password)
	if !okay || user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户名或密码错误，或用户已被封禁",
		})
		return
	}

	// 设置登录session
	setupLogin(user, c)
}

// PhoneReset 手机号重置密码
func PhoneReset(c *gin.Context) {
	phone := c.Query("phone")
	code := c.Query("code")
	newPassword := c.Query("password")

	if phone == "" || code == "" || newPassword == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数不完整",
		})
		return
	}

	// 验证手机号格式
	phoneRegex := regexp.MustCompile(`^1[3-9]\d{9}$`)
	if !phoneRegex.MatchString(phone) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "手机号格式不正确",
		})
		return
	}

	// 这里应该验证短信验证码，暂时简化处理
	// TODO: 实现短信验证码验证逻辑

	// 重置密码
	hashedPassword, err := common.Password2Hash(newPassword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	err = model.ResetUserPasswordByPhone(phone, hashedPassword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "密码重置成功",
	})
}
