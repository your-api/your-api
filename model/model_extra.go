package model

// GetModelEnableGroups 返回指定模型名称可用的用户分组列表。
// 使用在 updatePricing() 中维护的缓存映射，O(1) 读取，适合高并发场景。
func GetModelEnableGroups(modelName string) []string {
    // 确保缓存最新
    GetPricing()

    if modelName == "" {
        return make([]string, 0)
    }

    modelEnableGroupsLock.RLock()
    groups, ok := modelEnableGroups[modelName]
    modelEnableGroupsLock.RUnlock()
    if !ok {
        return make([]string, 0)
    }
    return groups
}

// GetModelQuotaType 返回指定模型的计费类型（quota_type）。
// 同样使用缓存映射，避免每次遍历定价切片。
func GetModelQuotaType(modelName string) int {
    GetPricing()

    modelEnableGroupsLock.RLock()
    quota, ok := modelQuotaTypeMap[modelName]
    modelEnableGroupsLock.RUnlock()
    if !ok {
        return 0
    }
    return quota
}
