const { query } = require('../config/database');
const { calculateNextExecutionTime } = require('../utils/cronUtils');

const taskConfigModel = {
  async create({ userId, tokenId, taskType, cronExpression, timeJitterMs, settings }) {
    const nextRun = calculateNextExecutionTime({ runType: 'cron', cronExpression, lastRunAt: null });
    const nextRunAt = nextRun ? new Date(nextRun) : null;

    const { rows } = await query(
      `INSERT INTO task_configs (user_id, token_id, task_type, cron_expression, time_jitter_ms, settings, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, tokenId, taskType, cronExpression, timeJitterMs || 0, JSON.stringify(settings || {}), nextRunAt]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await query(
      'SELECT * FROM task_configs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  },

  async findByTokenId(tokenId) {
    const { rows } = await query(
      'SELECT * FROM task_configs WHERE token_id = $1 ORDER BY created_at DESC',
      [tokenId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM task_configs WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByIdAndUser(id, userId) {
    const { rows } = await query(
      'SELECT * FROM task_configs WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rows[0] || null;
  },

  async update(id, userId, fields) {
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (key === 'settings') {
        sets.push(`${key} = $${idx}`);
        values.push(JSON.stringify(val));
      } else {
        sets.push(`${key} = $${idx}`);
        values.push(val);
      }
      idx++;
    }
    sets.push('updated_at = NOW()');
    values.push(id, userId);

    const { rows } = await query(
      `UPDATE task_configs SET ${sets.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async delete(id, userId) {
    const { rowCount } = await query(
      'DELETE FROM task_configs WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  async findDueTasks() {
    const { rows } = await query(
      `SELECT tc.* FROM task_configs tc
       JOIN game_tokens gt ON gt.id = tc.token_id AND gt.status = 'active'
       JOIN users u ON u.id = tc.user_id AND u.status = 'active'
       WHERE tc.enabled = true AND tc.next_run_at <= NOW()
       LIMIT 200`
    );
    return rows;
  },
};

module.exports = taskConfigModel;
