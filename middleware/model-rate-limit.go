package middleware

import (
	"github.com/gin-gonic/gin"
)

// ModelRequestRateLimit 模型请求限流中间件
// 已禁用速率限制 - 所有请求直接通过
func ModelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Next()
	}
}