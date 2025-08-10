package controller

import (
    "encoding/json"
    "strconv"

    "one-api/common"
    "one-api/model"

    "github.com/gin-gonic/gin"
)

// GetAllModelsMeta 获取模型列表（分页）
func GetAllModelsMeta(c *gin.Context) {

    pageInfo := common.GetPageQuery(c)
    modelsMeta, err := model.GetAllModels(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
    if err != nil {
        common.ApiError(c, err)
        return
    }
    // 填充附加字段
    for _, m := range modelsMeta {
        fillModelExtra(m)
    }
    var total int64
    model.DB.Model(&model.Model{}).Count(&total)

    // 统计供应商计数（全部数据，不受分页影响）
    vendorCounts, _ := model.GetVendorModelCounts()

    pageInfo.SetTotal(int(total))
    pageInfo.SetItems(modelsMeta)
    common.ApiSuccess(c, gin.H{
        "items":         modelsMeta,
        "total":         total,
        "page":          pageInfo.GetPage(),
        "page_size":     pageInfo.GetPageSize(),
        "vendor_counts": vendorCounts,
    })
}

// SearchModelsMeta 搜索模型列表
func SearchModelsMeta(c *gin.Context) {

    keyword := c.Query("keyword")
    vendor := c.Query("vendor")
    pageInfo := common.GetPageQuery(c)

    modelsMeta, total, err := model.SearchModels(keyword, vendor, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
    if err != nil {
        common.ApiError(c, err)
        return
    }
    for _, m := range modelsMeta {
        fillModelExtra(m)
    }
    pageInfo.SetTotal(int(total))
    pageInfo.SetItems(modelsMeta)
    common.ApiSuccess(c, pageInfo)
}

// GetModelMeta 根据 ID 获取单条模型信息
func GetModelMeta(c *gin.Context) {
    idStr := c.Param("id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    var m model.Model
    if err := model.DB.First(&m, id).Error; err != nil {
        common.ApiError(c, err)
        return
    }
    fillModelExtra(&m)
    common.ApiSuccess(c, &m)
}

// CreateModelMeta 新建模型
func CreateModelMeta(c *gin.Context) {
    var m model.Model
    if err := c.ShouldBindJSON(&m); err != nil {
        common.ApiError(c, err)
        return
    }
    if m.ModelName == "" {
        common.ApiErrorMsg(c, "模型名称不能为空")
        return
    }
    // 名称冲突检查
    if dup, err := model.IsModelNameDuplicated(0, m.ModelName); err != nil {
        common.ApiError(c, err)
        return
    } else if dup {
        common.ApiErrorMsg(c, "模型名称已存在")
        return
    }

    if err := m.Insert(); err != nil {
        common.ApiError(c, err)
        return
    }
    model.RefreshPricing()
    common.ApiSuccess(c, &m)
}

// UpdateModelMeta 更新模型
func UpdateModelMeta(c *gin.Context) {
    statusOnly := c.Query("status_only") == "true"

    var m model.Model
    if err := c.ShouldBindJSON(&m); err != nil {
        common.ApiError(c, err)
        return
    }
    if m.Id == 0 {
        common.ApiErrorMsg(c, "缺少模型 ID")
        return
    }

    if statusOnly {
        // 只更新状态，防止误清空其他字段
        if err := model.DB.Model(&model.Model{}).Where("id = ?", m.Id).Update("status", m.Status).Error; err != nil {
            common.ApiError(c, err)
            return
        }
    } else {
        // 名称冲突检查
        if dup, err := model.IsModelNameDuplicated(m.Id, m.ModelName); err != nil {
            common.ApiError(c, err)
            return
        } else if dup {
            common.ApiErrorMsg(c, "模型名称已存在")
            return
        }

        if err := m.Update(); err != nil {
            common.ApiError(c, err)
            return
        }
    }
    model.RefreshPricing()
    common.ApiSuccess(c, &m)
}

// DeleteModelMeta 删除模型
func DeleteModelMeta(c *gin.Context) {
    idStr := c.Param("id")
    id, err := strconv.Atoi(idStr)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    if err := model.DB.Delete(&model.Model{}, id).Error; err != nil {
        common.ApiError(c, err)
        return
    }
    model.RefreshPricing()
    common.ApiSuccess(c, nil)
}

// 辅助函数：填充 Endpoints 和 BoundChannels 和 EnableGroups
func fillModelExtra(m *model.Model) {
    if m.Endpoints == "" {
        eps := model.GetModelSupportEndpointTypes(m.ModelName)
        if b, err := json.Marshal(eps); err == nil {
            m.Endpoints = string(b)
        }
    }
    if channels, err := model.GetBoundChannels(m.ModelName); err == nil {
        m.BoundChannels = channels
    }
    // 填充启用分组
    m.EnableGroups = model.GetModelEnableGroups(m.ModelName)
    // 填充计费类型
    m.QuotaType = model.GetModelQuotaType(m.ModelName)
}
