const { Queue, Worker } = require('bullmq');
const redis = require('../config/redis');
const { query } = require('../config/database');
const systemConfigModel = require('../models/systemConfigModel');
const { calculateNextExecutionTime } = require('../utils/cronUtils');

const TASK_EXECUTION_QUEUE = 'task-execution';
const SCHEDULER_QUEUE = 'task-scheduler';

let executionQueue;

function getExecutionQueue() {
  if (!executionQueue) {
    executionQueue = new Queue(TASK_EXECUTION_QUEUE, { connection: redis });
  }
  return executionQueue;
}

async function scanAndEnqueue() {
  const healthy = await systemConfigModel.get('protocol_healthy');
  if (healthy === false) {
    console.warn('[Scheduler] Protocol unhealthy, skipping scan');
    return;
  }

  const { rows: dueTasks } = await query(
    `SELECT tc.id, tc.user_id, tc.token_id, tc.task_type, tc.settings, tc.time_jitter_ms, tc.cron_expression
     FROM task_configs tc
     JOIN game_tokens gt ON gt.id = tc.token_id AND gt.status = 'active'
     JOIN users u ON u.id = tc.user_id AND u.status = 'active'
     WHERE tc.enabled = true AND tc.next_run_at <= NOW()
     LIMIT 200`
  );

  if (dueTasks.length === 0) return;

  const queue = getExecutionQueue();

  for (const task of dueTasks) {
    const jobId = `task:${task.id}:${new Date().toISOString().slice(0, 10)}`;
    const jitter = task.time_jitter_ms > 0
      ? Math.floor(Math.random() * task.time_jitter_ms)
      : 0;

    try {
      await queue.add('execute', {
        taskConfigId: task.id,
        userId: task.user_id,
        tokenId: task.token_id,
        taskType: task.task_type,
        settings: task.settings,
      }, {
        jobId,
        delay: jitter,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      });

      const nextRun = calculateNextExecutionTime({
        runType: 'cron',
        cronExpression: task.cron_expression,
        lastRunAt: new Date(),
      });
      const nextRunAt = nextRun || null;

      await query(
        'UPDATE task_configs SET next_run_at = $1, last_run_at = NOW() WHERE id = $2',
        [nextRunAt ? new Date(nextRunAt) : null, task.id]
      );
    } catch (err) {
      if (err.message && err.message.includes('Job already exists')) {
        await query(
          'UPDATE task_configs SET next_run_at = (next_run_at + interval \'1 day\') WHERE id = $1',
          [task.id]
        );
      } else {
        console.error(`[Scheduler] Failed to enqueue task ${task.id}:`, err.message);
      }
    }
  }

  if (dueTasks.length > 0) {
    console.log(`[Scheduler] Enqueued ${dueTasks.length} tasks`);
  }
}

function setupSchedulerWorker() {
  const schedulerQueue = new Queue(SCHEDULER_QUEUE, { connection: redis });

  schedulerQueue.add('scan', {}, {
    repeat: { every: 60000 },
    removeOnComplete: true,
    removeOnFail: true,
  });

  const worker = new Worker(SCHEDULER_QUEUE, async () => {
    await scanAndEnqueue();
  }, {
    connection: redis,
    concurrency: 1,
  });

  worker.on('failed', (job, err) => {
    console.error('[Scheduler] Scan failed:', err.message);
  });

  return worker;
}

module.exports = { setupSchedulerWorker, TASK_EXECUTION_QUEUE };
