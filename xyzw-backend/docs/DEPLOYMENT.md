# 生产部署说明

> 当前状态：适合内测部署。真实收费上线前必须接入 `xunhupay` 或 `payjs` provider。

## 1. 准备服务器

- 推荐 Ubuntu 22.04/24.04。
- 安装 Docker 和 Docker Compose plugin。
- 准备域名并解析到服务器。
- 准备 HTTPS 证书或在网关层配置 HTTPS。

## 2. 配置环境变量

复制生产环境模板：

```bash
cp .env.production.example .env
```

必须修改：

```bash
DB_PASSWORD=替换为强密码
JWT_SECRET=$(openssl rand -hex 32)
TOKEN_ENCRYPT_KEY=$(openssl rand -hex 32)
FRONTEND_PORT=80
```

支付配置：

```bash
PAYMENT_PROVIDER=mock
PAYMENT_MOCK_ENABLED=false
PAYMENT_NOTIFY_URL=https://yourdomain.com/api/payments/notify
PAYMENT_RETURN_URL=https://yourdomain.com/admin/subscription
```

说明：
- `mock` 只允许内测/手动激活。
- 公开收费前必须改为 `xunhupay` 或 `payjs`，并实现对应 provider 的签名、下单、回调验签。
- 生产环境如果确实要临时使用 mock，需要显式设置 `PAYMENT_MOCK_ENABLED=true`。

## 3. 启动服务

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f backend
```

后端启动时会自动执行数据库迁移。

## 4. 健康检查

```bash
curl -f http://127.0.0.1/api/health
docker compose exec redis redis-cli ping
docker compose exec postgres pg_isready -U xyzw
```

后台还需要确认：
- backend 日志包含 `Workers started`。
- `/admin/task-logs` 可以打开。
- `/admin/task-schedules` 可以创建任务。

## 5. 内测验证流程

1. 注册用户并登录。
2. 使用管理员接口或 mock 支付开通订阅。
3. 微信扫码导入 Token。
4. 在 `/admin/task-schedules` 创建后端定时任务。
5. 使用 `run-now` 立即执行低风险任务，例如 `mail` 或 `climbTower`。
6. 在 `/admin/task-logs` 确认日志状态、耗时、步骤时间线。

## 6. 真实收费上线前阻塞项

- 接入真实支付 provider。
- 生产域名 HTTPS 验证。
- PostgreSQL 定时备份。
- 至少完成核心任务类型真实验证。
- 确认系统代理或住宅代理策略。
- 配置日志监控和异常告警。

## 7. 常用维护命令

重启后端：

```bash
docker compose restart backend
```

查看 Worker 日志：

```bash
docker compose logs -f backend | grep -E 'Scheduler|Executor|Subscription'
```

停止服务：

```bash
docker compose down
```
