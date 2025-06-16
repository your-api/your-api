-- 为users表添加phone字段的数据库迁移脚本
-- 执行前请备份数据库

-- 添加phone字段
ALTER TABLE users ADD COLUMN phone varchar(11) DEFAULT '' COMMENT '手机号';

-- 为phone字段添加索引以提高查询性能
CREATE INDEX idx_users_phone ON users(phone);

-- 验证迁移是否成功
-- SELECT COUNT(*) FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'phone'; 