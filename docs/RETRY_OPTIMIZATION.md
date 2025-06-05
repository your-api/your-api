# 渠道重试机制优化

## 概述

本项目已对渠道重试机制进行了全面优化，支持按优先级轮询重试、循环重试和更灵活的配置管理。

## 主要改进

### 1. 按优先级轮询重试

- **原理**: 按照渠道优先级从高到低进行重试
- **实现**: 获取所有唯一优先级，按降序排列，重试时按顺序选择不同优先级的渠道
- **优势**: 确保高优先级渠道优先使用，失败后逐步降级到低优先级渠道
- **负载均衡**: 在同优先级的渠道之间进行随机排序，避免总是选择同一个渠道

### 2. 循环重试支持

- **功能**: 当重试次数超过可用优先级数量时，可以循环使用所有优先级
- **配置**: 通过 `EnableCyclicRetry` 参数控制
- **计算**: 使用模运算 `retry % priorityCount` 实现循环

### 3. 更大的重试次数支持

- **新增配置**: `MaxRetryTimes` 支持更多重试次数（默认10次）
- **兼容性**: 保持对原有 `RetryTimes` 配置的兼容性
- **选择逻辑**: 优先使用 `RetryTimes`，如果为0则使用 `MaxRetryTimes`

### 4. 同优先级负载均衡

- **目的**: 避免在同优先级渠道中总是选择同一个渠道
- **实现**: 使用Fisher-Yates洗牌算法对同优先级渠道进行随机排序
- **效果**: 在保证优先级规则的前提下，实现同优先级渠道间的负载均衡

## 新增配置项

### 系统配置

```go
// 最大重试次数，可以配置
var MaxRetryTimes = 10

// 是否启用循环重试（当重试次数超过优先级数量时循环使用优先级）
var EnableCyclicRetry = true

// 是否尝试所有优先级的渠道
var RetryAllPriorities = true
```

### 数据库配置

这些配置项会自动添加到系统设置中，可以通过管理后台进行调整：

- `MaxRetryTimes`: 最大重试次数
- `EnableCyclicRetry`: 是否启用循环重试
- `RetryAllPriorities`: 是否尝试所有优先级

## 重试逻辑详解

### 1. 缓存模式 (MemoryCache)

在 `model/cache.go` 中的 `CacheGetRandomSatisfiedChannel` 函数：

```go
// 获取所有唯一优先级并按从高到低排序
uniquePriorities := make(map[int]bool)
for _, channel := range channels {
    uniquePriorities[int(channel.GetPriority())] = true
}
var sortedUniquePriorities []int
for priority := range uniquePriorities {
    sortedUniquePriorities = append(sortedUniquePriorities, priority)
}
sort.Sort(sort.Reverse(sort.IntSlice(sortedUniquePriorities)))

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

// 对同优先级的渠道进行随机排序，实现负载均衡
common.ShuffleChannels(targetChannels)
```

### 2. 数据库模式

在 `model/ability.go` 中的 `GetRandomSatisfiedChannel` 函数：

```go
// 获取同优先级的所有abilities
var abilities []Ability
channelQuery := getChannelQuery(group, model, retry)
err = channelQuery.Order("weight DESC").Find(&abilities).Error

if len(abilities) > 0 {
    // 对同优先级的abilities进行随机排序，实现负载均衡
    common.ShuffleChannels(abilities)
    
    // 然后进行权重选择
    // ... 权重选择逻辑
}
```

### 3. 重试索引计算与负载均衡

在 `common/retry_config.go` 中提供的核心函数：

```go
// 计算重试索引
func CalculateRetryIndex(retryCount int, priorityCount int) int {
    if priorityCount == 0 {
        return 0
    }
    
    if EnableCyclicRetry {
        return retryCount % priorityCount
    } else {
        if retryCount >= priorityCount {
            return priorityCount - 1
        }
        return retryCount
    }
}

// 同优先级渠道随机排序
func ShuffleChannels[T any](slice []T) {
    for i := len(slice) - 1; i > 0; i-- {
        j := rand.Intn(i + 1)
        slice[i], slice[j] = slice[j], slice[i]
    }
}
```

## 使用示例

### 场景1: 正常重试（不循环）

假设有3个优先级：100, 80, 60

- 重试0: 优先级100
- 重试1: 优先级80  
- 重试2: 优先级60
- 重试3: 优先级60 (停留在最低优先级)
- 重试4: 优先级60
- ...

### 场景2: 循环重试

假设有3个优先级：100, 80, 60，启用循环重试

- 重试0: 优先级100
- 重试1: 优先级80
- 重试2: 优先级60
- 重试3: 优先级100 (开始新一轮循环)
- 重试4: 优先级80
- 重试5: 优先级60
- ...

### 场景3: 同优先级负载均衡

假设有5个渠道，优先级分布如下：
- 渠道A、B: 优先级100
- 渠道C、D、E: 优先级80

**传统方式**（按固定顺序）:
- 重试0: 总是选择渠道A (优先级100)
- 重试1: 总是选择渠道C (优先级80)

**优化后**（负载均衡）:
- 重试0: 在渠道A、B中随机选择 (优先级100)
- 重试1: 在渠道C、D、E中随机选择 (优先级80)

这样可以避免某个渠道承受过多压力，实现更好的负载分布。

## 配置建议

### 高可用场景
```go
MaxRetryTimes = 15
EnableCyclicRetry = true
RetryAllPriorities = true
```

### 性能优先场景
```go
MaxRetryTimes = 5
EnableCyclicRetry = false
RetryAllPriorities = true
```

### 成本控制场景
```go
MaxRetryTimes = 3
EnableCyclicRetry = false
RetryAllPriorities = false
```

## 监控和日志

系统会记录详细的重试日志，包括：

- 使用的渠道ID
- 重试次数和优先级信息
- 循环轮次（如果启用循环重试）
- 重试路径（渠道ID链）
- 同优先级负载均衡情况

日志示例：
```
重试：[1001->1002->1003->1001]
重试 #3 (第2轮循环, 优先级索引: 0/2)
同优先级渠道随机选择: 1001 -> 1002 (优先级100)
```

## 性能影响

### 内存使用
- 缓存模式下会预先计算所有优先级组合
- 数据库模式下动态查询，内存占用较小
- 随机排序对内存影响很小

### CPU开销
- 模运算和数组操作的开销很小
- Fisher-Yates洗牌算法时间复杂度为O(n)
- 主要性能瓶颈仍在网络请求

### 网络请求
- 重试次数增加可能导致更多网络请求
- 但能提高请求成功率，减少用户重试
- 负载均衡能更好地分散请求压力

## 兼容性说明

1. **向后兼容**: 保持对原有 `RetryTimes` 配置的完全兼容
2. **默认行为**: 新配置的默认值不会改变现有系统的行为
3. **平滑升级**: 现有系统升级后无需修改配置即可正常运行
4. **负载均衡**: 自动启用，无需额外配置

## 故障排除

### 常见问题

1. **重试次数过多**: 检查 `MaxRetryTimes` 配置，建议不超过20
2. **优先级不生效**: 确认渠道的优先级设置正确
3. **循环重试异常**: 检查 `EnableCyclicRetry` 配置
4. **负载不均衡**: 确认同优先级有多个可用渠道

### 调试建议

1. 启用详细日志查看重试路径和负载均衡情况
2. 检查数据库中的 abilities 表数据一致性
3. 使用 `FixAbility()` 函数修复数据不一致问题
4. 监控各渠道的请求分布情况

## 更新日志

- 新增循环重试支持
- 优化优先级选择算法
- 增加重试配置管理
- 提升重试次数上限
- 改进日志记录和监控
- **新增同优先级负载均衡功能**
- 使用Fisher-Yates洗牌算法优化渠道选择