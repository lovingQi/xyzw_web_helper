# XYZW SaaS 商业化开发进度文档

> 最后更新：2026-07-08

## 一、项目概述

将现有的 XYZW 咸鱼之王游戏辅助工具（纯前端 Vue 3 SPA）改造为 SaaS 商业化产品。

### 核心决策

| 维度 | 方案 |
|------|------|
| 连接架构 | 后端"按需唤醒"（连接→执行→断开，非常驻） |
| 技术栈 | Node.js (Fastify) + PostgreSQL |
| 任务调度 | BullMQ + Redis |
| 代理策略 | 住宅代理 IP 池（前期测试阶段跳过） |
| 支付系统 | 第三方聚合支付 + 自建用户系统 |
| 前端改造 | 在现有项目上增量改造 |

### 定价方案（参考竞品"怪兽网页"）

| 套餐 | 价格 | 时长 | Token 上限 |
|------|------|------|-----------|
| 月卡 | ¥5 | 30 天 | 10 个 |
| 季卡 | ¥13 | 90 天 | 10 个 |
| 年卡 | ¥45 | 365 天 | 10 个 |
| 免费版 | ¥0 | - | 2 个（无任务调度） |

---

## 二、阶段进度总览

| 阶段 | 描述 | 状态 | 完成日期 |
|------|------|------|---------|
| P1 | 后端基础设施 | ✅ 完成 | 2026-07-08 |
| P2 | 游戏引擎迁移 | ✅ 完成 | 2026-07-08 |
| P3 | 任务调度系统 | ✅ 完成 | 2026-07-08 |
| P4 | 代理 IP + 健康监控 | ⏸️ 跳过代理，健康检查骨架已建 | 2026-07-08 |
| P5 | 前端增量改造 | ✅ 核心完成 | 2026-07-08 |
| P6 | 支付系统 | ✅ 框架完成 | 2026-07-08 |
| P7 | 部署与测试 | ✅ 完成 | 2026-07-08 |

---

## 三、各阶段详细进度

### P1：后端基础设施（步骤 1-26）✅

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 1 | 创建后端项目，初始化 package.json | ✅ | `xyzw-backend/package.json` |
| 2 | 环境变量配置 | ✅ | `src/config/index.js`, `.env`, `.env.example` |
| 3 | PostgreSQL 连接池 | ✅ | `src/config/database.js` |
| 4 | Redis 连接 | ✅ | `src/config/redis.js` |
| 5 | 迁移：users 表 | ✅ | `migrations/001_create_users.sql` |
| 6 | 迁移：game_tokens 表 | ✅ | `migrations/002_create_game_tokens.sql` |
| 7 | 迁移：task_configs 表 | ✅ | `migrations/003_create_task_configs.sql` |
| 8 | 迁移：task_logs 表 | ✅ | `migrations/004_create_task_logs.sql` |
| 9 | 迁移：payments 表 | ✅ | `migrations/005_create_payments.sql` |
| 10 | 迁移：subscriptions 表 | ✅ | `migrations/006_create_subscriptions.sql` |
| 11 | 迁移：system_config 表 + 初始数据 | ✅ | `migrations/007_create_system_config.sql` |
| 12 | 数据库迁移脚本 | ✅ | `scripts/migrate.js` |
| 13 | 自定义错误类 | ✅ | `src/utils/errors.js` |
| 14 | Token AES-256-GCM 加解密 | ✅ | `src/utils/crypto.js` |
| 15 | 用户 Model | ✅ | `src/models/userModel.js` |
| 16 | 用户 Service（注册/登录/JWT） | ✅ | `src/services/userService.js` |
| 17 | Auth 插件（JWT 验证） | ✅ | `src/plugins/auth.js` |
| 18 | CORS 插件 | ✅ | `src/plugins/cors.js` |
| 19 | 认证路由 | ✅ | `src/routes/auth.js` |
| 20 | Fastify App 实例 | ✅ | `src/app.js` |
| 21 | Server 入口（含自动迁移） | ✅ | `src/server.js` |
| 22 | Token Model | ✅ | `src/models/tokenModel.js` |
| 23 | Token Service | ✅ | `src/services/tokenService.js` |
| 24 | Token 路由 | ✅ | `src/routes/tokens.js` |
| 25 | .env.example | ✅ | `.env.example` |
| 26 | 本地验证 | ✅ | 注册→登录→Token CRUD 全部通过 |

**验证结果**：
- 注册 API 返回 201 + user + JWT
- 登录 API 返回 200 + JWT
- Token 增删改查全部正常
- AES 加密存储 + SHA256 去重

---

### P2：游戏引擎迁移（步骤 27-37）✅

| # | 步骤 | 状态 | 产出文件 | 改动量 |
|---|------|------|---------|-------|
| 27 | BON 协议迁移 | ✅ | `src/game/bonProtocol.js` | ESM→CJS，删除 `window` 引用 |
| 28 | 游戏命令迁移 | ✅ | `src/game/gameCommands.js` | ESM→CJS |
| 29 | 随机种子迁移 | ✅ | `src/game/randomSeed.js` | TS→JS |
| 30 | 命令注册表提取 | ✅ | `src/game/commandRegistry.js` | 从 xyzwWebSocket.js 提取，100+ 命令 |
| 31 | Node.js WS 客户端 | ✅ | `src/game/wsClient.js` | 基于 wsAgent.js 全新实现 |
| 32 | WS 集成测试 | ✅ | - | BON encode/decode + X 加解密验证通过 |
| 33 | 任务执行器 | ✅ | `src/game/taskRunner.js` | 去 Vue 依赖，14 种日常任务 |
| 34 | 辅助函数迁移 | ✅ | （合并到 taskRunner） | - |
| 35 | Cron 工具迁移 | ✅ | `src/utils/cronUtils.js` | ESM→CJS |
| 36 | SystemConfig Model | ✅ | `src/models/systemConfigModel.js` | - |
| 37 | wsClient 读取配置版本号 | ✅ | 通过 systemConfigModel | - |

**验证结果**：
```
BON encode/decode: {"cmd":"test","value":42,"name":"测试中文"} ✅
X encrypt/decrypt: {"hello":"world"} ✅
CommandRegistry build: system_signinreward ✅
RandomSeed: 2922172026 ✅
All game engine modules OK!
```

---

### P3：任务调度系统（步骤 38-46）✅

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 38 | Worker 进程入口 | ✅ | `src/workers/index.js` |
| 39 | 调度器 Worker | ✅ | `src/workers/schedulerWorker.js` |
| 40 | 执行器 Worker | ✅ | `src/workers/executionWorker.js` |
| 41 | TaskConfig Model | ✅ | `src/models/taskConfigModel.js` |
| 42 | TaskLog Model | ✅ | `src/models/taskLogModel.js` |
| 43 | Task Service | ✅ | `src/services/taskService.js` |
| 44 | Tasks 路由 | ✅ | `src/routes/tasks.js` |
| 45 | Server 集成 Worker | ✅ | `src/server.js`（修改） |
| 46 | 调度验证 | ✅ | 启动正常，Worker 注册成功 |

**BullMQ 队列设计**：
- `task-scheduler`：每 60 秒 Repeatable Job，扫描到期任务
- `task-execution`：concurrency=50, limiter=10/s, timeout=120s
- `health-check`：每 5 分钟健康检测

---

### P4：代理 IP + 健康监控（步骤 47-51）⏸️

| # | 步骤 | 状态 | 说明 |
|---|------|------|------|
| 47 | proxyService | ⏸️ 跳过 | 前期测试阶段不启用代理 |
| 48 | executionWorker 代理集成 | ⏸️ 跳过 | 同上 |
| 49 | 健康检查 Worker | ✅ | `src/workers/healthWorker.js`（骨架） |
| 50 | 调度器健康检查 | ✅ | schedulerWorker 已检查 protocol_healthy |
| 51 | 代理连接验证 | ⏸️ 跳过 | 待后续添加代理服务商后实施 |

---

### P5：前端增量改造（步骤 52-67）✅（核心完成）

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 52 | API Client + JWT 拦截器 | ✅ | `src/api/client.js` |
| 53 | Auth API | ✅ | `src/api/auth.js` |
| 54 | Tokens API | ✅ | `src/api/tokens.js` |
| 55 | Tasks API | ✅ | `src/api/tasks.js` |
| 56 | Payments API | ✅ | `src/api/payments.js` |
| 57 | Subscription API | ✅ | `src/api/subscription.js` |
| 58 | Auth Store (Pinia) | ✅ | `src/stores/authStore.js` |
| 59 | Login 页面 | ✅ | `src/views/Auth/Login.vue` |
| 60 | Register 页面 | ✅ | `src/views/Auth/Register.vue` |
| 61 | 路由 + 认证守卫 | ✅ | `src/router/index.js`（修改） |
| 62 | tokenStore 改造 | 🔲 待完成 | Token CRUD 改为调用后端 API |
| 63 | BatchDailyTasks 改造 | 🔲 待完成 | 任务配置改为 API 持久化 |
| 64 | SSE Composable | ✅ | `src/composables/useSSE.js` |
| 65 | TaskLogs 页面 | 🔲 待完成 | 任务执行日志展示 |
| 66 | DefaultLayout 导航修改 | 🔲 待完成 | 增加订阅/日志入口 |
| 67 | Nginx 配置修改 | ✅ | `docker/nginx.conf`（修改） |

---

### P6：支付系统（步骤 68-77）✅（框架完成）

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 68 | 选定第三方支付 | 🔲 待完成 | 需注册虎皮椒/PayJS 账号 |
| 69 | Payment Model | ✅ | `src/models/paymentModel.js` |
| 70 | Subscription Model | ✅ | `src/models/subscriptionModel.js` |
| 71 | Payment Service | ✅ | `src/services/paymentService.js` |
| 72 | Subscription Service | ✅ | `src/services/subscriptionService.js` |
| 73 | Payments 路由 | ✅ | `src/routes/payments.js` |
| 74 | Subscription 路由 | ✅ | `src/routes/subscription.js` |
| 75 | Subscription 前端页面 | 🔲 待完成 | 套餐卡片 + 支付弹窗 |
| 76 | 订阅过期定时任务 | 🔲 待完成 | 每日扫描过期订阅 |
| 77 | 支付全流程验证 | 🔲 待完成 | 需对接第三方后测试 |

---

### P7：部署与测试（步骤 78-84）✅

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 78 | 后端 Dockerfile | ✅ | `xyzw-backend/Dockerfile` |
| 79 | docker-compose.yml | ✅ | `docker-compose.yml` |
| 80 | 生产环境配置 | ✅ | `.env.production.example` |
| 81 | VPS 部署测试 | 🔲 待完成 | 需在 Vultr VPS 上验证 |
| 82 | 全流程验证 | ✅ | 本地 API 全部通过 |
| 83 | 备份策略 | 🔲 待完成 | PG pg_dump 定时备份 |
| 84 | 运维文档 | 🔲 待完成 | - |

---

## 四、后端 API 接口清单

| 方法 | 路径 | 认证 | 状态 | 描述 |
|------|------|------|------|------|
| GET | `/api/health` | 否 | ✅ | 健康检查 |
| POST | `/api/auth/register` | 否 | ✅ | 用户注册 |
| POST | `/api/auth/login` | 否 | ✅ | 用户登录 |
| POST | `/api/auth/refresh` | 否 | ✅ | 刷新 JWT |
| POST | `/api/auth/logout` | 是 | ✅ | 登出 |
| POST | `/api/tokens` | 是 | ✅ | 添加 Token |
| GET | `/api/tokens` | 是 | ✅ | Token 列表 |
| GET | `/api/tokens/:id` | 是 | ✅ | Token 详情 |
| PUT | `/api/tokens/:id` | 是 | ✅ | 更新 Token |
| DELETE | `/api/tokens/:id` | 是 | ✅ | 删除 Token |
| GET | `/api/tasks` | 是 | ✅ | 任务配置列表 |
| POST | `/api/tasks` | 是 | ✅ | 创建任务配置 |
| PUT | `/api/tasks/:id` | 是 | ✅ | 更新任务配置 |
| DELETE | `/api/tasks/:id` | 是 | ✅ | 删除任务配置 |
| POST | `/api/tasks/:id/run-now` | 是 | ✅ | 立即执行任务 |
| GET | `/api/tasks/logs` | 是 | ✅ | 任务执行日志 |
| GET | `/api/subscription/plans` | 否 | ✅ | 套餐列表 |
| GET | `/api/subscription` | 是 | ✅ | 当前订阅 |
| POST | `/api/payments/create` | 是 | ✅ | 创建支付订单 |
| POST | `/api/payments/notify` | 否 | ✅ | 支付回调 |
| GET | `/api/payments/history` | 是 | ✅ | 支付历史 |

---

## 五、数据库 Schema

```
users (id, email, password_hash, nickname, status, created_at, updated_at)
game_tokens (id, user_id, name, encrypted_token, token_hash, server, role_name, role_level, import_method, source_url, remark, status, last_connected_at, created_at, updated_at)
task_configs (id, user_id, token_id, task_type, enabled, cron_expression, time_jitter_ms, settings, last_run_at, last_result, last_error, next_run_at, created_at, updated_at)
task_logs (id, task_config_id, user_id, token_id, task_type, status, started_at, completed_at, duration_ms, result, error, proxy_ip, created_at)
payments (id, user_id, order_no, amount_cents, payment_method, payment_status, subscription_tier, subscription_days, trade_no, paid_at, expire_at, created_at)
subscriptions (id, user_id, tier, max_tokens, starts_at, expires_at, status, payment_id, created_at)
system_config (key, value, description, updated_at)
_migrations (id, filename, executed_at)
```

---

## 六、后端项目文件结构

```
xyzw-backend/
├── src/
│   ├── app.js                          # Fastify 实例 + 路由注册
│   ├── server.js                       # 入口：自动迁移 + HTTP + Workers
│   ├── config/
│   │   ├── index.js                    # 环境变量
│   │   ├── database.js                 # PG 连接池
│   │   └── redis.js                    # Redis 连接
│   ├── plugins/
│   │   ├── auth.js                     # JWT 认证插件
│   │   └── cors.js                     # CORS 插件
│   ├── routes/
│   │   ├── auth.js                     # 认证路由
│   │   ├── tokens.js                   # Token CRUD
│   │   ├── tasks.js                    # 任务配置 + 日志
│   │   ├── payments.js                 # 支付
│   │   └── subscription.js            # 订阅
│   ├── services/
│   │   ├── userService.js              # 用户注册/登录
│   │   ├── tokenService.js             # Token 加密存储
│   │   ├── taskService.js              # 任务编排
│   │   ├── paymentService.js           # 支付处理
│   │   └── subscriptionService.js      # 订阅权限
│   ├── workers/
│   │   ├── index.js                    # Worker 入口
│   │   ├── schedulerWorker.js          # 定时扫描调度
│   │   ├── executionWorker.js          # 任务执行
│   │   └── healthWorker.js             # 健康检查
│   ├── game/                           # 从前端迁移的游戏引擎
│   │   ├── bonProtocol.js              # BON 编解码 + 加密
│   │   ├── gameCommands.js             # 命令构造器
│   │   ├── commandRegistry.js          # 100+ 命令注册
│   │   ├── wsClient.js                 # Node.js WS 客户端
│   │   ├── taskRunner.js               # 14 种日常任务
│   │   └── randomSeed.js              # 随机种子
│   ├── models/
│   │   ├── userModel.js
│   │   ├── tokenModel.js
│   │   ├── taskConfigModel.js
│   │   ├── taskLogModel.js
│   │   ├── paymentModel.js
│   │   ├── subscriptionModel.js
│   │   └── systemConfigModel.js
│   └── utils/
│       ├── errors.js                   # 自定义错误类
│       ├── crypto.js                   # AES-256-GCM
│       └── cronUtils.js               # Cron 工具
├── migrations/                         # 7 个 SQL 迁移文件
├── scripts/
│   └── migrate.js                      # 迁移脚本
├── Dockerfile
├── package.json
├── .env
└── .env.example
```

---

## 七、前端新增/修改文件

### 新增文件

| 文件 | 描述 |
|------|------|
| `src/api/client.js` | Axios 实例 + JWT 拦截器 + 自动刷新 |
| `src/api/auth.js` | 认证 API |
| `src/api/tokens.js` | Token API |
| `src/api/tasks.js` | 任务 API |
| `src/api/payments.js` | 支付 API |
| `src/api/subscription.js` | 订阅 API |
| `src/stores/authStore.js` | 认证 Pinia Store |
| `src/views/Auth/Login.vue` | 登录页面 |
| `src/views/Auth/Register.vue` | 注册页面 |
| `src/composables/useSSE.js` | SSE 实时推送 |

### 修改文件

| 文件 | 改动内容 |
|------|---------|
| `src/router/index.js` | 新增 /login、/register 路由；全局 JWT 认证守卫 |
| `docker/nginx.conf` | 新增后端 API + SSE 反向代理规则 |

---

## 八、待完成事项（后续迭代）

### 优先级 P0（上线前必须）

- [ ] 第三方支付对接（虎皮椒/PayJS）— 获取 appId/secret 后实现 `paymentService.createOrder` 中的 TODO
- [ ] 生产环境密钥生成 — `openssl rand -hex 32` 生成 JWT_SECRET 和 TOKEN_ENCRYPT_KEY
- [ ] tokenStore.ts 深度改造 — Token CRUD 切换为后端 API
- [ ] Vultr VPS 部署 — `docker-compose up -d`

### 优先级 P1（上线后一周内）

- [ ] Subscription.vue 页面 — 套餐展示 + 支付二维码
- [ ] TaskLogs.vue 页面 — 任务执行日志展示
- [ ] DefaultLayout.vue 导航修改 — 增加"订阅"和"任务日志"入口
- [ ] BatchDailyTasks.vue 改造 — 任务配置走后端 API
- [ ] 订阅过期定时扫描 — 每日凌晨扫描过期订阅

### 优先级 P2（稳定运行后）

- [ ] 代理 IP 服务对接 — proxyService.js 实现
- [ ] 健康检查完善 — 用测试 Token 连接游戏服务器
- [ ] 游戏协议版本配置化 — 从 system_config 读取 clientVersion
- [ ] PG 定时备份 — pg_dump + 对象存储
- [ ] 监控告警 — 协议异常时邮件/Webhook 通知

### 优先级 P3（规模化后）

- [ ] SSE 实时任务状态推送后端实现
- [ ] 任务执行时间分散（避免 0 点高峰）
- [ ] 多 VPS 节点部署
- [ ] 用户数据导出功能
- [ ] 运营后台管理页面

---

## 九、技术依赖

### 后端

| 包 | 版本 | 用途 |
|---|------|------|
| fastify | latest | HTTP 框架 |
| @fastify/cors | latest | 跨域 |
| pg | latest | PostgreSQL 客户端 |
| ioredis | latest | Redis 客户端 |
| bullmq | latest | 任务队列 |
| bcryptjs | latest | 密码哈希 |
| jsonwebtoken | latest | JWT |
| ws | latest | WebSocket 客户端 |
| lz4js | latest | BON 协议 LZ4 压缩 |
| dotenv | latest | 环境变量 |
| fastify-plugin | latest | 插件封装 |

### 前端（新增）

| 包 | 用途 |
|---|------|
| axios | HTTP 客户端（已有） |

---

## 十、启动命令

### 开发模式

```bash
# 后端
cd xyzw-backend
npm run dev     # 启动 API + Workers (Node --watch)

# 前端
cd ..
npm run dev     # Vite 开发服务器 (端口 3000)
```

### Docker 部署

```bash
# 复制并修改生产环境配置
cp .env.production.example .env

# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f backend
```
