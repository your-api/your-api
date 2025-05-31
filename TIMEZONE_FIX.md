# 时区问题修复指南

## 问题描述

如果你发现数据库中的时间都慢了8小时，这是因为数据库使用UTC时间，而应用程序期望使用中国时区（Asia/Shanghai，UTC+8）。

## 解决方案

### 1. 代码修复（已完成）

我已经修改了以下文件来解决时区问题：

- `model/main.go`: 为MySQL和PostgreSQL连接添加了时区参数
- `main.go`: 在应用程序启动时设置默认时区为Asia/Shanghai

### 2. 数据库连接配置

#### MySQL
在你的数据库连接字符串中，系统会自动添加以下参数：
```
parseTime=true&loc=Asia%2FShanghai&charset=utf8mb4
```

示例连接字符串：
```
user:password@tcp(localhost:3306)/database?parseTime=true&loc=Asia%2FShanghai&charset=utf8mb4
```

#### PostgreSQL
在你的数据库连接字符串中，系统会自动添加以下参数：
```
timezone=Asia/Shanghai
```

示例连接字符串：
```
postgres://user:password@localhost:5432/database?timezone=Asia/Shanghai
```

### 3. 修复现有数据（可选）

如果你的数据库中已经有数据，并且时间确实慢了8小时，你可以运行修复脚本：

#### 注意事项
⚠️ **在运行修复脚本之前，请务必备份你的数据库！**

#### 运行修复脚本
```bash
go run fix_timezone.go
```

这个脚本会：
1. 检测你的数据库类型（MySQL或PostgreSQL）
2. 连接到数据库
3. 为所有时间字段添加8小时
4. 只修复明显过时的数据（6小时前的数据），避免重复修复

#### 支持的表和字段
脚本会修复以下表的时间字段：
- order_infos: create_time
- withdraw_histories: create_time, update_time
- check_ins: check_in_date, created_at, updated_at
- users: created_at, updated_at
- logs: created_at
- channels: created_time, test_time
- tokens: created_time, accessed_time
- redemptions: created_time, redeemed_time
- topups: created_time
- tasks: created_at, updated_at
- midjourneys: created_at, updated_at
- logs_00 到 logs_99: created_at (分片日志表)

### 4. 重启应用程序

完成修复后，重启你的应用程序以确保新的时区设置生效：

```bash
# 停止应用程序
# 然后重新启动
./your-api
```

### 5. 验证修复

重启后，新创建的记录应该显示正确的时间。你可以：
1. 创建一个新的订单或签到记录
2. 检查数据库中的时间戳是否正确
3. 在前端界面查看时间显示是否正常

## 环境变量设置

确保你的环境变量正确设置：

```bash
# MySQL示例
SQL_DSN="user:password@tcp(localhost:3306)/database"

# PostgreSQL示例  
SQL_DSN="postgres://user:password@localhost:5432/database"
```

系统会自动为这些连接字符串添加必要的时区参数。

## 故障排除

### 问题1：修复脚本报错
- 确保你的 `.env` 文件中有正确的 `SQL_DSN` 设置
- 确保数据库服务正在运行
- 检查数据库连接权限

### 问题2：时间仍然不正确
- 确保重启了应用程序
- 检查系统时间是否正确
- 确认数据库服务器的时区设置

### 问题3：重复运行修复脚本
修复脚本使用条件判断来避免重复修复，只会修复6小时前的数据。但为了安全起见，不建议多次运行。

## 预防措施

为了避免将来出现时区问题：

1. 始终在部署前检查时区设置
2. 定期备份数据库
3. 在测试环境中验证时区配置
4. 监控应用程序日志中的时区设置信息

## 技术细节

### 修改内容

1. **数据库连接参数**:
   - MySQL: 添加 `loc=Asia%2FShanghai` 参数
   - PostgreSQL: 添加 `timezone=Asia/Shanghai` 参数

2. **应用程序时区**:
   - 在 `main()` 函数中设置 `time.Local = loc`
   - 确保所有 `time.Now()` 调用使用正确的时区

3. **GORM配置**:
   - 确保ORM层正确处理时区转换
   - `autoCreateTime` 和 `autoUpdateTime` 标签使用本地时区

这些修改确保了：
- 新数据使用正确的时区
- 数据库查询和写入一致
- 前端显示时间正确
- API返回正确的时间戳 