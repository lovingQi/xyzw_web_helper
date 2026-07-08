CREATE TABLE IF NOT EXISTS payments (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    order_no          VARCHAR(64) UNIQUE NOT NULL,
    amount_cents      INTEGER NOT NULL,
    payment_method    VARCHAR(20),
    payment_status    VARCHAR(20) DEFAULT 'pending',
    subscription_tier VARCHAR(20),
    subscription_days INTEGER,
    trade_no          VARCHAR(100),
    paid_at           TIMESTAMPTZ,
    expire_at         TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_no);
