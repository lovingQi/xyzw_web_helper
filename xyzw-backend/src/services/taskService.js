const { Queue } = require('bullmq');
const redis = require('../config/redis');
const taskConfigModel = require('../models/taskConfigModel');
const taskLogModel = require('../models/taskLogModel');
const tokenModel = require('../models/tokenModel');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { TASK_EXECUTION_QUEUE } = require('../workers/schedulerWorker');

const VALID_TASK_TYPES = [
  'daily_all', 'daily_signin', 'arena', 'boss', 'tower',
  'study', 'mail', 'legion_signin', 'bottle', 'gacha',
  'hangup', 'recruit', 'buygold',
];

let executionQueue;
function getQueue() {
  if (!executionQueue) {
    executionQueue = new Queue(TASK_EXECUTION_QUEUE, { connection: redis });
  }
  return executionQueue;
}

const taskService = {
  async createTask(userId, { tokenId, taskType, cronExpression, timeJitterMs, settings }) {
    if (!tokenId || !taskType || !cronExpression) {
      throw new ValidationError('tokenId, taskType, cronExpression 是必填项');
    }

    if (!VALID_TASK_TYPES.includes(taskType)) {
      throw new ValidationError(`无效的任务类型: ${taskType}`);
    }

    const token = await tokenModel.findByIdAndUser(tokenId, userId);
    if (!token) {
      throw new NotFoundError('Token不存在');
    }

    return taskConfigModel.create({
      userId,
      tokenId,
      taskType,
      cronExpression,
      timeJitterMs: timeJitterMs || 300000,
      settings,
    });
  },

  async getTasks(userId, tokenId) {
    if (tokenId) {
      return taskConfigModel.findByTokenId(tokenId);
    }
    return taskConfigModel.findByUserId(userId);
  },

  async updateTask(id, userId, updates) {
    const existing = await taskConfigModel.findByIdAndUser(id, userId);
    if (!existing) {
      throw new NotFoundError('任务配置不存在');
    }

    const fields = {};
    if (updates.enabled !== undefined) fields.enabled = updates.enabled;
    if (updates.cronExpression) fields.cron_expression = updates.cronExpression;
    if (updates.timeJitterMs !== undefined) fields.time_jitter_ms = updates.timeJitterMs;
    if (updates.settings) fields.settings = updates.settings;

    return taskConfigModel.update(id, userId, fields);
  },

  async deleteTask(id, userId) {
    const deleted = await taskConfigModel.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('任务配置不存在');
    }
    return true;
  },

  async runNow(id, userId) {
    const task = await taskConfigModel.findByIdAndUser(id, userId);
    if (!task) {
      throw new NotFoundError('任务配置不存在');
    }

    const queue = getQueue();
    const job = await queue.add('execute', {
      taskConfigId: task.id,
      userId: task.user_id,
      tokenId: task.token_id,
      taskType: task.task_type,
      settings: task.settings,
    }, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    return { jobId: job.id };
  },

  async getLogs(userId, { tokenId, limit, offset } = {}) {
    if (tokenId) {
      const logs = await taskLogModel.findByTokenId(tokenId, userId, { limit, offset });
      return { logs, total: logs.length };
    }
    return taskLogModel.findByUserId(userId, { limit, offset });
  },
};

module.exports = taskService;
