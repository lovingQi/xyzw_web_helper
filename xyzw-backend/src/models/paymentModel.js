const { query } = require('../config/database');

const paymentModel = {
  async create({ userId, orderNo, amountCents, paymentMethod, subscriptionTier, subscriptionDays, expireAt }) {
    const { rows } = await query(
      `INSERT INTO payments (user_id, order_no, amount_cents, payment_method, subscription_tier, subscription_days, expire_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, orderNo, amountCents, paymentMethod, subscriptionTier, subscriptionDays, expireAt]
    );
    return rows[0];
  },

  async findByOrderNo(orderNo) {
    const { rows } = await query('SELECT * FROM payments WHERE order_no = $1', [orderNo]);
    return rows[0] || null;
  },

  async updateStatus(orderNo, { paymentStatus, tradeNo, paidAt }) {
    const { rows } = await query(
      `UPDATE payments SET payment_status = $1, trade_no = $2, paid_at = $3
       WHERE order_no = $4 RETURNING *`,
      [paymentStatus, tradeNo, paidAt, orderNo]
    );
    return rows[0] || null;
  },

  async findByUserId(userId, { limit = 20, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },
};

module.exports = paymentModel;
