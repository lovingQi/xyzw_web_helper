const { Queue, Worker } = require('bullmq');
const redis = require('../config/redis');
const systemConfigModel = require('../models/systemConfigModel');

const HEALTH_QUEUE = 'health-check';

function setupHealthWorker() {
  const queue = new Queue(HEALTH_QUEUE, { connection: redis });

  queue.add('check', {}, {
    repeat: { every: 300000 },
    removeOnComplete: true,
    removeOnFail: true,
  });

  const worker = new Worker(HEALTH_QUEUE, async () => {
    try {
      await systemConfigModel.set('last_health_check', new Date().toISOString());
      // TODO: implement actual game server health check with test token
      // For now, just mark as healthy
      await systemConfigModel.set('protocol_healthy', true);
    } catch (err) {
      console.error('[Health] Check failed:', err.message);
    }
  }, {
    connection: redis,
    concurrency: 1,
  });

  worker.on('failed', (job, err) => {
    console.error('[Health] Worker failed:', err.message);
  });

  return worker;
}

module.exports = { setupHealthWorker };
