const { Worker } = require('bullmq');
const redis = require('../config/redis');
const { query } = require('../config/database');
const tokenModel = require('../models/tokenModel');
const { decrypt } = require('../utils/crypto');
const { GameWsClient } = require('../game/wsClient');
const { TaskRunner } = require('../game/taskRunner');
const systemConfigModel = require('../models/systemConfigModel');
const { TASK_EXECUTION_QUEUE } = require('./schedulerWorker');

async function executeTask(job) {
  const { taskConfigId, userId, tokenId, taskType, settings } = job.data;
  const startedAt = new Date();

  let logId;
  try {
    const { rows } = await query(
      `INSERT INTO task_logs (task_config_id, user_id, token_id, task_type, status, started_at)
       VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
      [taskConfigId, userId, tokenId, taskType, startedAt]
    );
    logId = rows[0].id;
  } catch (_) { /* ignore logging failures */ }

  try {
    const tokenRecord = await tokenModel.findById(tokenId);
    if (!tokenRecord || tokenRecord.user_id !== userId) {
      throw new Error('Token not found or access denied');
    }

    const rawToken = decrypt(tokenRecord.encrypted_token);

    const wsUrl = await systemConfigModel.get('game_ws_url') || 'wss://xxz-xyzw.hortorgames.com/agent';
    const fullUrl = GameWsClient.buildWsUrl(rawToken, wsUrl.replace(/"/g, ''));

    const wsClient = new GameWsClient({
      heartbeatInterval: 2000,
      queueInterval: 50,
      autoReconnect: false,
    });

    const result = await wsClient.connectAndExecute(fullUrl, async (client) => {
      await tokenModel.updateLastConnected(tokenId);

      const runner = new TaskRunner(client, settings || {});
      return await runner.runTaskType(taskType);
    });

    const completedAt = new Date();
    const durationMs = completedAt - startedAt;

    if (logId) {
      await query(
        `UPDATE task_logs SET status = $1, completed_at = $2, duration_ms = $3, result = $4 WHERE id = $5`,
        [
          result.success ? 'success' : 'failed',
          completedAt,
          durationMs,
          JSON.stringify({
            taskType,
            tasksRun: result.tasksRun,
            tasksFailed: result.tasksFailed,
            logs: result.logs || [],
          }),
          logId,
        ]
      );
    }

    await query(
      'UPDATE task_configs SET last_result = $1, last_error = $2 WHERE id = $3',
      [result.success ? 'success' : 'failed', result.error || null, taskConfigId]
    );

    return result;
  } catch (error) {
    const completedAt = new Date();
    const durationMs = completedAt - startedAt;

    if (logId) {
      await query(
        `UPDATE task_logs SET status = 'failed', completed_at = $1, duration_ms = $2, error = $3 WHERE id = $4`,
        [completedAt, durationMs, error.message, logId]
      );
    }

    await query(
      'UPDATE task_configs SET last_result = $1, last_error = $2 WHERE id = $3',
      ['failed', error.message, taskConfigId]
    );

    throw error;
  }
}

function setupExecutionWorker() {
  const worker = new Worker(TASK_EXECUTION_QUEUE, async (job) => {
    return executeTask(job);
  }, {
    connection: redis,
    concurrency: 50,
    limiter: {
      max: 10,
      duration: 1000,
    },
  });

  worker.on('completed', (job, result) => {
    if (result?.tasksRun > 0) {
      console.log(`[Executor] Job ${job.id} completed: ${result.tasksRun} tasks`);
    }
  });

  worker.on('failed', (job, err) => {
    console.error(`[Executor] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

module.exports = { setupExecutionWorker };
