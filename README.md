# DNS Failover for Cloudflare Workers

一个部署在 Cloudflare Workers 上的 DNS 故障自动切换系统，支持健康检查、自动 Failover 和恢复。

## 功能特点

- **API 配置管理**：支持多个 Cloudflare API 配置，一键测试连接
- **Failover 策略**：灵活配置 DNS 切换策略（A/CNAME/AAAA 记录）
- **URL 健康监控**：自动监控多个 URL，支持状态码和响应内容检查
- **智能切换**：达到失败阈值后自动执行 DNS 切换
- **自动恢复**：服务恢复正常后可自动切回原配置
- **切换日志**：完整记录每次切换的时间、原因和详情
- **Web 管理面板**：美观易用的可视化管理界面

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

### 4. 部署

```bash
npm run deploy
```

部署成功后访问返回的 URL 即可使用管理面板。

## 使用说明

### 添加 API 配置

1. 进入 **API 配置** 标签页
2. 点击 **添加 API**
3. 填写配置名称、Zone ID、API Token
4. 点击 **测试连接** 验证配置
5. 保存

### 创建 Failover 策略

1. 进入 **Failover 策略** 标签页
2. 点击 **添加策略**
3. 配置：
   - 策略名称
   - 完整域名（如 `www.example.com`）
   - 记录类型（A/CNAME/AAAA）
   - 目标内容（IP 或域名）
   - 使用的 API 配置
   - TTL 和代理状态
4. 保存

### 配置健康监控

1. 进入 **监控配置** 标签页
2. 点击 **添加监控**
3. 配置：
   - 监控名称
   - 监控 URL
   - 检查间隔（秒）
   - 超时时间
   - 预期状态码（支持多个，如 `200,201`）
   - 预期响应内容（可选，支持正则）
   - 连续失败次数阈值
   - 失败时触发的策略
   - 恢复时触发的策略（可选）
4. 保存

### 查看状态和日志

- **监控状态**：实时查看各监控点的健康状态
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
| `/api/logs` | GET/DELETE | 切换日志 |
| `/api/status` | GET | 监控状态 |
| `/api/check` | POST | 手动触发健康检查 |

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

## License

MIT
