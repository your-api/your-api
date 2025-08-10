# 恢复手机绑定功能指南

## 问题说明
在merge后，手机绑定相关的后端API被删除了。需要恢复以下功能：

## 需要恢复的路由（在 router/api-router.go）

```go
// 在 SetApiRouter 函数中添加：

// 发送手机验证码
apiRouter.POST("/sms/send", middleware.CriticalRateLimit(), middleware.TurnstileCheck(), controller.SendPhoneVerification)

// 在 oauthRoute 组中添加：
oauthRoute.POST("/phone/bind", middleware.UserAuth(), controller.PhoneBind)
```

## 需要恢复的函数（在 controller/user.go）

```go
// PhoneBind 手机号绑定
func PhoneBind(c *gin.Context) {
	var req struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	
	// 验证手机号格式
	phoneRegex := regexp.MustCompile(`^1[3-9]\d{9}$`)
	if !phoneRegex.MatchString(req.Phone) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "手机号格式不正确",
		})
		return
	}
	
	// 验证手机验证码
	if !common.VerifyCodeWithKey(req.Phone, req.Code, "phone_verification") {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "验证码错误或已过期",
		})
		return
	}
	
	// 检查手机号是否已被其他用户绑定
	if model.IsPhoneAlreadyTaken(req.Phone) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该手机号已被其他用户绑定",
		})
		return
	}
	
	// 获取当前用户
	id := c.GetInt("id")
	user := model.User{
		Id: id,
	}
	err := user.FillUserById()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	
	// 更新用户手机号
	user.Phone = req.Phone
	err = user.Update(false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "手机号绑定成功",
	})
}
```

## 需要在 model/user.go 中添加的函数

```go
// IsPhoneAlreadyTaken 检查手机号是否已被占用
func IsPhoneAlreadyTaken(phone string) bool {
	if phone == "" {
		return false
	}
	var user User
	err := DB.Where("phone = ?", phone).First(&user).Error
	return err == nil
}

// GetUserByPhone 根据手机号获取用户
func GetUserByPhone(phone string) (*User, error) {
	if phone == "" {
		return nil, errors.New("手机号为空")
	}
	user := User{}
	err := DB.Where("phone = ?", phone).First(&user).Error
	return &user, err
}

// ResetUserPasswordByPhone 根据手机号重置密码
func ResetUserPasswordByPhone(phone string, password string) error {
	if phone == "" {
		return errors.New("手机号为空")
	}
	return DB.Model(&User{}).Where("phone = ?", phone).Update("password", password).Error
}
```

## 需要在 common/verification.go 中添加

```go
// VerifyCodeWithKey 验证手机验证码
func VerifyCodeWithKey(key string, code string, purpose string) bool {
	// 实现验证码验证逻辑
	// 可以使用 Redis 或数据库存储验证码
	cacheKey := fmt.Sprintf("verification:%s:%s", purpose, key)
	storedCode := GetCache(cacheKey)
	if storedCode == "" {
		return false
	}
	
	if storedCode != code {
		return false
	}
	
	// 验证成功后删除验证码
	DeleteCache(cacheKey)
	return true
}

// SaveVerificationCode 保存验证码
func SaveVerificationCode(key string, code string, purpose string) error {
	cacheKey := fmt.Sprintf("verification:%s:%s", purpose, key)
	// 验证码5分钟有效
	return SetCache(cacheKey, code, 5*60)
}
```

## 修改 controller/misc.go 中的 SendPhoneVerification

确保 `SendPhoneVerification` 函数正确调用短信发送接口，并保存验证码：

```go
// 在发送成功后保存验证码
code := common.GenerateVerificationCode(6) // 生成6位验证码
err = common.SaveVerificationCode(req.Phone, code, "phone_verification")
if err != nil {
    // 处理错误
}

// 调用短信发送接口
err = sendSMSCode(req.Phone, code)
```

## 前端已准备就绪

前端代码已经完整实现了：
- 图片验证码验证
- 手机验证码发送
- 手机号绑定
- 错误处理

API调用路径：
- POST `/api/sms/send` - 发送验证码（已改为 `/api/verification/phone`，需要调整）
- POST `/api/oauth/phone/bind` - 绑定手机号

## 参考原始实现

可以通过以下命令查看原始完整实现：

```bash
# 查看原始路由配置
git show 28496e98:router/api-router.go | grep -A 5 -B 5 phone

# 查看原始PhoneBind实现
git show 28496e98:controller/user.go | grep -A 100 "func PhoneBind"

# 查看原始SendPhoneVerification实现
git show 28496e98:controller/misc.go | grep -A 100 "func SendPhoneVerification"
```