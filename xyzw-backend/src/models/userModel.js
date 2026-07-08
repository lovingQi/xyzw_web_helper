const { query } = require('../config/database');

const userModel = {
  async findByEmail(email) {
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT id, email, nickname, status, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async create({ email, passwordHash, nickname }) {
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, nickname)
       VALUES ($1, $2, $3)
       RETURNING id, email, nickname, status, created_at`,
      [email, passwordHash, nickname]
    );
    return rows[0];
  },

  async updateNickname(id, nickname) {
    const { rows } = await query(
      `UPDATE users SET nickname = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, nickname, status, created_at, updated_at`,
      [nickname, id]
    );
    return rows[0] || null;
  },

  async updateStatus(id, status) {
    await query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
  },
};

module.exports = userModel;
