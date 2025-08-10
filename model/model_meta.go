package model

import (
    "one-api/common"
    "strconv"
    "strings"

    "gorm.io/gorm"
)

// Model 用于存储模型的元数据，例如描述、标签等
// ModelName 字段具有唯一性约束，确保每个模型只会出现一次
// Tags 字段使用逗号分隔的字符串保存标签集合，后期可根据需要扩展为 JSON 类型
// Status: 1 表示启用，0 表示禁用，保留以便后续功能扩展
// CreatedTime 和 UpdatedTime 使用 Unix 时间戳（秒）保存方便跨数据库移植
// DeletedAt 采用 GORM 的软删除特性，便于后续数据恢复
//
// 该表设计遵循第三范式（3NF）：
// 1. 每一列都与主键（Id 或 ModelName）直接相关
// 2. 不存在部分依赖（ModelName 是唯一键）
// 3. 不存在传递依赖（描述、标签等都依赖于 ModelName，而非依赖于其他非主键列）
// 这样既保证了数据一致性，也方便后期扩展

// 模型名称匹配规则
const (
    NameRuleExact = iota // 0 精确匹配
    NameRulePrefix       // 1 前缀匹配
    NameRuleContains     // 2 包含匹配
    NameRuleSuffix       // 3 后缀匹配
)

type BoundChannel struct {
    Name string `json:"name"`
    Type int    `json:"type"`
}

type Model struct {
    Id          int            `json:"id"`
    ModelName   string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name,where:deleted_at IS NULL"`
    Description string         `json:"description,omitempty" gorm:"type:text"`
    Tags        string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
    VendorID    int            `json:"vendor_id,omitempty" gorm:"index"`
    Endpoints   string         `json:"endpoints,omitempty" gorm:"type:text"`
    Status      int            `json:"status" gorm:"default:1"`
    CreatedTime int64          `json:"created_time" gorm:"bigint"`
    UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
    DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

    BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
    EnableGroups []string       `json:"enable_groups,omitempty" gorm:"-"`
    QuotaType    int            `json:"quota_type" gorm:"-"`
    NameRule     int            `json:"name_rule" gorm:"default:0"`
}

// Insert 创建新的模型元数据记录
func (mi *Model) Insert() error {
    now := common.GetTimestamp()
    mi.CreatedTime = now
    mi.UpdatedTime = now
    return DB.Create(mi).Error
}

// IsModelNameDuplicated 检查模型名称是否重复（排除自身 ID）
func IsModelNameDuplicated(id int, name string) (bool, error) {
    if name == "" {
        return false, nil
    }
    var cnt int64
    err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
    return cnt > 0, err
}

// Update 更新现有模型记录
func (mi *Model) Update() error {
    // 仅更新需要变更的字段，避免覆盖 CreatedTime
    mi.UpdatedTime = common.GetTimestamp()

    // 排除 created_time，其余字段自动更新，避免新增字段时需要维护列表
    return DB.Model(&Model{}).Where("id = ?", mi.Id).Omit("created_time").Updates(mi).Error
}

// Delete 软删除模型记录
func (mi *Model) Delete() error {
    return DB.Delete(mi).Error
}

// GetModelByName 根据模型名称查询元数据
func GetModelByName(name string) (*Model, error) {
    var mi Model
    err := DB.Where("model_name = ?", name).First(&mi).Error
    if err != nil {
        return nil, err
    }
    return &mi, nil
}

// GetVendorModelCounts 统计每个供应商下模型数量（不受分页影响）
func GetVendorModelCounts() (map[int64]int64, error) {
    var stats []struct {
        VendorID int64
        Count    int64
    }
    if err := DB.Model(&Model{}).
        Select("vendor_id as vendor_id, count(*) as count").
        Group("vendor_id").
        Scan(&stats).Error; err != nil {
        return nil, err
    }
    m := make(map[int64]int64, len(stats))
    for _, s := range stats {
        m[s.VendorID] = s.Count
    }
    return m, nil
}

// GetAllModels 分页获取所有模型元数据
func GetAllModels(offset int, limit int) ([]*Model, error) {
    var models []*Model
    err := DB.Offset(offset).Limit(limit).Find(&models).Error
    return models, err
}

// GetBoundChannels 查询支持该模型的渠道（名称+类型）
func GetBoundChannels(modelName string) ([]BoundChannel, error) {
    var channels []BoundChannel
    err := DB.Table("channels").
        Select("channels.name, channels.type").
        Joins("join abilities on abilities.channel_id = channels.id").
        Where("abilities.model = ? AND abilities.enabled = ?", modelName, true).
        Group("channels.id").
        Scan(&channels).Error
    return channels, err
}

// FindModelByNameWithRule 根据模型名称和匹配规则查找模型元数据，优先级：精确 > 前缀 > 后缀 > 包含
func FindModelByNameWithRule(name string) (*Model, error) {
    // 1. 精确匹配
    if m, err := GetModelByName(name); err == nil {
        return m, nil
    }
    // 2. 规则匹配
    var models []*Model
    if err := DB.Where("name_rule <> ?", NameRuleExact).Find(&models).Error; err != nil {
        return nil, err
    }
    var prefixMatch, suffixMatch, containsMatch *Model
    for _, m := range models {
        switch m.NameRule {
        case NameRulePrefix:
            if strings.HasPrefix(name, m.ModelName) {
                if prefixMatch == nil || len(m.ModelName) > len(prefixMatch.ModelName) {
                    prefixMatch = m
                }
            }
        case NameRuleSuffix:
            if strings.HasSuffix(name, m.ModelName) {
                if suffixMatch == nil || len(m.ModelName) > len(suffixMatch.ModelName) {
                    suffixMatch = m
                }
            }
        case NameRuleContains:
            if strings.Contains(name, m.ModelName) {
                if containsMatch == nil || len(m.ModelName) > len(containsMatch.ModelName) {
                    containsMatch = m
                }
            }
        }
    }
    if prefixMatch != nil {
        return prefixMatch, nil
    }
    if suffixMatch != nil {
        return suffixMatch, nil
    }
    if containsMatch != nil {
        return containsMatch, nil
    }
    return nil, gorm.ErrRecordNotFound
}

// SearchModels 根据关键词和供应商搜索模型，支持分页
func SearchModels(keyword string, vendor string, offset int, limit int) ([]*Model, int64, error) {
    var models []*Model
    db := DB.Model(&Model{})
    if keyword != "" {
        like := "%" + keyword + "%"
        db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
    }
    if vendor != "" {
        // 如果是数字，按供应商 ID 精确匹配；否则按名称模糊匹配
        if vid, err := strconv.Atoi(vendor); err == nil {
            db = db.Where("models.vendor_id = ?", vid)
        } else {
            db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
        }
    }
    var total int64
    err := db.Count(&total).Error
    if err != nil {
        return nil, 0, err
    }
    err = db.Offset(offset).Limit(limit).Order("models.id DESC").Find(&models).Error
    return models, total, err
}
