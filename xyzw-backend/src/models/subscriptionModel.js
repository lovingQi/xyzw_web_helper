const { query } = require('../config/database');

const subscriptionModel = {
  async create({ userId, tier, maxTokens, startsAt, expiresAt, paymentId }) {
    const { rows } = await query(
      `INSERT INTO subscriptions (user_id, tier, max_tokens, starts_at, expires_at, payment_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, tier, maxTokens, startsAt, expiresAt, paymentId]
    );
    return rows[0];
  },

  async findActiveByUserId(userId) {
    const { rows } = await query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async extendOrCreate(userId, tier, maxTokens, days, paymentId) {
    const existing = await this.findActiveByUserId(userId);

    if (existing && existing.tier === tier) {
      const { rows } = await query(
        `UPDATE subscriptions
         SET expires_at = expires_at + ($1 || ' days')::interval, payment_id = $2
         WHERE id = $3 RETURNING *`,
        [days, paymentId, existing.id]
      );
      return rows[0];
    }

    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + days * 86400000);
    return this.create({ userId, tier, maxTokens, startsAt, expiresAt, paymentId });
  },

  async expireOverdue() {
    const { rowCount } = await query(
      `UPDATE subscriptions SET status = 'expired'
       WHERE status = 'active' AND expires_at <= NOW()`
    );
    return rowCount;
  },
};

module.exports = subscriptionModel;
