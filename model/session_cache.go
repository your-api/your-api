package model

import (
	"encoding/json"
	"fmt"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"one-api/common"
	"time"
)

// SessionData 表示session数据结构
type SessionData struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Role      int    `json:"role"`
	Status    int    `json:"status"`
	Group     string `json:"group"`
	LoginTime int64  `json:"login_time"`
}

// getSessionIDFromContext 从gin.Context中获取session ID
func getSessionIDFromContext(c *gin.Context) string {
	// 方法1: 从cookie中直接获取session ID
	if cookie, err := c.Cookie("session"); err == nil && cookie != "" {
		common.SysLog(fmt.Sprintf("found session ID from cookie: %s", cookie[:8]+"..."))
		return cookie
	}

	// 方法2: 尝试从session中获取ID
	session := sessions.Default(c)
	if sessionID := session.ID(); sessionID != "" {
		common.SysLog(fmt.Sprintf("found session ID from session.ID(): %s", sessionID[:8]+"..."))
		return sessionID
	}

	common.SysLog("no session ID found")
	return ""
}

// getSessionCacheKey 生成session缓存key
func getSessionCacheKey(sessionID string) string {
	return fmt.Sprintf("session:%s", sessionID)
}

// SetSessionCache 设置session到Redis缓存
func SetSessionCache(sessionID string, data *SessionData) error {
	if !common.RedisEnabled {
		return nil // 如果Redis未启用，直接返回
	}

	key := getSessionCacheKey(sessionID)
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal session data: %w", err)
	}

	// 设置30天过期时间，与cookie session保持一致
	return common.RedisSet(key, string(dataBytes), 30*24*time.Hour)
}

// GetSessionCache 从Redis缓存获取session
func GetSessionCache(sessionID string) (*SessionData, error) {
	if !common.RedisEnabled {
		return nil, fmt.Errorf("redis is not enabled")
	}

	key := getSessionCacheKey(sessionID)
	dataStr, err := common.RedisGet(key)
	if err != nil {
		return nil, fmt.Errorf("failed to get session from redis: %w", err)
	}

	var data SessionData
	err = json.Unmarshal([]byte(dataStr), &data)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal session data: %w", err)
	}

	return &data, nil
}

// DeleteSessionCache 从Redis缓存删除session
func DeleteSessionCache(sessionID string) error {
	if !common.RedisEnabled {
		return nil // 如果Redis未启用，直接返回
	}

	key := getSessionCacheKey(sessionID)
	return common.RedisDel(key)
}

// RefreshSessionCache 刷新session过期时间
func RefreshSessionCache(sessionID string) error {
	if !common.RedisEnabled {
		return nil
	}

	// 先检查session是否存在
	data, err := GetSessionCache(sessionID)
	if err != nil {
		return err
	}

	// 重新设置session，刷新过期时间
	return SetSessionCache(sessionID, data)
}

// SyncSessionToRedis 将内存session同步到Redis
func SyncSessionToRedis(c *gin.Context, id int, username string, role int, status int, group string) {
	if !common.RedisEnabled {
		return
	}

	sessionID := getSessionIDFromContext(c)
	if sessionID == "" {
		common.SysError("failed to get session ID for Redis sync")
		return
	}

	sessionData := &SessionData{
		ID:        id,
		Username:  username,
		Role:      role,
		Status:    status,
		Group:     group,
		LoginTime: time.Now().Unix(),
	}

	err := SetSessionCache(sessionID, sessionData)
	if err != nil {
		common.SysError("failed to sync session to redis: " + err.Error())
	}
}

// GetSessionCacheFromContext 从gin.Context获取Redis缓存的session
func GetSessionCacheFromContext(c *gin.Context) (*SessionData, error) {
	sessionID := getSessionIDFromContext(c)
	if sessionID == "" {
		return nil, fmt.Errorf("session ID not found")
	}

	return GetSessionCache(sessionID)
}

// DeleteSessionCacheFromContext 从gin.Context删除Redis缓存的session
func DeleteSessionCacheFromContext(c *gin.Context) error {
	sessionID := getSessionIDFromContext(c)
	if sessionID == "" {
		return nil // 没有session ID，不需要删除
	}

	return DeleteSessionCache(sessionID)
}

// RefreshSessionCacheFromContext 从gin.Context刷新Redis缓存的session
func RefreshSessionCacheFromContext(c *gin.Context) error {
	sessionID := getSessionIDFromContext(c)
	if sessionID == "" {
		return nil // 没有session ID，不需要刷新
	}

	return RefreshSessionCache(sessionID)
}
