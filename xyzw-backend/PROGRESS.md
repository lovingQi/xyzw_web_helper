# XYZW SaaS 商业化开发进度文档

> 最后更新：2026-07-11

## 一、项目概述

将现有的 XYZW 咸鱼之王游戏辅助工具（纯前端 Vue 3 SPA）改造为 SaaS 商业化产品。

### 核心决策

| 维度 | 方案 |
|------|------|
| 连接架构 | 后端"按需唤醒"（连接→执行→断开，非常驻） |
| 技术栈 | Node.js (Fastify) + PostgreSQL |
| 任务调度 | BullMQ + Redis |
| 代理策略 | 当前支持系统 HTTP/HTTPS 代理；住宅代理 IP 池待接入 |
| 支付系统 | 第三方聚合支付 + 自建用户系统 |
| 前端改造 | 在现有项目上增量改造 |

### 定价方案

| 套餐 | 价格 | 时长 | Token 上限 |
|------|------|------|-----------|
| 试用版 | ¥0 | 7 天 | 1 个（管理员手动开通） |
| 月卡 | ¥5 起 | 30 天 | 1-50 个，基础含 1 个 |
| 季卡 | 月价 × 3 × 0.9 后取整 | 90 天 | 1-50 个，基础含 1 个 |
| 年卡 | 月价 × 12 × 0.8 后取整 | 365 天 | 1-50 个，基础含 1 个 |

额外 Token：第 1-2 个额外 Token 为 ¥2/个/月，第 3 个额外 Token 起为 ¥1/个/月。

---

## 二、阶段进度总览

| 阶段 | 描述 | 状态 | 完成日期 |
|------|------|------|---------|
| P1 | 后端基础设施 | ✅ 完成 | 2026-07-08 |
| P2 | 游戏引擎迁移 | ✅ 完成 | 2026-07-08 |
| P3 | 任务调度系统 | ✅ 核心完成，真实 Token Worker 日志已验证 | 2026-07-11 |
| P4 | 代理 IP + 健康监控 | 🟡 系统代理支持已完成，住宅代理池未接入 | 2026-07-11 |
| P5 | 前端增量改造 | 🟡 SaaS 核心页面完成，批量任务后端化待完成 | 2026-07-11 |
| P6 | 支付系统 | 🟡 框架 + 模拟回调完成，第三方支付待接入 | 2026-07-11 |
| P7 | 部署与测试 | 🟡 本地验证通过，VPS/生产验证待完成 | 2026-07-11 |

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
| 46.1 | Worker 任务类型分发 | ✅ | `executionWorker.js` 调用 `runner.runTaskType(taskType)` |
| 46.2 | 执行日志增强 | ✅ | `task_logs.result` 写入 taskType、tasksRun、tasksFailed、runner logs |
| 46.3 | next_run_at 调度修复 | ✅ | 创建任务和 scheduler 续算均传入 cron runType |
| 46.4 | timeJitterMs=0 支持 | ✅ | 定时验证可关闭随机抖动 |

**BullMQ 队列设计**：
- `task-scheduler`：每 60 秒 Repeatable Job，扫描到期任务
- `task-execution`：concurrency=50, limiter=10/s, timeout=120s
- `health-check`：每 5 分钟健康检测

**2026-07-11 真实 Token 验证结果**：
- 当前账号真实微信扫码 Token 已同步到后端 `game_tokens`，后端可查到 2 个 active Token。
- `task_id=15` 已验证完整定时闭环：scheduler 在 2026-07-11 10:19:00 自动入队，Worker 登录真实游戏角色 `kidult`，执行 `mail_claimallattachment` 成功，`task_logs.id=14` 状态为 `success`，`next_run_at` 推进到次日。
- `task_id=16` 再次验证完整定时闭环：scheduler 在 2026-07-11 11:04:00 自动入队，Worker 登录真实游戏角色 `kidult`，执行 `mail_claimallattachment` 成功，`task_logs.id=15` 状态为 `success`，耗时约 6.4 秒。
- `mail` 任务已验证可定时完成：成功获取角色信息、筛选 `mail` 类型、领取邮件附件，结果为 `tasksRun=1`、`tasksFailed=0`。
- `daily_signin` 任务可创建、可 `run-now`、Worker 可消费并写入 `task_logs`；修复失败状态传播后，命令超时会正确记录为 `failed`。
- Worker 已修复任务类型分发：`daily_signin` 只执行签到相关动作，不再误跑竞技场、Boss、邮件、瓶子等整套日常。
- Worker 已补齐前端同款响应映射（含 `syncrewardresp`）和协议诊断日志，失败日志会记录最近发送/收到的游戏 cmd。
- `legion_signin` 已复测：`task_logs.id=24` 成功登录并判定当前角色未加入军团，记录为成功跳过。
- 真实角色状态深挖：当前角色 `dailyTask.complete` 只有 `{ "1": 30 }`，`bottleHelpers.helperStopTime=0`，没有 `gacha`/`signin` 相关 `statisticsTime` 字段，`legionId=0`。
- 状态探针结果：`activity_get`、`discount_getdiscountinfo`、`mail_getlist`、`store_goodslist` 有正常响应；`collection_goodslist`、`legion_getinfo`、`car_getrolecar`、`mergebox_getinfo` 等在当前角色状态下无业务响应。
- `bottle` 已修复为状态跳过：`task_logs.id=26` 成功登录并判定未发现运行中的盐罐机器人，记录为成功跳过。
- 当前仍需深挖的真实命令：`daily_signin` 的 `system_signinreward`（`task_logs.id=25`）与 `gacha_drawreward`（`task_logs.id=27`）均能登录并执行到命令发送阶段，但未收到业务响应；抓包日志显示命令发出后只收到 `system_newchatmessagenotify` 等非目标响应。

---

### P4：代理 IP + 健康监控（步骤 47-51）🟡

| # | 步骤 | 状态 | 说明 |
|---|------|------|------|
| 47 | proxyService | 🔲 待完成 | 住宅代理服务商/API 池尚未接入 |
| 48 | executionWorker 代理集成 | ✅ | 已支持 `HTTP_PROXY/HTTPS_PROXY` + `NO_PROXY` |
| 49 | 健康检查 Worker | ✅ | `src/workers/healthWorker.js`（骨架） |
| 50 | 调度器健康检查 | ✅ | schedulerWorker 已检查 protocol_healthy |
| 51 | 代理连接验证 | ✅ | 系统代理握手游戏 WebSocket 约 200ms 成功 |

**说明**：
- 后端 `GameWsClient` 已使用 `https-proxy-agent`，外部 `wss://` 游戏连接会自动读取系统代理环境变量。
- 当前已解决本地直连游戏 WebSocket 超时问题。
- 尚未实现按用户/Token 分配住宅代理 IP、代理池健康检查和失败切换策略。

---

### P5：前端增量改造（步骤 52-67）🟡（SaaS 核心完成）

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
| 62 | tokenStore 改造 | 🟡 部分完成 | 本地 Token 已可自动同步到后端；CRUD 全后端化待重构 |
| 63 | BatchDailyTasks 改造 | 🔲 待完成 | 任务配置改为 API 持久化 |
| 64 | SSE Composable | ✅ | `src/composables/useSSE.js` |
| 65 | TaskLogs 页面 | ✅ | `src/views/TaskLogs.vue`，摘要、筛选、状态、耗时、失败原因、步骤时间线 |
| 66 | DefaultLayout 导航修改 | ✅ | 已增加订阅入口和任务日志入口 |
| 67 | Nginx 配置修改 | ✅ | `docker/nginx.conf`（修改） |

**2026-07-11 新增前端验证**：
- 登录/注册页深色主题可读性已修复。
- `/tokens` 页面显示当前 SaaS 账号、套餐等级、Token 用量上限。
- `/subscription` 页面已上线，可展示当前套餐与套餐卡片。
- `/admin/task-logs` 页面已上线，可查看后端登录时间、任务类型、执行状态、耗时、失败原因和详细步骤时间线。
- `/tokens` 页面已增加“任务日志”快捷入口。
- 微信扫码导入 Token 已恢复可用；导入后的本地 Token 会自动同步到后端 `/api/tokens`。

---

### P6：支付系统（步骤 68-77）🟡（框架完成）

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 68 | 选定第三方支付 | 🔲 待完成 | 需注册虎皮椒/PayJS 账号 |
| 69 | Payment Model | ✅ | `src/models/paymentModel.js` |
| 70 | Subscription Model | ✅ | `src/models/subscriptionModel.js` |
| 71 | Payment Service | ✅ | `src/services/paymentService.js` |
| 72 | Subscription Service | ✅ | `src/services/subscriptionService.js` |
| 73 | Payments 路由 | ✅ | `src/routes/payments.js` |
| 74 | Subscription 路由 | ✅ | `src/routes/subscription.js` |
| 75 | Subscription 前端页面 | ✅ | `src/views/Subscription.vue`，套餐卡片 + 订单弹窗 |
| 76 | 订阅过期定时任务 | 🟡 部分完成 | `subscriptionService.expireOverdueSubscriptions()` 已有，定时触发待补 |
| 77 | 支付全流程验证 | 🟡 模拟通过 | 本地创建订单 + notify 模拟回调 + 订阅升级已验证；第三方待接 |

**说明**：
- 当前支付仍是“模拟回调/管理员激活”框架，未接真实第三方支付二维码。
- 已验证模拟月卡支付后，套餐升级为 `basic`，Token 上限变为 10，任务调度权限开启。

---

### P7：部署与测试（步骤 78-84）🟡

| # | 步骤 | 状态 | 产出文件 |
|---|------|------|---------|
| 78 | 后端 Dockerfile | ✅ | `xyzw-backend/Dockerfile` |
| 79 | docker-compose.yml | ✅ | `docker-compose.yml` |
| 80 | 生产环境配置 | ✅ | `.env.production.example` |
| 81 | VPS 部署测试 | 🔲 待完成 | 需在 Vultr VPS/目标服务器上验证 |
| 82 | 全流程验证 | 🟡 本地核心通过 | 注册、登录、订阅、Token 同步、任务创建、Worker 日志均已本地验证 |
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
| POST | `/api/subscription/admin/trial` | 管理员 Key | ✅ | 手动开通 7 天试用 |
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
│   │   ├── wsClient.js                 # Node.js WS 客户端 + 系统代理支持
│   │   ├── taskRunner.js               # 日常任务执行器 + taskType 分发
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
| `src/stores/subscriptionStore.js` | 订阅 Pinia Store |
| `src/views/Auth/Login.vue` | 登录页面 |
| `src/views/Auth/Register.vue` | 注册页面 |
| `src/views/Subscription.vue` | 订阅套餐页面 |
| `src/composables/useSSE.js` | SSE 实时推送 |

### 修改文件

| 文件 | 改动内容 |
|------|---------|
| `src/router/index.js` | 新增 /login、/register、/subscription 路由；全局 JWT 认证守卫 |
| `src/layout/DefaultLayout.vue` | 顶部账号/游戏 Token 区分；新增订阅入口和套餐显示 |
| `src/views/TokenImport/index.vue` | 显示当前账号、套餐、Token 用量；自动同步本地 Token 到后端 |
| `src/stores/tokenStore.ts` | 解除俱乐部白名单限制；新增本地 Token 同步后端能力 |
| `src/views/Auth/Login.vue` | 表单校验、暗色样式修复、登录后加载订阅 |
| `src/views/Auth/Register.vue` | 表单校验、暗色样式修复、注册后加载订阅 |
| `src/views/TokenImport/wxqrcode.vue` | 微信扫码导入链路修复 |
| `vite.config.js` | 后端 API 代理、微信代理顺序、系统代理支持 |
| `docker/nginx.conf` | 新增后端 API + SSE 反向代理规则 |

---

## 八、待完成事项（后续迭代）

### 优先级 P0（上线前必须）

- [ ] 第三方支付对接（虎皮椒/PayJS）— 获取 appId/secret 后实现 `paymentService.createOrder` 中的 TODO
- [ ] 生产环境密钥生成 — `openssl rand -hex 32` 生成 JWT_SECRET 和 TOKEN_ENCRYPT_KEY
- [ ] Vultr VPS/目标服务器部署验证 — `docker-compose up -d` 后跑通 API、前端、Worker、Redis、PostgreSQL
- [ ] BatchDailyTasks.vue 改造 — 任务配置走后端 API 持久化
- [ ] 逐个任务类型真实修复 — `mail` 已跑通；`bottle`、`legion_signin` 已能按当前角色状态成功跳过；`daily_signin`、`gacha` 仍需真实前端在线对照或更深抓包

### 优先级 P1（上线后一周内）

- [ ] tokenStore.ts 深度重构 — 从“本地同步后端”升级为“后端为主、本地缓存为辅”
- [ ] 订阅过期定时扫描 — 每日凌晨扫描过期订阅
- [ ] 支付历史/订单状态前端展示
- [ ] 任务失败重试与失败原因归类

### 优先级 P2（稳定运行后）

- [ ] 代理 IP 服务对接 — proxyService.js 实现
- [ ] 健康检查完善 — 用测试 Token 连接游戏服务器，并记录协议/代理状态
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
| https-proxy-agent | latest | 后端 WebSocket 系统代理支持 |
| lz4js | latest | BON 协议 LZ4 压缩 |
| dotenv | latest | 环境变量 |
| fastify-plugin | latest | 插件封装 |

### 前端（新增）

| 包 | 用途 |
|---|------|
| axios | HTTP 客户端（已有） |

---

## 十、当前可达成目标评估

### 结论

既定的 SaaS 商业化目标**可以实现**。截至 2026-07-11，已经验证“用户注册/开通订阅/导入真实 Token/后端定时登录游戏/完成至少一个预设低风险任务/写入执行日志”的核心闭环，但还不建议直接正式上线收费。

### 已经具备的能力

- 用户注册、登录、JWT 鉴权、刷新 Token。
- 订阅套餐能力：未开通用户 0 个 Token、禁用任务调度；试用版 1 个 Token、7 天、管理员手动开通；基础版按购买 Token 数开放 1-50 个 Token 并启用任务调度。
- Token 后端加密入库、SHA256 去重、重复同步幂等返回已有记录。
- 前端微信扫码导入 Token、本地 Token 自动同步到后端。
- 订阅套餐页面、当前账号/套餐/Token 用量展示。
- 任务日志页面：用户可在 `/admin/task-logs` 查看后端登录时间、任务类型、成功/失败状态、耗时、失败原因和详细步骤。
- 模拟支付链路：创建订单、notify 回调、订阅升级、支付历史查询。
- 后端任务配置、run-now 入队、Worker 消费、任务日志落库。
- Worker 已支持系统代理连接游戏 WebSocket。
- Worker 已支持按 `taskType` 分发，`daily_signin` 不再误执行整套日常。
- scheduler 自动触发链路已验证：到点扫描 `next_run_at`、自动入队、Worker 执行、回写 `last_run_at/last_result/next_run_at`。
- `mail` 低风险任务已真实完成：Worker 登录游戏角色后执行领取邮件附件成功。

### 暂不满足正式上线的部分

- 第三方真实支付尚未接入，当前只有模拟回调/管理员激活框架。
- BatchDailyTasks 仍以现有前端批量任务为主，尚未完全切换到后端任务配置持久化。
- VPS/生产环境部署尚未完成端到端验证。
- 住宅代理 IP 池尚未接入，仅支持系统级代理环境变量。
- 多数具体任务类型尚未逐个真实跑通；当前 `mail` 已稳定成功，`bottle` 和 `legion_signin` 对当前角色状态可成功跳过，`daily_signin`、`gacha` 仍需真实前端在线对照或更深抓包。

### 当前真实验证结论

- 本地账号已导入 2 个真实微信扫码 Token，并同步到后端。
- 通过模拟支付升级为基础版后，可以创建并立即执行后端任务。
- `task_id=15` 已完成最关键端到端验证：北京时间 2026-07-11 10:19:00 由 scheduler 自动触发，Worker 登录真实角色 `kidult`，执行 `mail_claimallattachment` 成功，日志状态 `success`，耗时约 3.7 秒。
- `task_id=16` 已完成第二次定时验证：北京时间 2026-07-11 11:04:00 由 scheduler 自动触发，Worker 登录真实角色 `kidult`，执行 `mail_claimallattachment` 成功，日志状态 `success`，耗时约 6.4 秒。
- `daily_signin` 已成功通过代理连接游戏服务器并获取角色信息；只执行签到相关动作，没有执行竞技场、Boss、邮件、瓶子等整套日常。
- `legion_signin` 最新验证 `task_logs.id=24`：成功获取角色信息，因当前角色未加入军团而成功跳过。
- `bottle` 最新验证 `task_logs.id=26`：成功获取角色信息，因 `bottleHelpers.helperStopTime=0` 判定没有运行中的盐罐机器人，成功跳过。
- 签到命令 `system_signinreward` 与免费扭蛋 `gacha_drawreward` 当前仍表现为请求超时；补齐响应映射后仍未收到目标业务响应，抓包日志显示命令发出后只收到聊天通知。

### 建议上线判断

- **可进入内测**：适合少量真实账号验证 Token 同步、订阅权限、`mail` 等低风险任务调度和 Worker 稳定性。
- **不建议立即公开收费**：真实支付、生产部署、批量任务后端化和多任务类型稳定性还未达到商业化交付标准。
- **下一步最优先**：BatchDailyTasks 后端化、接入真实支付、逐个任务类型验证并补齐超时命令的协议细节。

---

## 十一、启动命令

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
