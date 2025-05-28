package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func fixCharsetMain() {
	// 加载环境变量
	err := godotenv.Load(".env")
	if err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}

	// 获取数据库连接字符串
	dsn := os.Getenv("SQL_DSN")
	if dsn == "" {
		log.Fatal("SQL_DSN environment variable is required")
	}

	// 连接数据库
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	fmt.Println("开始修复数据库字符集...")

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
		if hasTable(db, table) {
			if err := fixTableCharset(db, table); err != nil {
				fmt.Printf("修复表 %s 字符集失败: %v\n", table, err)
			} else {
				fmt.Printf("成功修复表 %s 字符集\n", table)
			}
		} else {
			fmt.Printf("表 %s 不存在，跳过\n", table)
		}
	}

	// 修复分片日志表 (logs_00 到 logs_99)
	for i := 0; i < 100; i++ {
		shard := fmt.Sprintf("logs_%02d", i)
		if hasTable(db, shard) {
			if err := fixTableCharset(db, shard); err != nil {
				fmt.Printf("修复分片表 %s 字符集失败: %v\n", shard, err)
			} else {
				fmt.Printf("成功修复分片表 %s 字符集\n", shard)
			}
		}
	}

	fmt.Println("数据库字符集修复完成！")

	// 检查修复结果
	fmt.Println("\n检查修复结果:")
	for _, table := range tables {
		if hasTable(db, table) {
			charset, err := getTableCharset(db, table)
			if err != nil {
				fmt.Printf("检查表 %s 字符集失败: %v\n", table, err)
			} else {
				fmt.Printf("表 %s 字符集: %s\n", table, charset)
			}
		}
	}
}

// hasTable 检查表是否存在
func hasTable(db *gorm.DB, tableName string) bool {
	return db.Migrator().HasTable(tableName)
}

// fixTableCharset 修复单个表的字符集
func fixTableCharset(db *gorm.DB, tableName string) error {
	sql := fmt.Sprintf("ALTER TABLE `%s` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", tableName)
	return db.Exec(sql).Error
}

// getTableCharset 获取表的字符集
func getTableCharset(db *gorm.DB, tableName string) (string, error) {
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
