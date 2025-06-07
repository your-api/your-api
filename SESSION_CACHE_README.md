# Redis Session 缓存优化

## 功能说明

本次优化为登录态管理引入了Redis缓存机制，主要目的是支持负载均衡场景下的session共享，并实现用户登录态永不过期。

## 优化特性

### 1. 双层缓存机制
- **内存session**: 优先使用内存中的session数据（快速响应）
- **Redis缓存**: 当内存中找不到session时，自动从Redis中查找并恢复到内存

### 2. 自动恢复机制
- 当用户请求到达不同的服务实例时，系统会自动从Redis缓存中恢复用户的登录态
- 恢复后的session会重新保存到当前实例的内存中，提高后续请求的响应速度

### 3. 缓存同步
- 用户登录时，session信息会同时保存到内存和Redis
- 用户注销时，会同时清理内存和Redis中的session数据

### 4. 永不过期配置
- Redis中的session缓存设置为永不过期，保持用户登录态持久化
- Cookie session也设置为永不过期（MaxAge=0）
- 每次访问时会确认并刷新Redis缓存的数据完整性
- 用户登录一次后，除非主动注销，否则登录态永久有效

## 技术实现

### 核心文件
- `model/session_cache.go`: Redis session缓存管理模块
- `middleware/auth.go`: 认证中间件，支持从Redis恢复session
- `controller/user.go`: 登录/注销控制器，支持session同步

### 主要函数
- `SetSessionCache()`: 设置session到Redis缓存（永不过期）
- `GetSessionCache()`: 从Redis缓存获取session
- `DeleteSessionCache()`: 删除Redis缓存中的session
- `SyncSessionToRedis()`: 将内存session同步到Redis
- `GetSessionCacheFromContext()`: 从当前请求上下文恢复Redis session

### Session恢复流程
1. 用户请求到达认证中间件
2. 检查内存session是否存在用户信息
3. 如果内存session为空，尝试从Redis恢复
4. 恢复成功后，将session数据写入内存session
5. 继续正常的认证流程

## 部署配置

### Redis配置
确保环境变量中正确配置了Redis连接：
```bash
REDIS_CONN_STRING=redis://localhost:6379/0
```

### 负载均衡支持
- 当`REDIS_CONN_STRING`配置正确时，自动启用Redis session缓存
- 支持多个应用实例共享同一个Redis，实现session跨实例访问
- 无需额外配置，系统会自动检测Redis可用性

## 兼容性

### 向后兼容
- 如果Redis未配置或不可用，系统仍使用原有的内存session机制
- 现有的登录流程不受影响，用户无感知升级

### OAuth登录支持
所有OAuth登录方式均自动支持Redis session缓存：
- GitHub登录
- 微信登录  
- Telegram登录
- OIDC登录
- LinuxDO登录
- 普通密码登录

## 性能优化

### 访问优先级
1. 首先检查内存session（最快）
2. 内存未找到时查询Redis缓存
3. Redis恢复session到内存后，后续请求直接使用内存数据

### 缓存策略
- 登录时：同时写入内存和Redis（永不过期）
- 访问时：优先读取内存，必要时从Redis恢复
- 注销时：同时清理内存和Redis

## 负载均衡场景示例

### 场景1: 用户在实例A登录
1. 用户在实例A登录成功
2. session保存到实例A的内存和Redis缓存（永不过期）

### 场景2: 用户请求路由到实例B
1. 实例B内存中没有该用户的session
2. 实例B自动从Redis缓存中获取session数据
3. 将session恢复到实例B的内存中
4. 用户正常访问，无需重新登录

### 场景3: 用户注销
1. 无论在哪个实例注销，都会清理Redis缓存
2. 其他实例在下次访问时发现Redis中无session，要求用户重新登录

## 监控和日志

系统会记录以下关键操作的日志：
- Redis session缓存的设置和获取
- session从Redis恢复到内存的过程
- 缓存操作失败的错误信息

通过这些日志可以监控session缓存的使用情况和健康状态。

## 永不过期的好处

1. **用户体验提升**: 用户无需频繁重新登录
2. **适合长期运行的服务**: API服务可以保持长期稳定的认证状态
3. **减少认证开销**: 减少了重复认证的性能开销
4. **支持移动应用**: 移动应用可以保持长期登录状态

## 安全考虑

虽然session永不过期提升了用户体验，但也需要注意：
1. 用户应该在不使用时主动注销
2. 管理员可以通过后台禁用用户账号来强制下线
3. 建议定期清理僵尸session（可通过Redis管理工具）
4. 重要操作仍应进行二次验证