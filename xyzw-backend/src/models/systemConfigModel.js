const { query } = require('../config/database');

const systemConfigModel = {
  async get(key) {
    const { rows } = await query(
      'SELECT value FROM system_config WHERE key = $1',
      [key]
    );
    return rows[0] ? rows[0].value : null;
  },

  async set(key, value, description) {
    await query(
      `INSERT INTO system_config (key, value, description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify(value), description || null]
    );
  },

  async getAll() {
    const { rows } = await query('SELECT key, value, description, updated_at FROM system_config');
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  },
};

module.exports = systemConfigModel;
