package model

import (
	"context"
	"fmt"
	"one-api/common"
	"one-api/logger"
	"one-api/types"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

// getClientIP 获取客户端真实IP地址
func getClientIP(c *gin.Context) string {
	// 优先获取 X-Forwarded-For 头
	xff := c.GetHeader("X-Forwarded-For")
	if xff != "" {
		// X-Forwarded-For 可能包含多个IP，取第一个
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// 获取 X-Real-IP 头
	realIP := c.GetHeader("X-Real-IP")
	if realIP != "" {
		return strings.TrimSpace(realIP)
	}

	// 最后使用 ClientIP 方法
	return c.ClientIP()
}

// getLogTableByUser 根据 userId % shardCount 决定写入哪张分表
func getLogTableByUser(userId int) string {
	return fmt.Sprintf("logs_%02d", userId%shardCount)
}

// getAllLogsTable 若存在 logs_all 视图则用它，否则回退到原始 logs 表
func getAllLogsTable(db *gorm.DB) string {
	//if db.Migrator().HasTable("logs_all") {
	//    return "logs_all"
	//}
	//return "logs"
	return "logs_all"
}

type Log struct {
	Id               int    `json:"id" gorm:"index:idx_created_at_id,priority:1"`
	UserId           int    `json:"user_id" gorm:"index"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_created_at_id,priority:2;index:idx_created_at_type"`
	Type             int    `json:"type" gorm:"index:idx_created_at_type"`
	Content          string `json:"content"`
	Username         string `json:"username" gorm:"index;index:index_username_model_name,priority:2;default:''"`
	TokenName        string `json:"token_name" gorm:"index;default:''"`
	ModelName        string `json:"model_name" gorm:"index;index:index_username_model_name,priority:1;default:''"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream" gorm:"default:false"`
	ChannelId        int    `json:"channel" gorm:"index"`
	ChannelName      string `json:"channel_name" gorm:"->"`
	TokenId          int    `json:"token_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"index"`
	Ip               string `json:"ip" gorm:"index;default:''"`
	Other            string `json:"other"`
	RequestIP        string `json:"request_ip" gorm:"index;default:''"`
}

const (
	LogTypeUnknown = iota
	LogTypeTopup
	LogTypeConsume
	LogTypeManage
	LogTypeSystem
	LogTypeError
)

func formatUserLogs(logs []*Log) {
	for i := range logs {
		logs[i].ChannelName = ""
		logs[i].ChannelId = 0 // 隐藏渠道ID，防止泄露渠道信息
		var otherMap map[string]interface{}
		otherMap, _ = common.StrToMap(logs[i].Other)
		if otherMap != nil {
			// delete admin
			delete(otherMap, "admin_info")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = logs[i].Id % 1024
	}
}

func GetLogByKey(key string) (logs []*Log, err error) {
	if os.Getenv("LOG_SQL_DSN") != "" {
		var tk Token
		if err = DB.Model(&Token{}).Where(logKeyCol+"=?", strings.TrimPrefix(key, "sk-")).First(&tk).Error; err != nil {
			return nil, err
		}
		err = LOG_DB.Model(&Log{}).Where("token_id=?", tk.Id).Find(&logs).Error
	} else {
		err = LOG_DB.Joins("left join tokens on tokens.id = logs.token_id").Where("tokens.key = ?", strings.TrimPrefix(key, "sk-")).Find(&logs).Error
	}
	formatUserLogs(logs)
	return logs, err
}

func RecordLog(userId int, logType int, content string) {
	if logType == LogTypeConsume && !common.LogConsumeEnabled {
		return
	}
	username, _ := GetUsernameById(userId, false)
	log := &Log{
		UserId:    userId,
		Username:  username,
		CreatedAt: common.GetTimestamp(),
		Type:      logType,
		Content:   content,
		RequestIP: "", // 对于没有请求上下文的日志，IP为空
	}
	table := getLogTableByUser(userId)
	err := LOG_DB.Table(table).Create(log).Error
	if err != nil {
		common.SysLog("failed to record log: " + err.Error())
	}
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s", userId, channelId, modelName, tokenName, content))
	username := c.GetString("username")
	otherStr := common.MapToJsonStr(other)
	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}

	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeError,
		Content:          content,
		PromptTokens:     0,
		CompletionTokens: 0,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            0,
		ChannelId:        channelId,
		TokenId:          tokenId,
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		RequestIP: func() string {
			if needRecordIp {
				return getClientIP(c)
			}
			return ""
		}(),
		Other: otherStr,
	}
	table := getLogTableByUser(userId)
	err := LOG_DB.Table(table).Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
}

func RecordErrorLogDouble(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string,
	contentUpstream string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {

	// 从context中获取token信息
	promptTokens := 0
	if value, exists := c.Get("prompt_tokens"); exists {
		if tokens, ok := value.(int); ok {
			promptTokens = tokens
		}
	}

	completionTokens := 0
	if value, exists := c.Get("completion_tokens"); exists {
		if tokens, ok := value.(int); ok {
			completionTokens = tokens
		}
	}

	// 判断contentUpstream是否不为空
	if contentUpstream != "" {
		logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s",
			userId, channelId, modelName, tokenName, content))

		username := c.GetString("username")
		userIdRecord := userId

		// 判断contentUpstream是否包含敏感关键词
		contentUpstreamLower := strings.ToLower(contentUpstream)
		if strings.Contains(contentUpstreamLower, "quota") ||
			strings.Contains(contentUpstream, "配额") ||
			strings.Contains(contentUpstream, "无可用") ||
			strings.Contains(contentUpstreamLower, "poe") ||
			strings.Contains(contentUpstream, "额度") ||
			strings.Contains(contentUpstreamLower, "credit") ||
			strings.Contains(contentUpstreamLower, "points") ||
			strings.Contains(contentUpstreamLower, "enough") ||
			strings.Contains(contentUpstreamLower, "insufficient") ||
			strings.Contains(contentUpstreamLower, "balance") ||
			strings.Contains(contentUpstreamLower, "limit") ||
			strings.Contains(contentUpstreamLower, "exceeded") ||
			strings.Contains(contentUpstreamLower, "exhausted") ||
			strings.Contains(contentUpstream, "非流") ||
			strings.Contains(contentUpstreamLower, "tenclock") ||
			strings.Contains(contentUpstream, "服务超时") {
			username = c.GetString("username") + "_root显示"
			userIdRecord = 1
		}

		contentUpstream += "，如有任何问题，请联系我们"

		// 判断是否需要记录 IP
		needRecordIp := false
		if settingMap, err := GetUserSetting(userIdRecord, false); err == nil {
			if settingMap.RecordIpLog {
				needRecordIp = true
			}
		}

		userIdRecord = 1
		username = c.GetString("username") + "_root显示"

		log := &Log{
			UserId:           userIdRecord,
			Username:         username,
			CreatedAt:        common.GetTimestamp(),
			Type:             LogTypeError,
			Content:          contentUpstream + formatRetryInfo(c),
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			TokenName:        tokenName,
			ModelName:        modelName,
			Quota:            0,
			ChannelId:        channelId,
			TokenId:          tokenId,
			UseTime:          useTimeSeconds,
			IsStream:         isStream,
			Group:            group,
			RequestIP: func() string {
				if needRecordIp {
					return getClientIP(c)
				}
				return ""
			}(),
			Other: common.MapToJsonStr(other),
		}
		table := getLogTableByUser(userIdRecord)
		if err := LOG_DB.Table(table).Create(log).Error; err != nil {
			logger.LogError(c, "failed to record log: "+err.Error())
		}
	}

	// 如果是最后一次重试，记录用户的错误日志
	if isLast, exists := c.Get("is_last"); exists && isLast == true {
		logger.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s",
			userId, channelId, modelName, tokenName, content))
		username := c.GetString("username")

		// 判断contentUpstream是否包含敏感关键词
		contentUpstreamLower := strings.ToLower(contentUpstream)
		if strings.Contains(contentUpstreamLower, "quota") ||
			strings.Contains(contentUpstream, "配额") ||
			strings.Contains(contentUpstream, "无可用") ||
			strings.Contains(contentUpstreamLower, "poe") ||
			strings.Contains(contentUpstream, "额度") ||
			strings.Contains(contentUpstreamLower, "credit") ||
			strings.Contains(contentUpstreamLower, "points") ||
			strings.Contains(contentUpstreamLower, "enough") ||
			strings.Contains(contentUpstreamLower, "insufficient") ||
			strings.Contains(contentUpstreamLower, "balance") ||
			strings.Contains(contentUpstreamLower, "limit") ||
			strings.Contains(contentUpstreamLower, "exceeded") ||
			strings.Contains(contentUpstreamLower, "exhausted") ||
			strings.Contains(contentUpstream, "非流") ||
			strings.Contains(contentUpstreamLower, "tenclock") ||
			strings.Contains(contentUpstream, "服务超时") {
			contentUpstream = "当前服务负载较大，请稍后重试"
		}

		// 判断是否需要记录 IP
		needRecordIp := false
		if settingMap, err := GetUserSetting(userId, false); err == nil {
			if settingMap.RecordIpLog {
				needRecordIp = true
			}
		}

		log := &Log{
			UserId:           userId,
			Username:         username,
			CreatedAt:        common.GetTimestamp(),
			Type:             LogTypeError,
			Content:          contentUpstream,
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			TokenName:        tokenName,
			ModelName:        modelName,
			Quota:            0,
			ChannelId:        channelId,
			TokenId:          tokenId,
			UseTime:          useTimeSeconds,
			IsStream:         isStream,
			Group:            group,
			RequestIP: func() string {
				if needRecordIp {
					return getClientIP(c)
				}
				return ""
			}(),
			Other: common.MapToJsonStr(other),
		}
		table := getLogTableByUser(userId)
		if err := LOG_DB.Table(table).Create(log).Error; err != nil {
			logger.LogError(c, "failed to record log: "+err.Error())
		}
	}
}

type RecordConsumeLogParams struct {
	ChannelId        int                    `json:"channel_id"`
	PromptTokens     int                    `json:"prompt_tokens"`
	CompletionTokens int                    `json:"completion_tokens"`
	Quota            int                    `json:"quota"`
	Content          string                 `json:"content"`
	TokenId          int                    `json:"token_id"`
	UseTime          int                    `json:"use_time"`
	UseTimeSeconds   int                    `json:"use_time_seconds"`
	IsStream         bool                   `json:"is_stream"`
	Other            map[string]interface{} `json:"other"`
}

func RecordConsumeLog(c *gin.Context, userId int, channelId int, promptTokens int, completionTokens int, modelName string, tokenName string, quota int, content string, tokenId int, userQuota int, useTimeSeconds int, isStream bool, group string, other map[string]interface{}) {
	logger.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, 用户调用前余额=%d, channelId=%d, promptTokens=%d, completionTokens=%d, modelName=%s, tokenName=%s, quota=%d, content=%s", userId, userQuota, channelId, promptTokens, completionTokens, modelName, tokenName, quota, content))
	if !common.LogConsumeEnabled {
		return
	}

	// 检查重复日志记录：使用请求ID来防止同一请求的重复记录
	requestId := c.GetString(common.RequestIdKey)
	if requestId != "" {
		table := getLogTableByUser(userId)
		var existingCount int64
		err := LOG_DB.Table(table).
			Where("user_id = ? AND other LIKE ?", userId, "%\"request_id\":\""+requestId+"\"%").
			Count(&existingCount).Error

		if err == nil && existingCount > 0 {
			logger.LogWarn(c, fmt.Sprintf("检测到重复的消费日志记录，请求ID: %s, 用户ID: %d，跳过记录", requestId, userId))
			return
		}
	}
	username := c.GetString("username")

	// 在other中添加请求ID用于后续重复检查
	if other == nil {
		other = make(map[string]interface{})
	}
	if requestId != "" {
		other["request_id"] = requestId
	}

	// 判断是否需要记录 IP
	needRecordIp := false
	if settingMap, err := GetUserSetting(userId, false); err == nil {
		if settingMap.RecordIpLog {
			needRecordIp = true
		}
	}

	otherStr := common.MapToJsonStr(other)
	log := &Log{
		UserId:           userId,
		Username:         username,
		CreatedAt:        common.GetTimestamp(),
		Type:             LogTypeConsume,
		Content:          content,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TokenName:        tokenName,
		ModelName:        modelName,
		Quota:            quota,
		ChannelId:        channelId,
		TokenId:          tokenId,
		UseTime:          useTimeSeconds,
		IsStream:         isStream,
		Group:            group,
		RequestIP: func() string {
			if needRecordIp {
				return getClientIP(c)
			}
			return ""
		}(),
		Other: otherStr,
	}
	table := getLogTableByUser(userId)
	err := LOG_DB.Table(table).Create(log).Error
	if err != nil {
		logger.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled {
		gopool.Go(func() {
			LogQuotaData(userId, username, modelName, quota, common.GetTimestamp(), promptTokens+completionTokens)
		})
	}
}

func GetAllLogs(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, startIdx int, num int, channel int, group string) (logs []*Log, total int64, err error) {
	// 直接使用原生SQL查询logs_all视图
	tableName := "logs_all"

	// 构建WHERE条件
	whereClauses := []string{}
	args := []interface{}{}

	if logType != LogTypeUnknown {
		whereClauses = append(whereClauses, "type = ?")
		args = append(args, logType)
	}
	if modelName != "" {
		whereClauses = append(whereClauses, "model_name LIKE ?")
		args = append(args, modelName)
	}
	if username != "" {
		whereClauses = append(whereClauses, "username = ?")
		args = append(args, username)
	}
	if tokenName != "" {
		whereClauses = append(whereClauses, "token_name = ?")
		args = append(args, tokenName)
	}
	if startTimestamp != 0 {
		whereClauses = append(whereClauses, "created_at >= ?")
		args = append(args, startTimestamp)
	}
	if endTimestamp != 0 {
		whereClauses = append(whereClauses, "created_at <= ?")
		args = append(args, endTimestamp)
	}
	if channel != 0 {
		whereClauses = append(whereClauses, "channel_id = ?")
		args = append(args, channel)
	}
	if group != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("%s = ?", logGroupCol))
		args = append(args, group)
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	// 查询总数
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s%s", tableName, whereSQL)
	err = LOG_DB.Raw(countSQL, args...).Scan(&total).Error
	if err != nil {
		return nil, 0, err
	}

	// 查询数据
	dataSQL := fmt.Sprintf("SELECT * FROM %s%s ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", tableName, whereSQL)
	dataArgs := append(args, num, startIdx)
	err = LOG_DB.Raw(dataSQL, dataArgs...).Scan(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	channelIds := types.NewSet[int]()
	for _, log := range logs {
		if log.ChannelId != 0 {
			channelIds.Add(log.ChannelId)
		}
	}

	if channelIds.Len() > 0 {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err = DB.Table("channels").Select("id, name").Where("id IN ?", channelIds.Items()).Find(&channels).Error; err != nil {
			return logs, total, err
		}
		channelMap := make(map[int]string, len(channels))
		for _, channel := range channels {
			channelMap[channel.Id] = channel.Name
		}
		for i := range logs {
			logs[i].ChannelName = channelMap[logs[i].ChannelId]
		}
	}

	return logs, total, err
}

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName string, tokenName string, startIdx int, num int, group string) (logs []*Log, total int64, err error) {
	var tx *gorm.DB
	// 普通用户直接查询对应的分片表，提高查询效率
	tableName := getLogTableByUser(userId)
	tx = LOG_DB.Table(tableName).Where("user_id = ?", userId)
	if logType != LogTypeUnknown {
		tx = tx.Where("type = ?", logType)
	}

	if modelName != "" {
		tx = tx.Where("model_name like ?", modelName)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
	}
	err = tx.Model(&Log{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = tx.Order("created_at desc, id desc").Limit(num).Offset(startIdx).Find(&logs).Error
	if err != nil {
		return nil, 0, err
	}

	formatUserLogs(logs)
	return logs, total, err
}

func SearchAllLogs(keyword string) (logs []*Log, err error) {
	err = LOG_DB.Table("logs_all").Where("type = ? or content LIKE ?", keyword, keyword+"%").Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	return logs, err
}

func SearchUserLogs(userId int, keyword string) (logs []*Log, err error) {
	// 普通用户直接查询对应的分片表，提高查询效率
	tableName := getLogTableByUser(userId)
	err = LOG_DB.Table(tableName).Where("user_id = ? and type = ?", userId, keyword).Order("id desc").Limit(common.MaxRecentItems).Find(&logs).Error
	formatUserLogs(logs)
	return logs, err
}

type Stat struct {
	Quota int `json:"quota"`
	Rpm   int `json:"rpm"`
	Tpm   int `json:"tpm"`
}

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string, channel int, group string) (stat Stat) {
	tx := LOG_DB.Table("logs_all").Select("sum(quota) quota")

	// 为rpm和tpm创建单独的查询
	rpmTpmQuery := LOG_DB.Table("logs_all").Select("count(*) rpm, sum(prompt_tokens) + sum(completion_tokens) tpm")

	if username != "" {
		tx = tx.Where("username = ?", username)
		rpmTpmQuery = rpmTpmQuery.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
		rpmTpmQuery = rpmTpmQuery.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
		rpmTpmQuery = rpmTpmQuery.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
		rpmTpmQuery = rpmTpmQuery.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(logGroupCol+" = ?", group)
		rpmTpmQuery = rpmTpmQuery.Where(logGroupCol+" = ?", group)
	}
	if logType != LogTypeUnknown {
		tx = tx.Where("type = ?", logType)
	} else {
		tx = tx.Where("type = ?", LogTypeConsume)
	}

	// 只计算最近60秒的rpm和tpm
	rpmTpmQuery = rpmTpmQuery.Where("created_at >= ?", time.Now().Add(-60*time.Second).Unix())

	// 先查询quota
	tx.Scan(&stat)

	// 再查询rpm和tpm
	rpmTpmQuery.Scan(&stat)

	return stat
}

func SumUsedToken(logType int, startTimestamp int64, endTimestamp int64, modelName string, username string, tokenName string) (token int) {
	tx := LOG_DB.Table("logs_all").Select("ifnull(sum(prompt_tokens),0) + ifnull(sum(completion_tokens),0)")
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if logType != LogTypeUnknown {
		tx = tx.Where("type = ?", logType)
	} else {
		tx = tx.Where("type = ?", LogTypeConsume)
	}
	tx.Scan(&token)
	return token
}

// formatRetryInfo 格式化重试信息
func formatRetryInfo(c *gin.Context) string {
	retryTimes := c.GetString("retry_times")
	if retryTimes == "" {
		return ""
	}
	return fmt.Sprintf("， 重试 %s 次", retryTimes)
}

func DeleteOldLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	var total int64 = 0

	// 遍历所有分片表删除旧日志
	for i := 0; i < shardCount; i++ {
		if ctx.Err() != nil {
			return total, ctx.Err()
		}

		tableName := fmt.Sprintf("logs_%02d", i)

		// 每个分片表单独删除
		for {
			if ctx.Err() != nil {
				return total, ctx.Err()
			}

			result := LOG_DB.Table(tableName).Where("created_at < ?", targetTimestamp).
				Limit(limit).
				Delete(&Log{})

			if result.Error != nil {
				// 如果表不存在，继续下一个
				if strings.Contains(result.Error.Error(), "doesn't exist") {
					break
				}
				return total, result.Error
			}

			total += result.RowsAffected

			if result.RowsAffected < int64(limit) {
				break
			}

			// 添加短暂延迟，避免过度占用数据库资源
			time.Sleep(50 * time.Millisecond)
		}
	}

	return total, nil
}
