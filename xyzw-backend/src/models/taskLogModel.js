const { query } = require('../config/database');

const taskLogModel = {
  async findByUserId(userId, { limit = 50, offset = 0, taskConfigId = null } = {}) {
    const where = ['tl.user_id = $1'];
    const params = [userId];
    let nextParam = 2;
    if (taskConfigId) {
      where.push(`tl.task_config_id = $${nextParam}`);
      params.push(taskConfigId);
      nextParam++;
    }
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT tl.*, tc.cron_expression, gt.name as token_name
       FROM task_logs tl
       LEFT JOIN task_configs tc ON tc.id = tl.task_config_id
       LEFT JOIN game_tokens gt ON gt.id = tl.token_id
       WHERE ${where.join(' AND ')}
       ORDER BY tl.created_at DESC
       LIMIT $${nextParam} OFFSET $${nextParam + 1}`,
      params
    );

    const countParams = [userId];
    const countWhere = ['user_id = $1'];
    if (taskConfigId) {
      countWhere.push('task_config_id = $2');
      countParams.push(taskConfigId);
    }
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS total FROM task_logs WHERE ${countWhere.join(' AND ')}`,
      countParams
    );

    return { logs: rows, total: countRows[0].total };
  },

  async findByTokenId(tokenId, userId, { limit = 50, offset = 0, taskConfigId = null } = {}) {
    const where = ['tl.token_id = $1', 'tl.user_id = $2'];
    const params = [tokenId, userId];
    let nextParam = 3;
    if (taskConfigId) {
      where.push(`tl.task_config_id = $${nextParam}`);
      params.push(taskConfigId);
      nextParam++;
    }
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT tl.*, gt.name as token_name
       FROM task_logs tl
       LEFT JOIN game_tokens gt ON gt.id = tl.token_id
       WHERE ${where.join(' AND ')}
       ORDER BY tl.created_at DESC
       LIMIT $${nextParam} OFFSET $${nextParam + 1}`,
      params
    );
    return rows;
  },
};

module.exports = taskLogModel;
