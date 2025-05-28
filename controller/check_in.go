package controller

import (
	"net/http"
	"one-api/common"
	"one-api/model"
	"strconv"

	"github.com/gin-gonic/gin"
)

type CheckInRequest struct {
	ImageCaptchaId   string `json:"image_captcha_id"`
	ImageCaptchaCode string `json:"image_captcha_code"`
}

// CheckInUser 用户签到
func CheckInUser(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户未登录",
		})
		return
	}

	// 验证图片验证码
	var req CheckInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请完成图片验证码验证",
		})
		return
	}

	if req.ImageCaptchaId == "" || req.ImageCaptchaCode == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请完成图片验证码验证",
		})
		return
	}

	// 验证图片验证码是否正确
	if !VerifyImageCaptcha(req.ImageCaptchaId, req.ImageCaptchaCode) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "图片验证码错误或已过期",
		})
		return
	}

	checkIn, err := model.CheckInUser(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功！",
		"data": gin.H{
			"quota_reward":      checkIn.QuotaReward,
			"consecutive_days":  checkIn.ConsecutiveDays,
			"quota_reward_text": common.LogQuota(checkIn.QuotaReward),
		},
	})
}

// GetCheckInStatus 获取用户签到状态
func GetCheckInStatus(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户未登录",
		})
		return
	}

	status, err := model.GetUserCheckInStatus(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 格式化返回数据
	data := gin.H{
		"user_id":              status.UserId,
		"last_check_in_date":   status.LastCheckInDate.Format("2006-01-02"),
		"consecutive_days":     status.ConsecutiveDays,
		"total_check_in_days":  status.TotalCheckInDays,
		"this_month_check_ins": status.ThisMonthCheckIns,
		"has_checked_in_today": status.HasCheckedInToday,
		"can_check_in":         status.CanCheckIn,
		"next_reward_quota":    status.NextRewardQuota,
		"next_reward_text":     common.LogQuota(status.NextRewardQuota),
		"consecutive_bonus":    status.ConsecutiveBonus,
	}

	// 如果还没有签到记录，设置默认值
	if status.TotalCheckInDays == 0 {
		data["last_check_in_date"] = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

// GetCheckInCalendar 获取签到日历
func GetCheckInCalendar(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户未登录",
		})
		return
	}

	year, _ := strconv.Atoi(c.Query("year"))
	month, _ := strconv.Atoi(c.Query("month"))

	calendar, err := model.GetUserCheckInCalendar(userId, year, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 处理日历数据，添加格式化的额度文本
	var formattedCalendar []gin.H
	for _, day := range calendar {
		dayData := gin.H{
			"date":         day.Date,
			"has_check_in": day.HasCheckIn,
			"quota_reward": day.QuotaReward,
			"is_today":     day.IsToday,
		}

		if day.HasCheckIn {
			dayData["quota_reward_text"] = common.LogQuota(day.QuotaReward)
		}

		formattedCalendar = append(formattedCalendar, dayData)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    formattedCalendar,
	})
}

// GetCheckInStats 获取签到统计信息
func GetCheckInStats(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "用户未登录",
		})
		return
	}

	stats, err := model.GetCheckInStats(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// 格式化统计数据
	formattedStats := gin.H{
		"total_check_in_days":  stats["total_check_in_days"],
		"total_quota_earned":   stats["total_quota_earned"],
		"total_quota_text":     common.LogQuota(int(stats["total_quota_earned"].(int64))),
		"max_consecutive_days": stats["max_consecutive_days"],
		"this_month_check_ins": stats["this_month_check_ins"],
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    formattedStats,
	})
}
