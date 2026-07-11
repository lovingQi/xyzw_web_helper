# PostgreSQL 备份与恢复

## 1. 备份

在服务器上设置 `DATABASE_URL` 后执行：

```bash
cd xyzw-backend
DATABASE_URL='postgres://xyzw:密码@127.0.0.1:5432/xyzw' \
BACKUP_DIR=/data/xyzw-backups \
RETENTION_DAYS=14 \
./scripts/backup-postgres.sh
```

Docker Compose 部署时，也可以从容器内执行：

```bash
docker compose exec postgres pg_dump -U xyzw xyzw | gzip > /data/xyzw-backups/xyzw-$(date +%Y%m%d-%H%M%S).sql.gz
```

## 2. Crontab 示例

每天凌晨 3 点备份：

```cron
0 3 * * * cd /opt/xyzw_web_helper/xyzw-backend && DATABASE_URL='postgres://xyzw:密码@postgres:5432/xyzw' BACKUP_DIR=/data/xyzw-backups ./scripts/backup-postgres.sh >> /var/log/xyzw-backup.log 2>&1
```

## 3. 恢复

恢复前先停止后端，避免写入冲突：

```bash
docker compose stop backend
```

恢复到空数据库：

```bash
gunzip -c /data/xyzw-backups/xyzw-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T postgres psql -U xyzw xyzw
```

恢复后启动后端：

```bash
docker compose start backend
docker compose logs -f backend
```

## 4. 注意事项

- 备份目录不要提交到 Git。
- 至少保留 14 天备份。
- 收费上线后建议把备份同步到对象存储或另一台服务器。
- 恢复演练应在测试库先做一次，确认备份文件可用。
