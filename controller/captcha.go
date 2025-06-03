package controller

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/http"
	"one-api/common"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/steambap/captcha"
)

const (
	CaptchaWidth  = 150
	CaptchaHeight = 50
	CaptchaLength = 4
)

// 生成图片验证码
func GenerateImageCaptcha(c *gin.Context) {
	// 创建验证码
	data, err := captcha.New(CaptchaWidth, CaptchaHeight, func(options *captcha.Options) {
		options.TextLength = CaptchaLength
		options.CurveNumber = 0  // 减少曲线数量，从2降为0
		options.Noise = 0.1      // 大幅减少噪点，从1.0降为0.1
		options.CharPreset = "0123456789"    // 只使用数字，避免字母混淆
		options.FontScale = 1.2   // 增大字体，让字符更清晰
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "验证码生成失败",
		})
		return
	}

	// 生成唯一ID
	captchaId := common.GenerateVerificationCode(32)

	// 如果Redis可用，存储到Redis中，否则使用内存存储
	if common.RedisEnabled {
		key := fmt.Sprintf("image_captcha:%s", captchaId)
		err := common.RedisSet(key, strings.ToUpper(data.Text), 5*time.Minute) // 5分钟过期，存储大写版本
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "验证码存储失败",
			})
			return
		}
	} else {
		// 使用内存存储作为后备
		common.RegisterVerificationCodeWithKey(captchaId, strings.ToUpper(data.Text), "image_captcha")
	}

	// 返回图片
	c.Header("Content-Type", "image/png")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("X-Captcha-Id", captchaId)

	err = data.WriteImage(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "图片输出失败",
		})
		return
	}
}

// 生成base64格式的图片验证码
func GenerateImageCaptchaBase64(c *gin.Context) {
	// 创建验证码
	data, err := captcha.New(CaptchaWidth, CaptchaHeight, func(options *captcha.Options) {
		options.TextLength = CaptchaLength
		options.CurveNumber = 0  // 减少曲线数量，从2降为0
		options.Noise = 0.1      // 大幅减少噪点，从1.0降为0.1
		options.CharPreset = "0123456789"    // 只使用数字，避免字母混淆
		options.FontScale = 1.2   // 增大字体，让字符更清晰
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "验证码生成失败",
		})
		return
	}

	// 生成唯一ID
	captchaId := common.GenerateVerificationCode(32)

	// 如果Redis可用，存储到Redis中，否则使用内存存储
	if common.RedisEnabled {
		key := fmt.Sprintf("image_captcha:%s", captchaId)
		err := common.RedisSet(key, strings.ToUpper(data.Text), 5*time.Minute) // 5分钟过期，存储大写版本
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "验证码存储失败",
			})
			return
		}
	} else {
		// 使用内存存储作为后备
		common.RegisterVerificationCodeWithKey(captchaId, strings.ToUpper(data.Text), "image_captcha")
	}

	// 将图片编码为base64
	var buf bytes.Buffer
	err = data.WriteImage(&buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "图片编码失败",
		})
		return
	}

	// 转换为base64
	imageData := base64.StdEncoding.EncodeToString(buf.Bytes())
	base64Image := fmt.Sprintf("data:image/png;base64,%s", imageData)

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"message":    "验证码生成成功",
		"captcha_id": captchaId,
		"image":      base64Image,
	})
}

// 验证图片验证码
func VerifyImageCaptcha(captchaId, userInput string) bool {
	if captchaId == "" || userInput == "" {
		return false
	}

	var storedValue string
	var found bool

	// 优先使用Redis
	if common.RedisEnabled {
		key := fmt.Sprintf("image_captcha:%s", captchaId)
		val, err := common.RedisGet(key)
		if err == nil {
			storedValue = val
			found = true
			// 验证后立即删除
			common.RedisDel(key)
		}
	}

	// 如果Redis中没有找到，尝试内存存储
	if !found {
		found = common.VerifyCodeWithKey(captchaId, strings.ToUpper(userInput), "image_captcha")
		return found
	}

	// 不区分大小写比较
	return strings.ToUpper(storedValue) == strings.ToUpper(userInput)
}

// 验证图片验证码的API接口
func VerifyImageCaptchaAPI(c *gin.Context) {
	captchaId := c.Query("captcha_id")
	userInput := c.Query("captcha_code")

	if VerifyImageCaptcha(captchaId, userInput) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "验证码验证成功",
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "验证码错误或已过期",
		})
	}
} 