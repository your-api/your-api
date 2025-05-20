package model

import (
	"context"
	"fmt"
	"one-api/common"
	"os"
	"strings"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// getLogTableByUser 根据 userId % 100 决定写入哪张分表
func getLogTableByUser(userId int) string {
	return fmt.Sprintf("logs_%02d", userId%shardCount)
}

// getAllLogsTable 若存在 logs_all 视图则用它，否则回退到原始 logs 表
func getAllLogsTable(db *gorm.DB) string {
	//if db.Migrator().HasTable("logs_all") {
	//	return "logs_all"
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
	Other            string `json:"other"`
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
		otherMap := common.StrToMap(logs[i].Other)
		if otherMap != nil {
			delete(otherMap, "admin_info")
		}
		logs[i].Other = common.MapToJsonStr(otherMap)
		logs[i].Id = logs[i].Id % 1024
	}
}

func GetLogByKey(key string) (logs []*Log, err error) {
	// 先取到 token，拿到 userId，再选分表
	var tk Token
	if err = DB.Model(&Token{}).
		Where(keyCol+" = ?", strings.TrimPrefix(key, "sk-")).
		First(&tk).Error; err != nil {
		return nil, err
	}
	table := getLogTableByUser(tk.UserId)
	if os.Getenv("LOG_SQL_DSN") != "" {
		err = LOG_DB.Table(table).
			Where("token_id = ?", tk.Id).
			Find(&logs).Error
	} else {
		// 如果你还想 join tokens 表，可先指定 Table
		err = LOG_DB.Table(table).
			Joins("left join tokens on tokens.id = "+table+".token_id").
			Where("tokens.key = ?", strings.TrimPrefix(key, "sk-")).
			Find(&logs).Error
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
	}
	table := getLogTableByUser(userId)
	if err := LOG_DB.Table(table).Create(log).Error; err != nil {
		common.SysError("failed to record log: " + err.Error())
	}
}

func RecordErrorLog(c *gin.Context, userId int, channelId int, modelName string, tokenName string, content string, tokenId int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {
	common.LogInfo(c, fmt.Sprintf("record error log: userId=%d, channelId=%d, modelName=%s, tokenName=%s, content=%s",
		userId, channelId, modelName, tokenName, content))
	username := c.GetString("username")
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
		Other:            common.MapToJsonStr(other),
	}
	table := getLogTableByUser(userId)
	if err := LOG_DB.Table(table).Create(log).Error; err != nil {
		common.LogError(c, "failed to record log: "+err.Error())
	}
}

func RecordConsumeLog(c *gin.Context, userId int, channelId int, promptTokens int, completionTokens int,
	modelName string, tokenName string, quota int, content string, tokenId int, userQuota int, useTimeSeconds int,
	isStream bool, group string, other map[string]interface{}) {

	common.LogInfo(c, fmt.Sprintf("record consume log: userId=%d, 用户调用前余额=%d, channelId=%d, promptTokens=%d, completionTokens=%d, modelName=%s, tokenName=%s, quota=%d, content=%s",
		userId, userQuota, channelId, promptTokens, completionTokens, modelName, tokenName, quota, content))
	if !common.LogConsumeEnabled {
		return
	}
	username := c.GetString("username")
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
		Other:            common.MapToJsonStr(other),
	}
	table := getLogTableByUser(userId)
	if err := LOG_DB.Table(table).Create(log).Error; err != nil {
		common.LogError(c, "failed to record log: "+err.Error())
	}
	if common.DataExportEnabled {
		gopool.Go(func() {
			LogQuotaData(userId, username, modelName, quota, common.GetTimestamp(), promptTokens+completionTokens)
		})
	}
}

// GetAllLogs ———— 一次性跨分表查询
func GetAllLogs(
	logType int,
	startTimestamp, endTimestamp int64,
	modelName, username, tokenName string,
	startIdx, num, channel int,
	group string,
) (logs []*Log, total int64, err error) {
	table := getAllLogsTable(LOG_DB)

	// 1) 构造基础 tx
	tx := LOG_DB.Table(table)
	if logType != LogTypeUnknown {
		tx = tx.Where("type = ?", logType)
	}
	if modelName != "" {
		tx = tx.Where("model_name LIKE ?", modelName)
	}
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
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	if group != "" {
		tx = tx.Where(groupCol+" = ?", group)
	}

	// 2) 先拿总数
	if err = tx.Model(&Log{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 3) 拿分页数据
	if err = tx.Order("id DESC").
		Limit(num).
		Offset(startIdx).
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	// 4) 填充 channel_name（不改）
	channelIds := make([]int, 0, len(logs))
	for _, l := range logs {
		if l.ChannelId != 0 {
			channelIds = append(channelIds, l.ChannelId)
		}
	}
	if len(channelIds) > 0 {
		var chs []struct {
			Id   int
			Name string
		}
		if err2 := DB.
			Table("channels").
			Select("id,name").
			Where("id IN ?", channelIds).
			Find(&chs).Error; err2 == nil {
			cmap := make(map[int]string, len(chs))
			for _, c := range chs {
				cmap[c.Id] = c.Name
			}
			for i := range logs {
				logs[i].ChannelName = cmap[logs[i].ChannelId]
			}
		}
	}

	return logs, total, nil
}

func GetUserLogs(userId int, logType int, startTimestamp int64, endTimestamp int64, modelName, tokenName string, startIdx, num int, group string) (logs []*Log, total int64, err error) {
	table := getLogTableByUser(userId)
	tx := LOG_DB.Table(table).Where("user_id = ?", userId)
	if logType != LogTypeUnknown {
		tx = tx.Where("type = ?", logType)
	}
	if modelName != "" {
		tx = tx.Where("model_name LIKE ?", modelName)
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
		tx = tx.Where(groupCol+" = ?", group)
	}
	if err = tx.Model(&Log{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err = tx.Order("id DESC").Limit(num).Offset(startIdx).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	formatUserLogs(logs)
	return logs, total, nil
}

func SearchAllLogs(keyword string) (logs []*Log, err error) {
	// 如果要跨分表，可改成遍历 100 张表或直接用 logs_all 视图
	err = LOG_DB.Where("type = ? OR content LIKE ?", keyword, keyword+"%").
		Order("id DESC").
		Limit(common.MaxRecentItems).
		Find(&logs).Error
	return logs, err
}

func SearchUserLogs(userId int, keyword string) (logs []*Log, err error) {
	table := getLogTableByUser(userId)
	err = LOG_DB.Table(table).
		Where("user_id = ? AND type = ?", userId, keyword).
		Order("id DESC").
		Limit(common.MaxRecentItems).
		Find(&logs).Error
	formatUserLogs(logs)
	return logs, err
}

type Stat struct {
	Quota int `json:"quota"`
	Rpm   int `json:"rpm"`
	Tpm   int `json:"tpm"`
}

func SumUsedQuota(logType int, startTimestamp int64, endTimestamp int64, modelName, username, tokenName string, channel int, group string) (stat Stat) {
	table := getAllLogsTable(LOG_DB)
	base := LOG_DB.Table(table).Where("type = ?", LogTypeConsume)
	rpmTpm := LOG_DB.Table(table).
		Where("type = ?", LogTypeConsume).
		Where("created_at >= ?", time.Now().Add(-60*time.Second).Unix())

	if username != "" {
		base = base.Where("username = ?", username)
		rpmTpm = rpmTpm.Where("username = ?", username)
	}
	if tokenName != "" {
		base = base.Where("token_name = ?", tokenName)
		rpmTpm = rpmTpm.Where("token_name = ?", tokenName)
	}
	if startTimestamp != 0 {
		base = base.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		base = base.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		base = base.Where("model_name LIKE ?", modelName)
		rpmTpm = rpmTpm.Where("model_name LIKE ?", modelName)
	}
	if channel != 0 {
		base = base.Where("channel_id = ?", channel)
		rpmTpm = rpmTpm.Where("channel_id = ?", channel)
	}
	if group != "" {
		base = base.Where(groupCol+" = ?", group)
		rpmTpm = rpmTpm.Where(groupCol+" = ?", group)
	}

	base.Select("SUM(quota) AS quota").Scan(&stat)
	rpmTpm.Select("COUNT(*) AS rpm, SUM(prompt_tokens)+SUM(completion_tokens) AS tpm").Scan(&stat)
	return stat
}

func SumUsedToken(logType int, startTimestamp int64, endTimestamp int64, modelName, username, tokenName string) (token int) {
	table := getAllLogsTable(LOG_DB)
	tx := LOG_DB.Table(table).Where("type = ?", LogTypeConsume)
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
	tx.Select("IFNULL(SUM(prompt_tokens),0)+IFNULL(SUM(completion_tokens),0)").Scan(&token)
	return token
}

// DeleteOldLog 会依次对 “logs” 及所有 “logs_XX” 分表执行批量删除
// 每次在单表上删除不超过 limit 条，直到该表所有符合条件的行被清理完毕
func DeleteOldLog(ctx context.Context, targetTimestamp int64, limit int) (int64, error) {
	// 构造要清理的表名列表：先原表，再所有分表
	tables := make([]string, 0, shardCount+1)
	tables = append(tables, "logs")
	for i := 0; i < shardCount; i++ {
		tables = append(tables, fmt.Sprintf("logs_%02d", i))
	}

	var totalDeleted int64

	for _, table := range tables {
		// 跳过不存在的表
		if !LOG_DB.Migrator().HasTable(table) {
			continue
		}
		// 这张表按批次删除，直到删不满 limit
		for {
			// 支持外部取消/超时
			if err := ctx.Err(); err != nil {
				return totalDeleted, err
			}
			res := LOG_DB.
				Table(table).
				Where("created_at < ?", targetTimestamp).
				Limit(limit).
				Delete(&Log{})
			if res.Error != nil {
				return totalDeleted, res.Error
			}
			totalDeleted += res.RowsAffected
			// 若本次删除行数 < limit，说明已无更多老数据
			if res.RowsAffected < int64(limit) {
				break
			}
		}
	}

	return totalDeleted, nil
}
