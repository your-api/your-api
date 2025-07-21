package model

import (
	"errors"
	"fmt"
	"math/rand"
	"one-api/common"
	"sort"
	"strings"
	"sync"
	"time"
)

var group2model2channels map[string]map[string][]*Channel
var channelsIDM map[int]*Channel
var channelSyncLock sync.RWMutex

func InitChannelCache() {
	if !common.MemoryCacheEnabled {
		return
	}

	// 添加defer函数捕获panic，避免系统崩溃
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("InitChannelCache panic recovered: %v", r))
		}
	}()

	newChannelId2channel := make(map[int]*Channel)
	var channels []*Channel
	DB.Where("status = ?", common.ChannelStatusEnabled).Find(&channels)
	for _, channel := range channels {
		newChannelId2channel[channel.Id] = channel
	}
	var abilities []*Ability
	DB.Find(&abilities)
	groups := make(map[string]bool)
	for _, ability := range abilities {
		groups[ability.Group] = true
	}
	newGroup2model2channels := make(map[string]map[string][]*Channel)
	newChannelsIDM := make(map[int]*Channel)

	// 预先初始化所有group的map
	for group := range groups {
		newGroup2model2channels[group] = make(map[string][]*Channel)
	}

	for _, channel := range channels {
		newChannelsIDM[channel.Id] = channel
		groups := strings.Split(channel.Group, ",")
		for _, group := range groups {
			// 确保group存在于map中
			if _, exists := newGroup2model2channels[group]; !exists {
				newGroup2model2channels[group] = make(map[string][]*Channel)
			}

			models := strings.Split(channel.Models, ",")
			for _, model := range models {
				if _, ok := newGroup2model2channels[group][model]; !ok {
					newGroup2model2channels[group][model] = make([]*Channel, 0)
				}
				newGroup2model2channels[group][model] = append(newGroup2model2channels[group][model], channel)
			}
		}
	}

	// sort by priority
	for group, model2channels := range newGroup2model2channels {
		for model, channels := range model2channels {
			sort.Slice(channels, func(i, j int) bool {
				return channels[i].GetPriority() > channels[j].GetPriority()
			})
			newGroup2model2channels[group][model] = channels
		}
	}

	channelSyncLock.Lock()
	group2model2channels = newGroup2model2channels
	channelsIDM = newChannelsIDM
	channelSyncLock.Unlock()
	common.SysLog("channels synced from database")
}

func SyncChannelCache(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog("syncing channels from database")
		InitChannelCache()
	}
}

func CacheGetRandomSatisfiedChannel(group string, model string, retry int) (*Channel, error) {
	if strings.HasPrefix(model, "gpt-4-gizmo") {
		model = "gpt-4-gizmo-*"
	}
	if strings.HasPrefix(model, "gpt-4o-gizmo") {
		model = "gpt-4o-gizmo-*"
	}

	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetRandomSatisfiedChannel(group, model, retry)
	}

	channelSyncLock.RLock()
	channels := group2model2channels[group][model]
	channelSyncLock.RUnlock()

	if len(channels) == 0 {
		return nil, errors.New("channel not found")
	}

	// 获取所有唯一优先级并按从高到低排序
	// uniquePriorities2 int数组
	sortedUniquePriorities := []int{}

	for _, channel := range channels {
		sortedUniquePriorities = append(sortedUniquePriorities, int(channel.GetPriority()))
	}

	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	// 如果重试次数超过优先级数量，使用模运算实现循环
	// 这样可以无限循环重试，按优先级从高到低循环
	if len(sortedUniquePriorities) == 0 {
		return nil, errors.New("no available priorities")
	}

	// 使用新的重试配置计算优先级索引
	priorityIndex := common.CalculateRetryIndex(retry, len(sortedUniquePriorities))
	targetPriority := int64(sortedUniquePriorities[priorityIndex])

	// 获取目标优先级的所有渠道
	var targetChannels []*Channel
	for _, channel := range channels {
		if channel.GetPriority() == targetPriority {
			targetChannels = append(targetChannels, channel)
		}
	}

	if len(targetChannels) == 0 {
		return nil, errors.New("no channels found for target priority")
	}

	// 对同优先级的渠道进行随机排序，实现负载均衡
	//common.ShuffleChannels(targetChannels)

	// 平滑系数
	smoothingFactor := 10
	// Calculate the total weight of all channels up to endIdx
	totalWeight := 0
	for _, channel := range targetChannels {
		totalWeight += channel.GetWeight() + smoothingFactor
	}
	// Generate a random value in the range [0, totalWeight)
	randomWeight := rand.Intn(totalWeight)

	// Find a channel based on its weight
	for _, channel := range targetChannels {
		randomWeight -= channel.GetWeight() + smoothingFactor
		if randomWeight < 0 {
			// 如果包含逗号分隔的多个值，创建副本以避免修改缓存中的原始对象
			if strings.Contains(channel.Key, ",") {
				// 创建channel的副本
				channelCopy := *channel

				keys := strings.Split(channel.Key, ",")
				if len(keys) > 0 {
					// 使用当前 Robin 值选择 key
					keyIndex := channel.Robin % len(keys)
					// 只修改副本的Key
					channelCopy.Key = keys[keyIndex]

					// 更新原始channel的Robin值，但不修改其Key
					newRobin := (channel.Robin + 1) % len(keys)
					channel.Robin = newRobin
					//DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("robin", newRobin)
				}

				return &channelCopy, nil
			}

			// 如果没有逗号，直接返回原始channel
			return channel, nil
		}
	}
	// return null if no channel is not found
	return nil, errors.New("channel not found")
}

// CacheGetRandomSatisfiedChannelWithType 根据指定类型获取随机满足条件的渠道
func CacheGetRandomSatisfiedChannelWithType(group string, model string, retry int, channelType int) (*Channel, error) {
	if strings.HasPrefix(model, "gpt-4-gizmo") {
		model = "gpt-4-gizmo-*"
	}
	if strings.HasPrefix(model, "gpt-4o-gizmo") {
		model = "gpt-4o-gizmo-*"
	}

	// if memory cache is disabled, get channel directly from database
	if !common.MemoryCacheEnabled {
		return GetRandomSatisfiedChannelWithType(group, model, retry, channelType)
	}

	channelSyncLock.RLock()
	channels := group2model2channels[group][model]
	channelSyncLock.RUnlock()

	if len(channels) == 0 {
		return nil, errors.New("channel not found")
	}

	// 过滤指定类型的渠道
	var filteredChannels []*Channel
	for _, channel := range channels {
		if channel.Type == channelType {
			filteredChannels = append(filteredChannels, channel)
		}
	}

	if len(filteredChannels) == 0 {
		return nil, errors.New(fmt.Sprintf("no channels found for type %d", channelType))
	}

	// 获取所有唯一优先级并按从高到低排序
	sortedUniquePriorities := []int{}

	for _, channel := range filteredChannels {
		sortedUniquePriorities = append(sortedUniquePriorities, int(channel.GetPriority()))
	}

	sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

	// 如果重试次数超过优先级数量，使用模运算实现循环
	if len(sortedUniquePriorities) == 0 {
		return nil, errors.New("no available priorities")
	}

	// 使用新的重试配置计算优先级索引
	priorityIndex := common.CalculateRetryIndex(retry, len(sortedUniquePriorities))
	targetPriority := int64(sortedUniquePriorities[priorityIndex])

	// 获取目标优先级的所有渠道
	var targetChannels []*Channel
	for _, channel := range filteredChannels {
		if channel.GetPriority() == targetPriority {
			targetChannels = append(targetChannels, channel)
		}
	}

	if len(targetChannels) == 0 {
		return nil, errors.New("no channels found for target priority")
	}

	// 平滑系数
	smoothingFactor := 10
	// Calculate the total weight of all channels up to endIdx
	totalWeight := 0
	for _, channel := range targetChannels {
		totalWeight += channel.GetWeight() + smoothingFactor
	}
	// Generate a random value in the range [0, totalWeight)
	randomWeight := rand.Intn(totalWeight)

	// Find a channel based on its weight
	for _, channel := range targetChannels {
		randomWeight -= channel.GetWeight() + smoothingFactor
		if randomWeight < 0 {
			// 如果包含逗号分隔的多个值，创建副本以避免修改缓存中的原始对象
			if strings.Contains(channel.Key, ",") {
				// 创建channel的副本
				channelCopy := *channel

				keys := strings.Split(channel.Key, ",")
				if len(keys) > 0 {
					// 使用当前 Robin 值选择 key
					keyIndex := channel.Robin % len(keys)
					// 只修改副本的Key
					channelCopy.Key = keys[keyIndex]

					// 更新原始channel的Robin值，但不修改其Key
					newRobin := (channel.Robin + 1) % len(keys)
					channel.Robin = newRobin
				}

				return &channelCopy, nil
			}

			// 如果没有逗号，直接返回原始channel
			return channel, nil
		}
	}
	// return null if no channel is not found
	return nil, errors.New("channel not found")
}

func CacheGetChannel(id int) (*Channel, error) {
	if !common.MemoryCacheEnabled {
		return GetChannelById(id, true)
	}
	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	c, ok := channelsIDM[id]
	if !ok {
		return nil, errors.New(fmt.Sprintf("当前渠道# %d，已不存在", id))
	}
	return c, nil
}

func CacheUpdateChannelStatus(id int, status int) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	if channel, ok := channelsIDM[id]; ok {
		channel.Status = status
	}
}
