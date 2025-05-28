package model

import (
	"fmt"
	"one-api/common"

	"gorm.io/gorm"
)

// FixCharsetForExistingTables 修复现有表的字符集问题
func FixCharsetForExistingTables(db *gorm.DB) error {
	if !common.UsingMySQL {
		return nil // 只有MySQL需要修复字符集
	}

	common.SysLog("开始修复数据库表字符集...")

	// 需要修复的表列表
	tables := []string{
		"logs",
		"users",
		"channels", 
		"tokens",
		"options",
		"abilities",
		"redemptions",
		"topups",
		"quota_data",
		"tasks",
		"midjourneys",
	}

	// 修复主要表
	for _, table := range tables {
		if db.Migrator().HasTable(table) {
			if err := fixTableCharset(db, table); err != nil {
				common.SysError(fmt.Sprintf("修复表 %s 字符集失败: %v", table, err))
				// 继续处理其他表，不中断
			} else {
				common.SysLog(fmt.Sprintf("成功修复表 %s 字符集", table))
			}
		}
	}

	// 修复分片日志表
	for i := 0; i < shardCount; i++ {
		shard := fmt.Sprintf("logs_%02d", i)
		if db.Migrator().HasTable(shard) {
			if err := fixTableCharset(db, shard); err != nil {
				common.SysError(fmt.Sprintf("修复分片表 %s 字符集失败: %v", shard, err))
			} else {
				common.SysLog(fmt.Sprintf("成功修复分片表 %s 字符集", shard))
			}
		}
	}

	common.SysLog("数据库表字符集修复完成")
	return nil
}

// fixTableCharset 修复单个表的字符集
func fixTableCharset(db *gorm.DB, tableName string) error {
	sql := fmt.Sprintf("ALTER TABLE `%s` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", tableName)
	return db.Exec(sql).Error
}

// CheckTableCharset 检查表的字符集
func CheckTableCharset(db *gorm.DB, tableName string) (string, error) {
	if !common.UsingMySQL {
		return "N/A", nil
	}

	var result struct {
		TableCollation string `gorm:"column:TABLE_COLLATION"`
	}

	err := db.Raw(`
		SELECT TABLE_COLLATION 
		FROM information_schema.TABLES 
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
	`, tableName).Scan(&result).Error

	if err != nil {
		return "", err
	}

	return result.TableCollation, nil
} 