CREATE TABLE IF NOT EXISTS game_tokens (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(100),
    encrypted_token   TEXT NOT NULL,
    token_hash        VARCHAR(64) NOT NULL,
    server            VARCHAR(100),
    role_name         VARCHAR(100),
    role_level        INTEGER,
    import_method     VARCHAR(20),
    source_url        TEXT,
    remark            TEXT,
    status            VARCHAR(20) DEFAULT 'active',
    last_connected_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON game_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_hash ON game_tokens(user_id, token_hash);
