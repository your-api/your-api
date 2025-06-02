package main

import (
	"embed"
	"fmt"
	"log"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/controller"
	"one-api/middleware"
	"one-api/model"
	"one-api/router"
	"one-api/service"
	"one-api/setting/operation_setting"
	"os"
	"strconv"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	_ "net/http/pprof"
)

//go:embed web/dist
var buildFS embed.FS

//go:embed web/dist/index.html
var indexPage []byte

func main() {
	// 设置应用程序默认时区为中国时区，解决时间慢8小时的问题
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		common.SysLog("警告：无法加载时区 Asia/Shanghai，使用系统默认时区: " + err.Error())
	} else {
		time.Local = loc
		common.SysLog("应用程序时区已设置为: " + time.Local.String())
	}

	err = godotenv.Load(".env")
	if err != nil {
		common.SysLog("Support for .env file is disabled: " + err.Error())
	}

	common.LoadEnv()

	common.SetupLogger()
	common.SysLog("New API " + common.Version + " started")
	if os.Getenv("GIN_MODE") != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}
	if common.DebugEnabled {
		common.SysLog("running in debug mode")
	}
	// Initialize SQL Database
	err = model.InitDB()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
	}

	model.CheckSetup()

	// Initialize SQL Database
	err = model.InitLogDB()
	if err != nil {
		common.FatalLog("failed to initialize database: " + err.Error())
	}
	defer func() {
		err := model.CloseDB()
		if err != nil {
			common.FatalLog("failed to close database: " + err.Error())
		}
	}()

	// Initialize Redis
	err = common.InitRedisClient()
	if err != nil {
		common.FatalLog("failed to initialize Redis: " + err.Error())
	}

	// Initialize model settings
	operation_setting.InitRatioSettings()
	// Initialize constants
	constant.InitEnv()
	// Initialize options
	model.InitOptionMap()

	service.InitTokenEncoders()

	if common.RedisEnabled {
		// for compatibility with old versions
		common.MemoryCacheEnabled = true
	}
	if common.MemoryCacheEnabled {
		common.SysLog("memory cache enabled")
		common.SysError(fmt.Sprintf("sync frequency: %d seconds", common.SyncFrequency))

		// Add panic recovery and retry for InitChannelCache
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysError(fmt.Sprintf("InitChannelCache panic: %v, attempting recovery", r))
					// 尝试清理和恢复
					time.Sleep(1 * time.Second)
					
					// 尝试修复数据库中的能力数据
					_, fixErr := model.FixAbility()
					if fixErr != nil {
						common.SysError(fmt.Sprintf("FixAbility failed during recovery: %s", fixErr.Error()))
					} else {
						common.SysLog("FixAbility completed successfully during recovery")
					}
				}
			}()
			
			// 首先尝试修复能力数据
			count, err := model.FixAbility()
			if err != nil {
				common.SysError(fmt.Sprintf("FixAbility failed: %s", err.Error()))
				// 即使修复失败，也尝试初始化缓存
				model.InitChannelCache()
			} else {
				common.SysLog(fmt.Sprintf("FixAbility completed, processed %d items", count))
			}
		}()

		go model.SyncOptions(common.SyncFrequency)
		go model.SyncChannelCache(common.SyncFrequency)
	}

	// 数据看板
	go model.UpdateQuotaData()

	if os.Getenv("CHANNEL_UPDATE_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_UPDATE_FREQUENCY"))
		if err != nil {
			common.FatalLog("failed to parse CHANNEL_UPDATE_FREQUENCY: " + err.Error())
		}
		go controller.AutomaticallyUpdateChannels(frequency)
	}
	if os.Getenv("CHANNEL_TEST_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY"))
		if err != nil {
			common.FatalLog("failed to parse CHANNEL_TEST_FREQUENCY: " + err.Error())
		}
		go controller.AutomaticallyTestChannels(frequency)
	}
	if common.IsMasterNode && constant.UpdateTask {
		gopool.Go(func() {
			controller.UpdateMidjourneyTaskBulk()
		})
		gopool.Go(func() {
			controller.UpdateTaskBulk()
		})
	}
	if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
		common.BatchUpdateEnabled = true
		common.SysLog("batch update enabled with interval " + strconv.Itoa(common.BatchUpdateInterval) + "s")
		model.InitBatchUpdater()
	}

	if os.Getenv("ENABLE_PPROF") == "true" {
		gopool.Go(func() {
			log.Println(http.ListenAndServe("0.0.0.0:8005", nil))
		})
		go common.Monitor()
		common.SysLog("pprof enabled")
	}

	// Initialize HTTP server
	server := gin.New()
	server.Use(gin.CustomRecovery(func(c *gin.Context, err any) {
		common.SysError(fmt.Sprintf("panic detected: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"message": fmt.Sprintf("Panic detected, error: %v. Please submit a issue here: https://github.com/Calcium-Ion/new-api", err),
				"type":    "new_api_panic",
			},
		})
	}))
	// This will cause SSE not to work!!!
	//server.Use(gzip.Gzip(gzip.DefaultCompression))
	server.Use(middleware.RequestId())
	middleware.SetUpLogger(server)
	// Initialize session store
	store := cookie.NewStore([]byte(common.SessionSecret))
	store.Options(sessions.Options{
		Path:     "/",
		MaxAge:   2592000, // 30 days
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
	})
	server.Use(sessions.Sessions("session", store))

	router.SetRouter(server, buildFS, indexPage)
	var port = os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(*common.Port)
	}
	err = server.Run(":" + port)
	if err != nil {
		common.FatalLog("failed to start HTTP server: " + err.Error())
	}
}
