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
	// 方法1: 从cookie中直接获取session ID（最可靠的方法）
	if cookie, err := c.Cookie("session"); err == nil && cookie != "" {
		if common.DebugEnabled {
			common.SysLog(fmt.Sprintf("found session ID from cookie: %s", cookie[:min(8, len(cookie))]+"..."))
		}
		return cookie
	}

	// 方法2: 尝试解析所有可能的session相关cookie
	for _, cookie := range c.Request.Cookies() {
		if cookie.Name == "session" && cookie.Value != "" {
			if common.DebugEnabled {
				common.SysLog(fmt.Sprintf("found session ID from cookie iteration: %s", cookie.Value[:min(8, len(cookie.Value))]+"..."))
			}
			return cookie.Value
		}
	}
	
	// 方法3: 尝试从session中获取ID（可能为空，因为session可能已过期）
	session := sessions.Default(c)
	if sessionID := session.ID(); sessionID != "" {
		if common.DebugEnabled {
			common.SysLog(fmt.Sprintf("found session ID from session.ID(): %s", sessionID[:min(8, len(sessionID))]+"..."))
		}
		return sessionID
	}

	// 记录调试信息
	common.SysLog("no session ID found in any method")
	if common.DebugEnabled {
		// 记录所有cookie信息用于调试
		cookies := make([]string, 0)
		for _, cookie := range c.Request.Cookies() {
			cookies = append(cookies, fmt.Sprintf("%s=%s", cookie.Name, cookie.Value[:min(10, len(cookie.Value))]+"..."))
		}
		common.SysLog(fmt.Sprintf("available cookies: %v", cookies))
	}
	
	return ""
}

// 辅助函数，避免数组越界
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
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

	// 设置为永不过期，保持用户登录态持久化
	return common.RedisSet(key, string(dataBytes), 0)
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

	// 由于session已设置为永不过期，此函数主要用于确认session仍然存在
	// 先检查session是否存在
	data, err := GetSessionCache(sessionID)
	if err != nil {
		return err
	}

	// 重新设置session，确保数据最新（虽然不会过期，但可以确保数据完整性）
	return SetSessionCache(sessionID, data)
}

// SyncSessionToRedis 将内存session同步到Redis
func SyncSessionToRedis(c *gin.Context, id int, username string, role int, status int, group string) {
	if !common.RedisEnabled {
		common.SysLog("Redis is not enabled, skip session sync")
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
	} else {
		common.SysLog(fmt.Sprintf("session synced to Redis successfully for user: %s (session: %s)", username, sessionID[:8]+"..."))
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
