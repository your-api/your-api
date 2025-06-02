package model

import (
	"errors"
	"fmt"
	"one-api/common"
	"strings"

	"github.com/samber/lo"
	"gorm.io/gorm"
)

type Ability struct {
	Group     string  `json:"group" gorm:"type:varchar(64);primaryKey;autoIncrement:false"`
	Model     string  `json:"model" gorm:"type:varchar(255);primaryKey;autoIncrement:false"`
	ChannelId int     `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	Enabled   bool    `json:"enabled"`
	Priority  *int64  `json:"priority" gorm:"bigint;default:0;index"`
	Weight    uint    `json:"weight" gorm:"default:0;index"`
	Tag       *string `json:"tag" gorm:"index"`
}

func GetGroupModels(group string) []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where(groupCol+" = ? and enabled = ?", group, true).Distinct("model").Pluck("model", &models)
	return models
}

func GetEnabledModels() []string {
	var models []string
	// Find distinct models
	DB.Table("abilities").Where("enabled = ?", true).Distinct("model").Pluck("model", &models)
	return models
}

func GetAllEnableAbilities() []Ability {
	var abilities []Ability
	DB.Find(&abilities, "enabled = ?", true)
	return abilities
}

func getPriority(group string, model string, retry int) (int, error) {
	trueVal := "1"
	if common.UsingPostgreSQL {
		trueVal = "true"
	}

	var priorities []int
	err := DB.Model(&Ability{}).
		Select("DISTINCT(priority)").
		Where(groupCol+" = ? and model = ? and enabled = "+trueVal, group, model).
		Order("priority DESC"). // 按优先级降序排序
		Pluck("priority", &priorities).Error // Pluck用于将查询的结果直接扫描到一个切片中

	if err != nil {
		// 处理错误
		return 0, err
	}

	if len(priorities) == 0 {
		// 如果没有查询到优先级，则返回错误
		return 0, errors.New("数据库一致性被破坏")
	}

	// 确定要使用的优先级
	var priorityToUse int
	if retry >= len(priorities) {
		// 如果重试次数大于优先级数，则使用最小的优先级
		priorityToUse = priorities[len(priorities)-1]
	} else {
		priorityToUse = priorities[retry]
	}
	return priorityToUse, nil
}

func getChannelQuery(group string, model string, retry int) *gorm.DB {
	trueVal := "1"
	if common.UsingPostgreSQL {
		trueVal = "true"
	}
	maxPrioritySubQuery := DB.Model(&Ability{}).Select("MAX(priority)").Where(groupCol+" = ? and model = ? and enabled = "+trueVal, group, model)
	channelQuery := DB.Where(groupCol+" = ? and model = ? and enabled = "+trueVal+" and priority = (?)", group, model, maxPrioritySubQuery)
	if retry != 0 {
		priority, err := getPriority(group, model, retry)
		if err != nil {
			common.SysError(fmt.Sprintf("Get priority failed: %s", err.Error()))
		} else {
			channelQuery = DB.Where(groupCol+" = ? and model = ? and enabled = "+trueVal+" and priority = ?", group, model, priority)
		}
	}

	return channelQuery
}

func GetRandomSatisfiedChannel(group string, model string, retry int) (*Channel, error) {
	var abilities []Ability

	var err error = nil
	channelQuery := getChannelQuery(group, model, retry)
	if common.UsingSQLite || common.UsingPostgreSQL {
		err = channelQuery.Order("weight DESC").Find(&abilities).Error
	} else {
		err = channelQuery.Order("weight DESC").Find(&abilities).Error
	}
	if err != nil {
		return nil, err
	}
	channel := Channel{}
	if len(abilities) > 0 {
		// Randomly choose one
		weightSum := uint(0)
		for _, ability_ := range abilities {
			weightSum += ability_.Weight + 10
		}
		// Randomly choose one
		weight := common.GetRandomInt(int(weightSum))
		for _, ability_ := range abilities {
			weight -= int(ability_.Weight) + 10
			//log.Printf("weight: %d, ability weight: %d", weight, *ability_.Weight)
			if weight <= 0 {
				channel.Id = ability_.ChannelId
				break
			}
		}
	} else {
		return nil, errors.New("channel not found")
	}
	err = DB.First(&channel, "id = ?", channel.Id).Error
	if err != nil {
		return nil, err
	}

	// 处理 Key 字段，如果包含逗号分隔的多个值
	if strings.Contains(channel.Key, ",") {
		keys := strings.Split(channel.Key, ",")
		if len(keys) > 0 {
			// 使用当前 Robin 值选择 key
			keyIndex := channel.Robin % len(keys)
			channel.Key = keys[keyIndex]

			// 更新 Robin 值，循环 0 -> len-1 -> 0
			newRobin := (channel.Robin + 1) % len(keys)
			DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("robin", newRobin)
		}
	}

	return &channel, nil
}

func (channel *Channel) AddAbilities() error {
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	abilities := make([]Ability, 0, len(models_))
	for _, model := range models_ {
		for _, group := range groups_ {
			ability := Ability{
				Group:     group,
				Model:     model,
				ChannelId: channel.Id,
				Enabled:   channel.Status == common.ChannelStatusEnabled,
				Priority:  channel.Priority,
				Weight:    uint(channel.GetWeight()),
				Tag:       channel.Tag,
			}
			abilities = append(abilities, ability)
		}
	}
	if len(abilities) == 0 {
		return nil
	}
	for _, chunk := range lo.Chunk(abilities, 50) {
		err := DB.Create(&chunk).Error
		if err != nil {
			return err
		}
	}
	return nil
}

func (channel *Channel) DeleteAbilities() error {
	return DB.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
}

// UpdateAbilities updates abilities of this channel.
// Make sure the channel is completed before calling this function.
func (channel *Channel) UpdateAbilities(tx *gorm.DB) error {
	isNewTx := false
	// 如果没有传入事务，创建新的事务
	if tx == nil {
		tx = DB.Begin()
		if tx.Error != nil {
			return tx.Error
		}
		isNewTx = true
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()
	}

	// First delete all abilities of this channel
	err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error
	if err != nil {
		if isNewTx {
			tx.Rollback()
		}
		return err
	}

	// Then add new abilities
	models_ := strings.Split(channel.Models, ",")
	groups_ := strings.Split(channel.Group, ",")
	abilities := make([]Ability, 0, len(models_))
	
	// 使用map去重，避免重复的(group, model, channel_id)组合
	abilityMap := make(map[string]bool)
	for _, model := range models_ {
		for _, group := range groups_ {
			key := fmt.Sprintf("%s-%s-%d", group, model, channel.Id)
			if !abilityMap[key] {
				abilityMap[key] = true
				ability := Ability{
					Group:     group,
					Model:     model,
					ChannelId: channel.Id,
					Enabled:   channel.Status == common.ChannelStatusEnabled,
					Priority:  channel.Priority,
					Weight:    uint(channel.GetWeight()),
					Tag:       channel.Tag,
				}
				abilities = append(abilities, ability)
			}
		}
	}

	if len(abilities) > 0 {
		for _, chunk := range lo.Chunk(abilities, 50) {
			// 使用 CREATE OR IGNORE 避免重复键错误
			result := tx.Create(&chunk)
			if result.Error != nil {
				// 如果是重复键错误，记录但继续执行
				if strings.Contains(result.Error.Error(), "Duplicate entry") {
					common.SysError(fmt.Sprintf("Duplicate entry found for channel %d, continuing...", channel.Id))
					continue
				}
				if isNewTx {
					tx.Rollback()
				}
				return result.Error
			}
		}
	}

	// 如果是新创建的事务，需要提交
	if isNewTx {
		return tx.Commit().Error
	}

	return nil
}

func UpdateAbilityStatus(channelId int, status bool) error {
	return DB.Model(&Ability{}).Where("channel_id = ?", channelId).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityStatusByTag(tag string, status bool) error {
	return DB.Model(&Ability{}).Where("tag = ?", tag).Select("enabled").Update("enabled", status).Error
}

func UpdateAbilityByTag(tag string, newTag *string, priority *int64, weight *uint) error {
	ability := Ability{}
	if newTag != nil {
		ability.Tag = newTag
	}
	if priority != nil {
		ability.Priority = priority
	}
	if weight != nil {
		ability.Weight = *weight
	}
	return DB.Model(&Ability{}).Where("tag = ?", tag).Updates(ability).Error
}

func FixAbility() (int, error) {
	var channelIds []int
	count := 0
	
	// 首先在事务中清理重复数据
	tx := DB.Begin()
	if tx.Error != nil {
		return 0, tx.Error
	}
	
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			common.SysError(fmt.Sprintf("FixAbility panic: %v", r))
		}
	}()
	
	// 删除所有abilities数据，然后重新生成，这是最安全的方法
	err := tx.Exec("DELETE FROM abilities").Error
	if err != nil {
		tx.Rollback()
		common.SysError(fmt.Sprintf("Failed to clear abilities table: %s", err.Error()))
		return 0, err
	}
	
	err = tx.Commit().Error
	if err != nil {
		return 0, err
	}
	
	common.SysLog("Cleared all abilities data for regeneration")
	
	// Find all channel ids from channel table
	err = DB.Model(&Channel{}).Pluck("id", &channelIds).Error
	if err != nil {
		common.SysError(fmt.Sprintf("Get channel ids from channel table failed: %s", err.Error()))
		return 0, err
	}

	if len(channelIds) == 0 {
		common.SysLog("No channels found, abilities table cleared")
		InitChannelCache()
		return 0, nil
	}

	common.SysLog(fmt.Sprintf("Found %d channels, regenerating abilities", len(channelIds)))

	// 获取所有channels并重新生成abilities
	var channels []Channel
	err = DB.Find(&channels).Error
	if err != nil {
		common.SysError(fmt.Sprintf("Find all channels failed: %s", err.Error()))
		return count, err
	}

	for _, channel := range channels {
		err := channel.UpdateAbilities(nil)
		if err != nil {
			common.SysError(fmt.Sprintf("Update abilities of channel %d failed: %s", channel.Id, err.Error()))
		} else {
			common.SysLog(fmt.Sprintf("Update abilities of channel %d successfully", channel.Id))
			count++
		}
	}
	
	// 安全地初始化缓存
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("InitChannelCache panic during FixAbility: %v", r))
		}
	}()
	InitChannelCache()
	
	return count, nil
}
