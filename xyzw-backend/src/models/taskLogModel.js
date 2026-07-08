const { query } = require('../config/database');

const taskLogModel = {
  async findByUserId(userId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT tl.*, tc.cron_expression, gt.name as token_name
       FROM task_logs tl
       LEFT JOIN task_configs tc ON tc.id = tl.task_config_id
       LEFT JOIN game_tokens gt ON gt.id = tl.token_id
       WHERE tl.user_id = $1
       ORDER BY tl.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int AS total FROM task_logs WHERE user_id = $1',
      [userId]
    );

    return { logs: rows, total: countRows[0].total };
  },

  async findByTokenId(tokenId, userId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT tl.*, gt.name as token_name
       FROM task_logs tl
       LEFT JOIN game_tokens gt ON gt.id = tl.token_id
       WHERE tl.token_id = $1 AND tl.user_id = $2
       ORDER BY tl.created_at DESC
       LIMIT $3 OFFSET $4`,
      [tokenId, userId, limit, offset]
    );
    return rows;
  },
};

module.exports = taskLogModel;
