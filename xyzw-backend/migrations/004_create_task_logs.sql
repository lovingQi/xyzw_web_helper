CREATE TABLE IF NOT EXISTS task_logs (
    id              SERIAL PRIMARY KEY,
    task_config_id  INTEGER REFERENCES task_configs(id) ON DELETE SET NULL,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    token_id        INTEGER NOT NULL REFERENCES game_tokens(id),
    task_type       VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_ms     INTEGER,
    result          JSONB,
    error           TEXT,
    proxy_ip        VARCHAR(45),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_user_time ON task_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_token ON task_logs(token_id, created_at DESC);
