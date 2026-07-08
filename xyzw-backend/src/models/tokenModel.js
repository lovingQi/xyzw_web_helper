const { query } = require('../config/database');

const tokenModel = {
  async create({ userId, name, encryptedToken, tokenHash, server, roleName, roleLevel, importMethod, sourceUrl, remark }) {
    const { rows } = await query(
      `INSERT INTO game_tokens (user_id, name, encrypted_token, token_hash, server, role_name, role_level, import_method, source_url, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, name, server, role_name, role_level, import_method, source_url, remark, status, last_connected_at, created_at, updated_at`,
      [userId, name, encryptedToken, tokenHash, server, roleName, roleLevel, importMethod, sourceUrl, remark]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT id, user_id, name, server, role_name, role_level, import_method, source_url, remark, status, last_connected_at, created_at, updated_at
       FROM game_tokens WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT * FROM game_tokens WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  },

  async findByIdAndUser(id, userId) {
    const { rows } = await query(
      'SELECT * FROM game_tokens WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, userId, fields) {
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
    sets.push(`updated_at = NOW()`);
    values.push(id, userId);

    const { rows } = await query(
      `UPDATE game_tokens SET ${sets.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING id, user_id, name, server, role_name, role_level, import_method, source_url, remark, status, last_connected_at, created_at, updated_at`,
      values
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await query(
      'DELETE FROM game_tokens WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  async countByUserId(userId) {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS count FROM game_tokens WHERE user_id = $1',
      [userId]
    );
    return rows[0].count;
  },

  async updateLastConnected(id) {
    await query(
      'UPDATE game_tokens SET last_connected_at = NOW() WHERE id = $1',
      [id]
    );
  },
};

module.exports = tokenModel;
