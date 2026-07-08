CREATE TABLE IF NOT EXISTS task_configs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id        INTEGER NOT NULL REFERENCES game_tokens(id) ON DELETE CASCADE,
    task_type       VARCHAR(50) NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    cron_expression VARCHAR(100) NOT NULL,
    time_jitter_ms  INTEGER DEFAULT 0,
    settings        JSONB DEFAULT '{}',
    last_run_at     TIMESTAMPTZ,
    last_result     VARCHAR(20),
    last_error      TEXT,
    next_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON task_configs(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_tasks_user ON task_configs(user_id);
