package logger

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"one-api/common"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	loggerINFO  = "INFO"
	loggerWarn  = "WARN"
	loggerError = "ERR"
	loggerDebug = "DEBUG"
)

const maxLogCount = 1000000

var logCount int
var setupLogLock sync.Mutex
var setupLogWorking bool

// 添加日志开关变量
var LoggingEnabled = false

func SetupLogger() {
	defer func() {
		setupLogWorking = false
	}()
	
	// 使用common中的LoggingEnabled配置
	LoggingEnabled = common.LoggingEnabled
	
	if *common.LogDir != "" && LoggingEnabled {
		ok := setupLogLock.TryLock()
		if !ok {
			log.Println("setup log is already working")
			return
		}
		defer func() {
			setupLogLock.Unlock()
		}()
		logPath := filepath.Join(*common.LogDir, fmt.Sprintf("oneapi-%s.log", time.Now().Format("20060102150405")))
		fd, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Fatal("failed to open log file")
		}
		gin.DefaultWriter = io.MultiWriter(os.Stdout, fd)
		gin.DefaultErrorWriter = io.MultiWriter(os.Stderr, fd)
	} else {
		// 禁用日志输出以提高性能
		gin.DefaultWriter = io.Discard
		gin.DefaultErrorWriter = io.Discard
	}
}

// System logging functions moved to common package for better organization
func LogInfo(ctx context.Context, msg string) {
	if !LoggingEnabled {
		return
	}
	logHelper(ctx, loggerINFO, msg)
}

func LogWarn(ctx context.Context, msg string) {
	if !LoggingEnabled {
		return
	}
	logHelper(ctx, loggerWarn, msg)
}

func LogError(ctx context.Context, msg string) {
	// 错误日志仍然保留，但仅输出到stderr
	if LoggingEnabled {
		logHelper(ctx, loggerError, msg)
	}
}

func LogDebug(ctx context.Context, msg string) {
	if common.DebugEnabled {
		logHelper(ctx, loggerDebug, msg)
	}
}

func logHelper(ctx context.Context, level string, msg string) {
	if !LoggingEnabled {
		return
	}
	
	writer := gin.DefaultErrorWriter
	if level == loggerINFO {
		writer = gin.DefaultWriter
	}
	id := ctx.Value(common.RequestIdKey)
	if id == nil {
		id = "SYSTEM"
	}
	now := time.Now()
	_, _ = fmt.Fprintf(writer, "[%s] %v | %s | %s \n", level, now.Format("2006/01/02 - 15:04:05"), id, msg)
	logCount++ // we don't need accurate count, so no lock here
	if logCount > maxLogCount && !setupLogWorking {
		logCount = 0
		setupLogWorking = true
		gopool.Go(func() {
			SetupLogger()
		})
	}
}

// FatalLog function moved to common package for better organization
func LogQuota(quota int) string {
	if common.DisplayInCurrencyEnabled {
		return fmt.Sprintf("＄%.6f 额度", float64(quota)/common.QuotaPerUnit)
	} else {
		return fmt.Sprintf("%d 点额度", quota)
	}
}

func FormatQuota(quota int) string {
	if common.DisplayInCurrencyEnabled {
		return fmt.Sprintf("＄%.6f", float64(quota)/common.QuotaPerUnit)
	} else {
		return fmt.Sprintf("%d", quota)
	}
}

// LogJson 仅供测试使用 only for test
func LogJson(ctx context.Context, msg string, obj any) {
	jsonStr, err := json.Marshal(obj)
	if err != nil {
		LogError(ctx, fmt.Sprintf("json marshal failed: %s", err.Error()))
		return
	}
	LogInfo(ctx, fmt.Sprintf("%s | %s", msg, string(jsonStr)))
}
