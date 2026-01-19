# DNS Failover for Cloudflare Workers

一个部署在 Cloudflare Workers 上的 DNS 故障自动切换系统，支持健康检查、自动 Failover 和恢复。

## 功能特点

- **API 配置管理**：支持多个 Cloudflare API 配置，自动根据域名匹配，一键测试连接
- **Failover 策略**：灵活配置 DNS 切换策略（A/CNAME/AAAA 记录），支持多域名批量切换
- **URL 健康监控**：自动监控多个 URL，支持状态码和响应内容检查，可自定义超时时间
- **智能切换**：达到失败阈值后自动执行 DNS 切换，防止重复触发
- **自动恢复**：服务恢复正常后可自动切回原配置
- **详细诊断**：错误类型分类、CF-Ray 追踪、响应时间记录
- **切换日志**：完整记录每次切换的时间、原因和详情
- **通知推送**：支持 PushPlus 多渠道通知（微信/APP/浏览器扩展）
- **Web 管理面板**：美观易用的可视化管理界面，带身份认证

## 快速部署

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 KV 命名空间

```bash
npx wrangler kv namespace create "KV"
```

复制返回的 ID，修改 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你的KV命名空间ID"
```

### 4. 配置环境变量（可选）

在 `wrangler.toml` 中配置：

```toml
[vars]
ADMIN_PASSWORD = "你的管理员密码"  # 默认: admin123
TURNSTILE_SITE_KEY = ""           # Cloudflare Turnstile 站点密钥（可选）
TURNSTILE_SECRET_KEY = ""         # Cloudflare Turnstile 秘密密钥（可选）
```

### 5. 部署

```bash
npm run deploy
```

部署成功后访问返回的 URL 即可使用管理面板。

## 使用说明

### 添加 API 配置

1. 进入 **API 配置** 标签页
2. 点击 **添加 API**
3. 填写：
   - 配置名称（如：主站点API）
   - 根域名（如：`example.com`） - 用于自动匹配策略中的域名
   - Zone ID
   - API Token
4. 点击 **测试连接** 验证配置
5. 保存

### 创建 Failover 策略

1. 进入 **Failover 策略** 标签页
2. 点击 **添加策略**
3. 配置：
   - 策略名称
   - 域名列表（每行一个，支持多域名批量操作）
   - 记录类型（A/CNAME/AAAA）
   - 目标内容（IP 或域名）
   - TTL 和代理状态
4. 系统会自动根据每个域名的根域名匹配对应的 API 配置
5. 保存

### 配置健康监控

1. 进入 **监控配置** 标签页
2. 点击 **添加监控**
3. 配置：
   - 监控名称
   - 监控 URL
   - 检查间隔（秒）
   - 超时时间（1-30秒，默认10秒）
   - 预期状态码（支持多个，如 `200,201`）
   - 预期响应内容（可选，支持正则）
   - 连续失败次数阈值
   - 失败时触发的策略
   - 恢复时触发的策略（可选）
4. 保存

### 配置通知渠道

1. 进入 **通知渠道** 标签页
2. 点击 **添加渠道**
3. 填写：
   - 渠道名称
   - API 域名（默认：https://www.pushplus.plus）
   - Token
   - 选择发送渠道（微信/APP/浏览器扩展，可多选）
4. 点击 **测试通知** 验证配置
5. 保存

### 查看状态和日志

- **监控状态**：实时查看各监控点的健康状态，包括：
  - 连续失败次数
  - 最后检查时间
  - 响应状态码和耗时
  - 错误详情（错误类型、CF-Ray、缓存状态等）
- **切换日志**：查看所有自动/手动 DNS 切换记录

## 项目结构

```
├── package.json          # 项目配置
├── wrangler.toml         # Workers 配置
├── README.md             # 说明文档
└── src/
    └── index.js          # 主程序（含 Web UI）
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/configs` | GET/POST | API 配置管理 |
| `/api/configs/:id` | DELETE | 删除 API 配置 |
| `/api/configs/:id/test` | POST | 测试 API 连接 |
| `/api/configs/test` | POST | 测试 API（临时配置） |
| `/api/policies` | GET/POST | Failover 策略管理 |
| `/api/policies/:id` | DELETE | 删除策略 |
| `/api/policies/:id/execute` | POST | 手动执行策略 |
| `/api/monitors` | GET/POST | 监控配置管理 |
| `/api/monitors/:id` | DELETE | 删除监控 |
| `/api/monitors/:id/test` | POST | 测试监控 |
| `/api/channels` | GET/POST | 通知渠道管理 |
| `/api/channels/:id` | DELETE | 删除通知渠道 |
| `/api/channels/:id/test` | POST | 测试通知渠道 |
| `/api/channels/test` | POST | 测试通知（临时配置） |
| `/api/logs` | GET/DELETE | 切换日志 |
| `/api/status` | GET | 监控状态 |
| `/api/check` | POST | 手动触发健康检查 |
| `/auth/login` | POST | 管理员登录 |
| `/auth/logout` | POST | 退出登录 |

## 定时任务

Worker 配置了每分钟执行一次的 Cron 触发器，自动进行健康检查。可在 `wrangler.toml` 中修改：

```toml
[triggers]
crons = ["* * * * *"]  # 每分钟执行
```

## 获取 Cloudflare API 信息

1. **Zone ID**：登录 Cloudflare → 选择域名 → 右侧概述页面底部
2. **API Token**：
   - 访问 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - 创建令牌 → 使用 "Edit zone DNS" 模板
   - 选择要管理的区域
   - 创建并复制令牌

## 常见问题

### 健康检查超时但手动访问正常？

可能原因：
1. **Cloudflare 边缘节点网络抖动**：Workers 从边缘节点发起请求，路由可能与本地不同
2. **目标服务器 WAF/防火墙**：可能阻止了部分 Cloudflare IP
3. **超时设置过短**：尝试增加超时时间到15-20秒

查看 **监控状态** 页面的详细诊断信息，包括错误类型、CF-Ray 等。

### 故障切换重复触发？

已修复：系统会记录 `failoverTriggered` 状态，确保同一监控的故障切换只执行一次，直到服务恢复正常后才重新启用。

### 触发策略显示“未知”？

已修复：调整了数据加载顺序，确保策略数据加载完成后再渲染监控列表。

## License

MIT
