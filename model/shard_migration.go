package model

import (
	"fmt"
	"one-api/common"

	"gorm.io/gorm"
)

const shardCount = 100

// MigrateShardedLogs 同时兼容 MySQL 和 SQLite 的分表迁移
func MigrateShardedLogs(db *gorm.DB) error {
	// 1. AutoMigrate template 表 logs
	if err := db.AutoMigrate(&Log{}); err != nil {
		return fmt.Errorf("auto migrate template logs: %w", err)
	}

	// 2. 分表建 logs_00…logs_99
	dialect := db.Dialector.Name() // "mysql" 或 "sqlite"
	for i := 0; i < shardCount; i++ {
		shard := fmt.Sprintf("logs_%02d", i)
		if db.Migrator().HasTable(shard) {
			continue
		}

		if dialect == "sqlite" {
			// SQLite 用 SELECT … WHERE 0 快速克隆结构，不带索引
			if err := db.Exec(
				fmt.Sprintf("CREATE TABLE `%s` AS SELECT * FROM `logs` WHERE 0", shard),
			).Error; err != nil {
				return fmt.Errorf("sqlite clone shard %s: %w", shard, err)
			}
		} else {
			// MySQL / 其他方言：用 GORM migrator 建表 + 索引
			if err := db.Table(shard).Migrator().CreateTable(&Log{}); err != nil {
				return fmt.Errorf("create shard %s: %w", shard, err)
			}

			// 如果是MySQL，确保表使用utf8mb4字符集
			if common.UsingMySQL {
				if err := db.Exec(fmt.Sprintf("ALTER TABLE `%s` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", shard)).Error; err != nil {
					return fmt.Errorf("convert shard %s to utf8mb4: %w", shard, err)
				}
			}
		}
	}

	// 3. 建 logs_all 视图（MySQL 支持 OR REPLACE，SQLite 则先 DROP 再 CREATE）
	// 构造 UNION ALL 的主体
	unionSQL := ""
	for i := 0; i < shardCount; i++ {
		unionSQL += fmt.Sprintf("SELECT *, %d AS _shard_id FROM `logs_%02d`", i, i)
		if i < shardCount-1 {
			unionSQL += "\nUNION ALL\n"
		}
	}

	if dialect == "mysql" {
		// MySQL 直接用 OR REPLACE
		if err := db.Exec("CREATE OR REPLACE VIEW `logs_all` AS\n" + unionSQL).Error; err != nil {
			return fmt.Errorf("create or replace view logs_all (mysql): %w", err)
		}
	} else {
		// SQLite 必须先 DROP 再 CREATE
		if err := db.Exec("DROP VIEW IF EXISTS `logs_all`").Error; err != nil {
			return fmt.Errorf("drop view logs_all (sqlite): %w", err)
		}
		if err := db.Exec("CREATE VIEW `logs_all` AS\n" + unionSQL).Error; err != nil {
			return fmt.Errorf("create view logs_all (sqlite): %w", err)
		}
	}

	return nil
}
