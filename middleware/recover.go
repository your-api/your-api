package middleware

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"one-api/common"
	"runtime/debug"
)

func RelayPanicRecover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				common.SysError(fmt.Sprintf("relay panic detected: %v", err))
				common.SysError(fmt.Sprintf("stacktrace from panic: %s", string(debug.Stack())))
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": gin.H{
						"message": fmt.Sprintf("Panic detected, error: %v. Please submit a issue here: https://github.com/Calcium-Ion/new-api", err),
						"type":    "new_api_panic",
					},
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// 全局panic恢复中间件，确保所有REST接口都能恢复
func GlobalPanicRecover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// 记录panic信息
				common.SysError(fmt.Sprintf("global panic detected on %s %s: %v", c.Request.Method, c.Request.URL.Path, err))
				
				// 仅在调试模式下记录堆栈信息
				if common.DebugEnabled {
					common.SysError(fmt.Sprintf("stacktrace: %s", string(debug.Stack())))
				}
				
				// 返回统一的错误响应
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": gin.H{
						"message": "服务器内部错误，请稍后重试",
						"type":    "internal_server_error",
						"code":    "PANIC_RECOVERED",
					},
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// API专用panic恢复中间件
func APIPanicRecover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				common.SysError(fmt.Sprintf("API panic detected on %s %s: %v", c.Request.Method, c.Request.URL.Path, err))
				
				// 仅在调试模式下记录堆栈信息
				if common.DebugEnabled {
					common.SysError(fmt.Sprintf("stacktrace: %s", string(debug.Stack())))
				}
				
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "服务器内部错误",
					"data":    nil,
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
