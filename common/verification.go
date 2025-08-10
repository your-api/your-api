package common

import (
	"fmt"
	"github.com/google/uuid"
	"math/rand"
	"strconv"
	"strings"
	"sync"
	"time"
)

type verificationValue struct {
	code string
	time time.Time
}

const (
	EmailVerificationPurpose = "v"
	PhoneVerificationPurpose = "p"
	PasswordResetPurpose     = "r"
)

var verificationMutex sync.Mutex
var verificationMap map[string]verificationValue
var verificationMapMaxSize = 1000  // 增加到 1000，避免验证码被过早清理
var VerificationValidMinutes = 10

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

// GenerateNumericVerificationCode 生成指定长度的纯数字验证码
func GenerateNumericVerificationCode(length int) string {
	if length <= 0 {
		length = 6
	}
	
	// 生成指定长度的随机数字
	min := 1
	for i := 1; i < length; i++ {
		min *= 10
	}
	max := min*10 - 1
	
	code := rand.Intn(max-min+1) + min
	return strconv.Itoa(code)
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	// 如果 Redis 可用，优先使用 Redis 存储
	if RedisEnabled {
		redisKey := fmt.Sprintf("verification:%s%s", purpose, key)
		err := RedisSet(redisKey, code, time.Duration(VerificationValidMinutes)*time.Minute)
		if err == nil {
			return // Redis 存储成功，直接返回
		}
		// Redis 存储失败，继续使用内存存储作为后备
	}
	
	// 内存存储
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap[purpose+key] = verificationValue{
		code: code,
		time: time.Now(),
	}
	if len(verificationMap) > verificationMapMaxSize {
		removeExpiredPairs()
	}
}

func VerifyCodeWithKey(key string, code string, purpose string) bool {
	// 如果 Redis 可用，优先从 Redis 验证
	if RedisEnabled {
		redisKey := fmt.Sprintf("verification:%s%s", purpose, key)
		storedCode, err := RedisGet(redisKey)
		if err == nil && storedCode != "" {
			// 验证成功后删除 Redis 中的验证码（一次性使用）
			if code == storedCode {
				RedisDel(redisKey)
				return true
			}
			return false
		}
		// Redis 中没有找到，继续尝试内存存储
	}
	
	// 从内存存储验证
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	// 验证成功后删除内存中的验证码（一次性使用）
	if code == value.code {
		delete(verificationMap, purpose+key)
		return true
	}
	return false
}

func DeleteKey(key string, purpose string) {
	// 如果 Redis 可用，从 Redis 删除
	if RedisEnabled {
		redisKey := fmt.Sprintf("verification:%s%s", purpose, key)
		RedisDel(redisKey)
	}
	
	// 从内存存储删除
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
}

// no lock inside, so the caller must lock the verificationMap before calling!
func removeExpiredPairs() {
	now := time.Now()
	for key := range verificationMap {
		if int(now.Sub(verificationMap[key].time).Seconds()) >= VerificationValidMinutes*60 {
			delete(verificationMap, key)
		}
	}
}

func init() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}
