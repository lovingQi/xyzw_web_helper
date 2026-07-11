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
       FROM game_tokens WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findByRoleAndUser({ userId, name, server }) {
    const { rows } = await query(
      `SELECT id, user_id, name, server, role_name, role_level, import_method, source_url, remark, status, last_connected_at, created_at, updated_at
       FROM game_tokens
       WHERE user_id = $1 AND name = $2 AND COALESCE(server, '') = COALESCE($3, '') AND status = 'active'
       ORDER BY last_connected_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [userId, name, server || '']
    );
    return rows[0] || null;
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

  async findByHashAndUser(tokenHash, userId) {
    const { rows } = await query(
      `SELECT id, user_id, name, server, role_name, role_level, import_method, source_url, remark, status, last_connected_at, created_at, updated_at
       FROM game_tokens WHERE token_hash = $1 AND user_id = $2`,
      [tokenHash, userId]
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

  async cleanupDuplicateRoles(userId) {
    const { rows } = await query(
      `WITH ranked AS (
         SELECT
           gt.id,
           gt.name,
           gt.server,
           row_number() OVER (
             PARTITION BY gt.name, COALESCE(gt.server, '')
             ORDER BY
               (EXISTS (SELECT 1 FROM task_configs tc WHERE tc.token_id = gt.id)) DESC,
               gt.last_connected_at DESC NULLS LAST,
               gt.created_at DESC,
               gt.id DESC
           ) AS rn
         FROM game_tokens gt
         WHERE gt.user_id = $1 AND gt.status = 'active'
       ),
       updated_tasks AS (
         UPDATE task_configs tc
         SET token_id = keep.id, updated_at = NOW()
         FROM ranked dup
         JOIN ranked keep ON keep.name = dup.name
           AND COALESCE(keep.server, '') = COALESCE(dup.server, '')
           AND keep.rn = 1
         WHERE dup.rn > 1 AND tc.token_id = dup.id
         RETURNING tc.id, dup.id AS from_token_id, keep.id AS to_token_id
       ),
       disabled AS (
         UPDATE game_tokens gt
         SET status = 'duplicate', updated_at = NOW(), remark = COALESCE(gt.remark, '') || ' duplicate merged'
         FROM ranked r
         WHERE gt.id = r.id AND r.rn > 1
         RETURNING gt.id, gt.name, gt.server
       )
       SELECT
         (SELECT COALESCE(json_agg(disabled), '[]'::json) FROM disabled) AS disabled_tokens,
         (SELECT COALESCE(json_agg(updated_tasks), '[]'::json) FROM updated_tasks) AS updated_tasks`
      ,
      [userId]
    );
    return rows[0] || { disabled_tokens: [], updated_tasks: [] };
  },
};

module.exports = tokenModel;
