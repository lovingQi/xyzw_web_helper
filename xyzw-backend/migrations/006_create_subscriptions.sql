CREATE TABLE IF NOT EXISTS subscriptions (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    tier         VARCHAR(20) NOT NULL,
    max_tokens   INTEGER NOT NULL DEFAULT 5,
    starts_at    TIMESTAMPTZ NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    status       VARCHAR(20) DEFAULT 'active',
    payment_id   INTEGER REFERENCES payments(id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_expires ON subscriptions(expires_at) WHERE status = 'active';
