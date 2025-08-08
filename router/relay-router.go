package router

import (
	"one-api/controller"
	"one-api/middleware"
	"one-api/relay"

	"github.com/gin-gonic/gin"
)

func SetRelayRouter(router *gin.Engine) {
	// router.Use(middleware.CORS()) // 已在全局应用，无需重复
	router.Use(middleware.DecompressRequestMiddleware())
	router.Use(middleware.GlobalPanicRecover())
	// https://platform.openai.com/docs/api-reference/introduction
	modelsRouter := router.Group("/v1/models")
	modelsRouter.Use(middleware.TokenAuth())
	{
		modelsRouter.GET("", controller.ListModels)
		modelsRouter.GET("/:model", controller.RetrieveModel)
	}
	playgroundRouter := router.Group("/pg")
	playgroundRouter.Use(middleware.UserAuth())
	{
		playgroundRouter.POST("/chat/completions", controller.Playground)
	}
	
	// Token counting endpoint without authentication
	publicV1Router := router.Group("/v1")
	{
		publicV1Router.POST("/messages/count_tokens", controller.CountMessageTokens)
	}
	
	relayV1Router := router.Group("/v1")
	relayV1Router.Use(middleware.TokenAuth())
	relayV1Router.Use(middleware.ModelRequestRateLimit())
	relayV1Router.Use(middleware.RelayPanicRecover())
	{
		// WebSocket 路由
		wsRouter := relayV1Router.Group("")
		wsRouter.Use(middleware.Distribute())
		wsRouter.GET("/realtime", controller.WssRelay)
	}
	{
		//http router
		httpRouter := relayV1Router.Group("")
		httpRouter.Use(middleware.Distribute())
		httpRouter.POST("/messages", controller.RelayClaude)
		httpRouter.POST("/completions", controller.Relay)
		httpRouter.POST("/chat/completions", controller.Relay)
		httpRouter.POST("/edits", controller.Relay)
		httpRouter.POST("/images/generations", controller.Relay)
		httpRouter.POST("/images/edits", controller.Relay)
		httpRouter.POST("/images/variations", controller.RelayNotImplemented)
		httpRouter.POST("/embeddings", controller.Relay)
		httpRouter.POST("/engines/:model/embeddings", controller.Relay)
		httpRouter.POST("/audio/transcriptions", controller.Relay)
		httpRouter.POST("/audio/translations", controller.Relay)
		httpRouter.POST("/audio/speech", controller.Relay)
		httpRouter.POST("/responses", controller.Relay)
		httpRouter.GET("/files", controller.RelayNotImplemented)
		httpRouter.POST("/files", controller.RelayNotImplemented)
		httpRouter.DELETE("/files/:id", controller.RelayNotImplemented)
		httpRouter.GET("/files/:id", controller.RelayNotImplemented)
		httpRouter.GET("/files/:id/content", controller.RelayNotImplemented)
		httpRouter.POST("/fine-tunes", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes/:id", controller.RelayNotImplemented)
		httpRouter.POST("/fine-tunes/:id/cancel", controller.RelayNotImplemented)
		httpRouter.GET("/fine-tunes/:id/events", controller.RelayNotImplemented)
		httpRouter.DELETE("/models/:model", controller.RelayNotImplemented)
		httpRouter.POST("/moderations", controller.Relay)
		httpRouter.POST("/rerank", controller.Relay)
	}

	// K2 路由组，用于处理 /k2/v1/messages 请求
	k2Router := router.Group("/k2")
	k2Router.Use(middleware.TokenAuth())
	k2Router.Use(middleware.ModelRequestRateLimit())
	k2Router.Use(middleware.RelayPanicRecover())
	k2Router.Use(middleware.K2ModelTransform()) // 标记这是 K2 请求
	// 注意：K2 路由不使用 Distribute 中间件，由处理器自己处理渠道选择
	{
		k2Router.POST("/v1/messages", controller.RelayClaudeK2)
	}

	// K2 路由组，用于处理 /k2/v1/messages 请求
	c2Router := router.Group("/c2")
	c2Router.Use(middleware.TokenAuth())
	c2Router.Use(middleware.ModelRequestRateLimit())
	c2Router.Use(middleware.RelayPanicRecover())
	c2Router.Use(middleware.K2ModelTransform()) // 标记这是 K2 请求
	// 注意：K2 路由不使用 Distribute 中间件，由处理器自己处理渠道选择
	{
		c2Router.POST("/v1/messages", controller.RelayClaudeC2)
	}

	// opus4.1 路由组，用于处理 /k2/v1/messages 请求
	c4Router := router.Group("/opus")
	c4Router.Use(middleware.TokenAuth())
	c4Router.Use(middleware.ModelRequestRateLimit())
	c4Router.Use(middleware.RelayPanicRecover())
	c4Router.Use(middleware.K2ModelTransform()) // 标记这是 K2 请求
	// 注意：K2 路由不使用 Distribute 中间件，由处理器自己处理渠道选择
	{
		c4Router.POST("/v1/messages", controller.RelayClaudeOp)
	}

	// K2 路由组，用于处理 /k2/v1/messages 请求
	qwenRouter := router.Group("/qwen")
	qwenRouter.Use(middleware.TokenAuth())
	qwenRouter.Use(middleware.ModelRequestRateLimit())
	qwenRouter.Use(middleware.RelayPanicRecover())
	qwenRouter.Use(middleware.K2ModelTransform()) // 标记这是 K2 请求
	// 注意：K2 路由不使用 Distribute 中间件，由处理器自己处理渠道选择
	{
		qwenRouter.POST("/v1/messages", controller.RelayClaudeQwen)
	}

	// K2 路由组，用于处理 /k2/v1/messages 请求
	glmRouter := router.Group("/glm")
	glmRouter.Use(middleware.TokenAuth())
	glmRouter.Use(middleware.ModelRequestRateLimit())
	glmRouter.Use(middleware.RelayPanicRecover())
	glmRouter.Use(middleware.K2ModelTransform()) // 标记这是 K2 请求
	// 注意：K2 路由不使用 Distribute 中间件，由处理器自己处理渠道选择
	{
		glmRouter.POST("/v1/messages", controller.RelayClaudeGlm)
	}

	relayMjRouter := router.Group("/mj")
	relayMjRouter.Use(middleware.RelayPanicRecover())
	registerMjRouterGroup(relayMjRouter)

	relayMjModeRouter := router.Group("/:mode/mj")
	relayMjModeRouter.Use(middleware.RelayPanicRecover())
	registerMjRouterGroup(relayMjModeRouter)
	//relayMjRouter.Use()

	relaySunoRouter := router.Group("/suno")
	relaySunoRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	relaySunoRouter.Use(middleware.RelayPanicRecover())
	{
		relaySunoRouter.POST("/submit/:action", controller.RelayTask)
		relaySunoRouter.POST("/fetch", controller.RelayTask)
		relaySunoRouter.GET("/fetch/:id", controller.RelayTask)
	}

}

func registerMjRouterGroup(relayMjRouter *gin.RouterGroup) {
	relayMjRouter.GET("/image/:id", relay.RelayMidjourneyImage)
	relayMjRouter.Use(middleware.TokenAuth(), middleware.Distribute())
	{
		relayMjRouter.POST("/submit/action", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/shorten", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/modal", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/imagine", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/change", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/simple-change", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/describe", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/blend", controller.RelayMidjourney)
		relayMjRouter.POST("/notify", controller.RelayMidjourney)
		relayMjRouter.GET("/task/:id/fetch", controller.RelayMidjourney)
		relayMjRouter.GET("/task/:id/image-seed", controller.RelayMidjourney)
		relayMjRouter.POST("/task/list-by-condition", controller.RelayMidjourney)
		relayMjRouter.POST("/insight-face/swap", controller.RelayMidjourney)
		relayMjRouter.POST("/submit/upload-discord-images", controller.RelayMidjourney)
	}
}
