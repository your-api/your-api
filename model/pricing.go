package model

import (
	"one-api/common"
	"one-api/common/event"
	"one-api/setting/operation_setting"
	"sync"
	"time"
)

type Pricing struct {
	ModelName              string                  `json:"model_name"`
	ModelDescription       string                  `json:"model_description"`
	QuotaType              int                     `json:"quota_type"`
	ModelRatio             float64                 `json:"model_ratio"`
	ModelPrice             float64                 `json:"model_price"`
	OwnerBy                string                  `json:"owner_by"`
	CompletionRatio        float64                 `json:"completion_ratio"`
	EnableGroup            []string                `json:"enable_groups,omitempty"`
	SupportedEndpointTypes []common.EndpointType   `json:"supported_endpoint_types"`
}

var (
	pricingMap         []Pricing
	lastGetPricingTime time.Time
	updatePricingLock  sync.Mutex
)

// GetAllModelEndpointTypes 批量获取所有模型的端点类型
func GetAllModelEndpointTypes() map[string][]common.EndpointType {
	// 一次性查询所有模型和对应的渠道类型
	type ModelChannelType struct {
		Model       string `gorm:"column:model"`
		ChannelType int    `gorm:"column:type"`
	}

	var modelChannelTypes []ModelChannelType
	DB.Table("abilities").
		Select("DISTINCT abilities.model, channels.type").
		Joins("LEFT JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
		Scan(&modelChannelTypes)

	// 按模型分组处理端点类型
	modelToChannelTypes := make(map[string][]int)
	for _, mct := range modelChannelTypes {
		modelToChannelTypes[mct.Model] = append(modelToChannelTypes[mct.Model], mct.ChannelType)
	}

	// 生成每个模型的端点类型
	result := make(map[string][]common.EndpointType)
	for model, channelTypes := range modelToChannelTypes {
		endpointTypesMap := make(map[common.EndpointType]bool)
		
		for _, channelType := range channelTypes {
			endpointTypes := common.GetEndpointTypesByChannelType(channelType, model)
			for _, endpointType := range endpointTypes {
				endpointTypesMap[endpointType] = true
			}
		}

		// 转换为切片
		var supportedEndpoints []common.EndpointType
		for endpointType := range endpointTypesMap {
			supportedEndpoints = append(supportedEndpoints, endpointType)
		}
		
		result[model] = supportedEndpoints
	}

	return result
}

func init() {
	// 订阅模型描述更新事件
	event.Subscribe(event.ModelDescriptionsUpdated, func(data interface{}) {
		// 当收到模型描述更新事件时，触发价格更新
		UpdatePricing()
	})
}

func GetPricing() []Pricing {
	updatePricingLock.Lock()
	defer updatePricingLock.Unlock()

	if time.Since(lastGetPricingTime) > time.Minute*1 || len(pricingMap) == 0 {
		UpdatePricing()
	}
	//if group != "" {
	//	userPricingMap := make([]Pricing, 0)
	//	models := GetGroupModels(group)
	//	for _, pricing := range pricingMap {
	//		if !common.StringsContains(models, pricing.ModelName) {
	//			pricing.Available = false
	//		}
	//		userPricingMap = append(userPricingMap, pricing)
	//	}
	//	return userPricingMap
	//}
	return pricingMap
}

func UpdatePricing() {
	//modelRatios := common.GetModelRatios()
	enableAbilities := GetAllEnableAbilities()
	modelGroupsMap := make(map[string][]string)
	for _, ability := range enableAbilities {
		groups := modelGroupsMap[ability.Model]
		if groups == nil {
			groups = make([]string, 0)
		}
		if !common.StringsContains(groups, ability.Group) {
			groups = append(groups, ability.Group)
		}
		modelGroupsMap[ability.Model] = groups
	}

	// 批量获取所有模型的端点类型，提高效率
	allModelEndpointTypes := GetAllModelEndpointTypes()

	pricingMap = make([]Pricing, 0)
	for model, groups := range modelGroupsMap {
		// 从批量查询结果中获取端点类型
		supportedEndpoints := allModelEndpointTypes[model]
		if supportedEndpoints == nil {
			supportedEndpoints = []common.EndpointType{}
		}

		pricing := Pricing{
			ModelName:              model,
			EnableGroup:            groups,
			ModelDescription:       operation_setting.GetModelDescriptionsByID(model),
			SupportedEndpointTypes: supportedEndpoints,
		}
		modelPrice, findPrice := operation_setting.GetModelPrice(model, false)
		if findPrice {
			pricing.ModelPrice = modelPrice
			pricing.QuotaType = 1
		} else {
			modelRatio, _ := operation_setting.GetModelRatio(model)
			pricing.ModelRatio = modelRatio
			pricing.CompletionRatio = operation_setting.GetCompletionRatio(model)
			pricing.QuotaType = 0
		}
		pricingMap = append(pricingMap, pricing)
	}
	lastGetPricingTime = time.Now()
}
