# 数据库字符集问题修复指南

## 问题描述

如果您遇到以下错误：
```
[ERR] failed to record log: Error 1366 (HY000): Incorrect string value: '\xE6\xA8\xA1\xE5\x9E\x8B...' for column 'content' at row 1
```

这表示数据库表的字符集不支持中文字符。错误码1366表示字符集不匹配，`\xE6\xA8\xA1\xE5\x9E\x8B`是中文"模型"的UTF-8编码。

## 问题原因

虽然连接字符串中指定了`charset=utf8mb4`，但已存在的数据库表可能是用默认字符集（如latin1或utf8）创建的，不支持完整的UTF-8字符集。

## 解决方案

### 方案1：自动修复（推荐）

重启应用程序，系统会在数据库迁移时自动检测并修复字符集问题。

### 方案2：手动运行修复脚本

1. **使用Go程序修复**：
   ```bash
   go run fix_charset.go
   ```

2. **使用SQL脚本修复**：
   ```bash
   mysql -u root -p yourapi < fix_charset.sql
   ```

### 方案3：手动执行SQL命令

连接到MySQL数据库，执行以下命令：

```sql
-- 修复主要表
ALTER TABLE `logs` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `channels` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `tokens` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 修复分片日志表（根据实际存在的表执行）
ALTER TABLE `logs_00` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `logs_01` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ... 继续到 logs_99
```

## 验证修复结果

执行以下SQL查询检查表的字符集：

```sql
-- 检查所有表的字符集
SELECT TABLE_NAME, TABLE_COLLATION 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'yourapi';

-- 检查特定表的字符集
SHOW TABLE STATUS WHERE Name = 'logs';
```

正确的字符集应该显示为`utf8mb4_unicode_ci`。

## 预防措施

1. **确保数据库连接字符串正确**：
   ```
   SQL_DSN=root:123456@tcp(mysql:3306)/yourapi?charset=utf8mb4&parseTime=True&loc=Local
   ```

2. **设置数据库默认字符集**：
   ```sql
   ALTER DATABASE yourapi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **MySQL配置文件设置**（可选）：
   在`my.cnf`中添加：
   ```ini
   [mysql]
   default-character-set=utf8mb4
   
   [mysqld]
   character-set-server=utf8mb4
   collation-server=utf8mb4_unicode_ci
   ```

## 注意事项

- 修复过程可能需要一些时间，特别是对于大表
- 建议在修复前备份数据库
- 如果使用SQLite，不需要进行字符集修复
- 修复完成后，新创建的表将自动使用正确的字符集

## 故障排除

如果修复后仍然出现问题：

1. 检查MySQL版本是否支持utf8mb4（MySQL 5.5.3+）
2. 确认连接字符串中包含`charset=utf8mb4`
3. 重启应用程序以确保新的字符集设置生效
4. 检查是否有其他表需要修复

如果问题持续存在，请查看应用程序日志获取更多详细信息。 