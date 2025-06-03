# 图片验证码功能说明

## 功能概述

本项目已集成图片验证码功能，在用户获取邮箱验证码之前，需要先通过图片验证码验证。验证码使用Redis存储（如果可用），支持负载均衡环境。

**✨ 最新优化：为了提升用户体验，已降低验证码识别难度，现在使用纯数字验证码，去除了干扰线和大部分噪点。**

## 功能特点

- 🖼️ 基于 steambap/captcha 库生成高质量验证码图片
- 🔢 **优化后只使用数字字符（0-9），避免字母混淆**
- 🎯 **去除干扰曲线，大幅减少噪点，提升识别度**
- 📏 **增大字体缩放，字符更加清晰易读**
- 🗄️ 优先使用Redis存储，回退到内存存储
- ⏱️ 验证码5分钟自动过期
- 🔄  验证失败自动刷新验证码
- 📱 响应式UI设计
- 🌐 支持国际化
- 🛡️ 一次性验证，避免重复消费

## API 端点

### 1. 生成图片验证码 (PNG格式)
```
GET /api/captcha/image
```
返回PNG图片，验证码ID在响应头 `X-Captcha-Id` 中。

### 2. 生成图片验证码 (Base64格式)
```
GET /api/captcha/image/base64
```
返回JSON格式：
```json
{
  "success": true,
  "message": "验证码生成成功",
  "captcha_id": "验证码ID",
  "image": "data:image/png;base64,..."
}
```

### 3. 验证图片验证码（可选，建议在发送邮箱验证码时一起验证）
```
GET /api/captcha/verify?captcha_id=xxx&captcha_code=xxx
```
返回验证结果：
```json
{
  "success": true,
  "message": "验证码验证成功"
}
```

### 4. 发送邮箱验证码（需要图片验证码）
```
GET /api/verification?email=xxx&turnstile=xxx&image_captcha_id=xxx&image_captcha_code=xxx
```
新增参数：
- `image_captcha_id`: 图片验证码ID
- `image_captcha_code`: 用户输入的验证码

**注意：** 建议直接在这个API中验证图片验证码，避免单独调用验证API导致重复消费。

## 前端组件使用

### ImageCaptcha 组件

```jsx
import ImageCaptcha from './components/ImageCaptcha';

<ImageCaptcha
  onVerified={(captchaData) => {
    // 验证码输入完成回调（不是验证成功，只是用户输入完成）
    console.log('验证码ID:', captchaData.captcha_id);
    console.log('验证码内容:', captchaData.captcha_code);
    // 这里可以直接调用发送邮箱验证码的API
  }}
  onError={(error) => {
    // 错误处理
    console.error('验证码错误:', error);
  }}
  style={{ marginTop: 20 }}
/>
```

### 组件参数

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| onVerified | Function | 用户输入完成回调，接收 `{captcha_id, captcha_code}` | - |
| onError | Function | 错误回调，接收错误信息 | - |
| style | Object | 自定义样式 | {} |

## 使用流程

1. **用户点击"获取验证码"**
   - 前端弹出图片验证码模态框
   - 自动加载验证码图片

2. **用户输入图片验证码**
   - 输入4位验证码后自动确认（也可手动点击确认）
   - 前端获取验证码数据但不单独验证

3. **直接发送邮箱验证码**
   - 前端自动调用邮箱验证码发送API
   - 后端在此时验证图片验证码
   - 验证通过后发送邮箱验证码

4. **验证失败处理**
   - 如果图片验证码错误，提示用户重新输入
   - 自动重新打开验证码对话框
   - 避免重复消费已使用的验证码

## Redis存储

### 存储格式
- Key: `image_captcha:{验证码ID}`
- Value: 验证码内容（大写）
- TTL: 5分钟

### 后备机制
如果Redis不可用，系统将自动使用内存存储作为后备方案。

## 安全特性

- ✅ 验证码一次性使用（验证后立即删除）
- ✅ 5分钟自动过期
- ✅ 不区分大小写验证
- ✅ 验证失败自动刷新
- ✅ 支持负载均衡环境（Redis存储）
- ✅ 避免重复消费验证码

## 依赖库

- `github.com/steambap/captcha` - 验证码生成
- `github.com/go-redis/redis/v8` - Redis客户端

## 错误处理

### 常见错误及解决方案

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| 请先完成图片验证码验证 | 缺少验证码参数 | 确保先完成图片验证码验证 |
| 图片验证码错误或已过期 | 验证码错误或超时 | 重新获取验证码 |
| 验证码生成失败 | 系统错误 | 检查服务器状态 |

## 最佳实践

### 避免重复消费
**推荐做法：**
```javascript
// ✅ 推荐：直接在发送邮件时验证
const handleCaptchaInput = (captchaData) => {
  // 直接调用发送邮箱验证码API
  sendEmailVerification(captchaData);
};

// ❌ 不推荐：先验证再发送邮件
const handleCaptchaInput = async (captchaData) => {
  // 第一次消费验证码
  await verifyCaptcha(captchaData);
  // 第二次消费验证码（会失败）
  await sendEmailVerification(captchaData);
};
```

### 错误处理
```javascript
const sendEmailVerification = async (captchaData) => {
  try {
    const response = await API.get(`/api/verification?...`);
    if (!response.data.success) {
      // 如果是验证码错误，重新显示验证码界面
      if (response.data.message.includes('图片验证码')) {
        showCaptchaModal(true);
      }
    }
  } catch (error) {
    // 网络错误也重新验证
    showCaptchaModal(true);
  }
};
```

## 自定义配置

### 验证码参数
在 `controller/captcha.go` 中修改：
```go
const (
    CaptchaWidth  = 150  // 图片宽度
    CaptchaHeight = 50   // 图片高度
    CaptchaLength = 4    // 验证码长度
)

// 验证码生成参数（已优化为简单模式）
options.CurveNumber = 0                    // 干扰曲线数量（0=无曲线）
options.Noise = 0.1                       // 噪点密度（0.1=很少噪点）
options.CharPreset = "0123456789"         // 字符集（纯数字）
options.FontScale = 1.2                   // 字体缩放（1.2=更大更清晰）
```

### 进一步调整难度
如果还想要更简单的验证码，可以继续调整：
```go
// 更简单的设置
options.Noise = 0.05     // 几乎无噪点
options.FontScale = 1.4  // 更大的字体
```

如果需要稍微增加难度：
```go
// 稍微困难的设置
options.CurveNumber = 1      // 添加一条干扰线
options.Noise = 0.3          // 适量噪点
options.CharPreset = "0123456789ABCDEF"  // 包含数字和部分字母
```

### 过期时间
在 `GenerateImageCaptcha` 函数中修改：
```go
common.RedisSet(key, strings.ToUpper(data.Text), 5*time.Minute) // 修改这里的过期时间
```

## 注意事项

1. 确保Redis服务正常运行（推荐）
2. **现在验证码只包含数字0-9，更易识别**
3. 验证码验证不区分大小写
4. 每个验证码只能使用一次
5. ⚠️ **避免重复验证**：不要先调用验证API再调用发送邮件API
6. 验证失败时应重新生成验证码，不要重复使用已消费的验证码
7. **如果发现验证码仍然太难，可以进一步调整 `Noise` 和 `FontScale` 参数**

## 注意事项

1. 确保Redis服务正常运行（推荐）
2. 图片验证码仅支持数字和字母
3. 验证码验证不区分大小写
4. 每个验证码只能使用一次
5. ⚠️ **避免重复验证**：不要先调用验证API再调用发送邮件API
6. 验证失败时应重新生成验证码，不要重复使用已消费的验证码 