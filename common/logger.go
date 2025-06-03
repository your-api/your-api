package common

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	loggerINFO  = "INFO"
	loggerWarn  = "WARN"
	loggerError = "ERR"
)

const maxLogCount = 1000000

var logCount int
var setupLogLock sync.Mutex
var setupLogWorking bool

// 添加日志开关变量
var LoggingEnabled = false

func SetupLogger() {
	// 禁用日志以提高性能
	LoggingEnabled = false
	
	if *LogDir != "" && LoggingEnabled {
		ok := setupLogLock.TryLock()
		if !ok {
			log.Println("setup log is already working")
			return
		}
		defer func() {
			setupLogLock.Unlock()
			setupLogWorking = false
		}()
		logPath := filepath.Join(*LogDir, fmt.Sprintf("oneapi-%s.log", time.Now().Format("20060102150405")))
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

func SysLog(s string) {
	// 系统日志仍然输出，但减少频率
	if LoggingEnabled {
		t := time.Now()
		_, _ = fmt.Fprintf(os.Stdout, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
	}
}

func SysError(s string) {
	// 系统错误必须输出，用于调试严重问题
	t := time.Now()
	_, _ = fmt.Fprintf(os.Stderr, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
}

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

func logHelper(ctx context.Context, level string, msg string) {
	if !LoggingEnabled {
		return
	}
	
	writer := gin.DefaultErrorWriter
	if level == loggerINFO {
		writer = gin.DefaultWriter
	}
	id := ctx.Value(RequestIdKey)
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

func FatalLog(v ...any) {
	// 致命错误必须输出
	t := time.Now()
	_, _ = fmt.Fprintf(os.Stderr, "[FATAL] %v | %v \n", t.Format("2006/01/02 - 15:04:05"), v)
	os.Exit(1)
}

func LogQuota(quota int) string {
	if DisplayInCurrencyEnabled {
		return fmt.Sprintf("＄%.6f 额度", float64(quota)/QuotaPerUnit)
	} else {
		return fmt.Sprintf("%d 点额度", quota)
	}
}

func FormatQuota(quota int) string {
	if DisplayInCurrencyEnabled {
		return fmt.Sprintf("＄%.6f", float64(quota)/QuotaPerUnit)
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
