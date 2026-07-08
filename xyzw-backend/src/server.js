const fs = require('fs');
const path = require('path');
const config = require('./config');
const buildApp = require('./app');

async function autoMigrate() {
  const { pool } = require('./config/database');
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY, filename VARCHAR(255) UNIQUE NOT NULL, executed_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    const { rows } = await client.query('SELECT filename FROM _migrations');
    const done = new Set(rows.map(r => r.filename));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migration: ${file} OK`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Migration: ${file} FAILED:`, e.message);
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

async function start() {
  await autoMigrate();
  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`Server running on http://${config.host}:${config.port}`);

    if (process.env.ENABLE_WORKERS !== 'false') {
      const { setupSchedulerWorker } = require('./workers/schedulerWorker');
      const { setupExecutionWorker } = require('./workers/executionWorker');
      const { setupHealthWorker } = require('./workers/healthWorker');

      setupSchedulerWorker();
      setupExecutionWorker();
      setupHealthWorker();
      console.log('Workers started (scheduler + execution + health)');
    }
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
