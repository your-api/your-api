package constant

import (
	"one-api/common"
)

var StreamingTimeout int
var DifyDebug bool
var MaxFileDownloadMB int
var ForceStreamOption bool
var GetMediaToken bool
var GetMediaTokenNotStream bool
var UpdateTask bool
var AzureDefaultAPIVersion string
var GeminiVisionMaxImageNum int
var NotifyLimitCount int
var NotificationLimitDurationMinute int
var GenerateDefaultToken bool
var ErrorLogEnabled bool
var DataExportInterval string
var DataExportDefaultTime string
var DrawingEnabled bool
var IndexEnabled bool
var OcrEnabled bool
var ImageReadProxyEnabled bool
var ProxyType string
var UploadPath string
var TextAuditEnabled bool
var TopUpRatio float64

//var GeminiModelMap = map[string]string{
//	"gemini-1.0-pro": "v1",
//}

func InitEnv() {
	StreamingTimeout = common.GetEnvOrDefault("STREAMING_TIMEOUT", 18000)
	DifyDebug = common.GetEnvOrDefaultBool("DIFY_DEBUG", true)
	MaxFileDownloadMB = common.GetEnvOrDefault("MAX_FILE_DOWNLOAD_MB", 20)
	// ForceStreamOption 覆盖请求参数，强制返回usage信息
	ForceStreamOption = common.GetEnvOrDefaultBool("FORCE_STREAM_OPTION", true)
	GetMediaToken = common.GetEnvOrDefaultBool("GET_MEDIA_TOKEN", true)
	GetMediaTokenNotStream = common.GetEnvOrDefaultBool("GET_MEDIA_TOKEN_NOT_STREAM", true)
	UpdateTask = common.GetEnvOrDefaultBool("UPDATE_TASK", true)
	AzureDefaultAPIVersion = common.GetEnvOrDefaultString("AZURE_DEFAULT_API_VERSION", "2025-04-01-preview")
	GeminiVisionMaxImageNum = common.GetEnvOrDefault("GEMINI_VISION_MAX_IMAGE_NUM", 16)
	NotifyLimitCount = common.GetEnvOrDefault("NOTIFY_LIMIT_COUNT", 2)
	NotificationLimitDurationMinute = common.GetEnvOrDefault("NOTIFICATION_LIMIT_DURATION_MINUTE", 10)
	// GenerateDefaultToken 是否生成初始令牌，默认关闭。
	GenerateDefaultToken = common.GetEnvOrDefaultBool("GENERATE_DEFAULT_TOKEN", false)
	// 是否启用错误日志
	ErrorLogEnabled = common.GetEnvOrDefaultBool("ERROR_LOG_ENABLED", true)
	DataExportInterval = common.GetEnvOrDefaultString("DATA_EXPORT_INTERVAL", "5m")
	DataExportDefaultTime = common.GetEnvOrDefaultString("DATA_EXPORT_DEFAULT_TIME", "")
	DrawingEnabled = common.GetEnvOrDefaultBool("DRAWING_ENABLED", true)
	IndexEnabled = common.GetEnvOrDefaultBool("INDEX_ENABLED", true)
	OcrEnabled = common.GetEnvOrDefaultBool("OCR_ENABLED", true)
	ImageReadProxyEnabled = common.GetEnvOrDefaultBool("IMAGE_READ_PROXY_ENABLED", true)
	ProxyType = common.GetEnvOrDefaultString("PROXY_TYPE", "http")
	UploadPath = common.GetEnvOrDefaultString("UPLOAD_PATH", "")
	TextAuditEnabled = common.GetEnvOrDefaultBool("TEXT_AUDIT_ENABLED", false)
	TopUpRatio = common.GetEnvOrDefaultFloat64("TOP_UP_RATIO", 1.0)

	// 添加调试信息，确保配置正确
	if common.DebugEnabled {
		common.SysDebug("媒体token配置已加载")
	}

	//modelVersionMapStr := strings.TrimSpace(os.Getenv("GEMINI_MODEL_MAP"))
	//if modelVersionMapStr == "" {
	//	return
	//}
	//for _, pair := range strings.Split(modelVersionMapStr, ",") {
	//	parts := strings.Split(pair, ":")
	//	if len(parts) == 2 {
	//		GeminiModelMap[parts[0]] = parts[1]
	//	} else {
	//		common.SysError(fmt.Sprintf("invalid model version map: %s", pair))
	//	}
	//}
}
