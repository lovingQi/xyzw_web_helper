#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATABASE_URL="${DATABASE_URL:-}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_file="$BACKUP_DIR/xyzw-$timestamp.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$backup_file"

find "$BACKUP_DIR" -type f -name 'xyzw-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "$backup_file"
