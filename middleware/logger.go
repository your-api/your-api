package middleware

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"one-api/common"
	"io"
)

func SetUpLogger(server *gin.Engine) {
	// 禁用gin访问日志以提高性能
	gin.DefaultWriter = io.Discard
	gin.DefaultErrorWriter = io.Discard
	
	// 不添加logger中间件，减少IO操作
	// server.Use(gin.LoggerWithFormatter(...)) 被注释掉
	
	// 如果需要调试，可以通过环境变量启用
	if common.DebugEnabled {
		server.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
			var requestID string
			if param.Keys != nil {
				requestID = param.Keys[common.RequestIdKey].(string)
			}
			return fmt.Sprintf("[GIN] %s | %s | %3d | %13v | %15s | %7s %s\n",
				param.TimeStamp.Format("2006/01/02 - 15:04:05"),
				requestID,
				param.StatusCode,
				param.Latency,
				param.ClientIP,
				param.Method,
				param.Path,
			)
		}))
	}
}
