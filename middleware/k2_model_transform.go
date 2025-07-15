package middleware

import (
	"github.com/gin-gonic/gin"
)

// K2ModelTransform 中间件用于标记这是 K2 请求，让后续处理知道需要转换模型
func K2ModelTransform() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置标记，表示这是 K2 请求，需要将模型转换为 kimi-k2-0711-preview
		c.Set("k2_transform", true)
		c.Next()
	}
} 