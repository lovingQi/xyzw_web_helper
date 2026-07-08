require('../config');
const { setupSchedulerWorker } = require('./schedulerWorker');
const { setupExecutionWorker } = require('./executionWorker');
const { setupHealthWorker } = require('./healthWorker');

async function startWorkers() {
  console.log('Starting workers...');

  setupSchedulerWorker();
  console.log('  Scheduler worker started');

  setupExecutionWorker();
  console.log('  Execution worker started');

  setupHealthWorker();
  console.log('  Health worker started');

  console.log('All workers running.');
}

startWorkers().catch(err => {
  console.error('Failed to start workers:', err.message);
  process.exit(1);
});
