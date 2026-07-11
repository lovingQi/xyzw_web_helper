const subscriptionModel = require('../models/subscriptionModel');
const { ForbiddenError } = require('../utils/errors');

const FREE_LIMITS = {
  maxTokens: 0,
  taskScheduling: false,
};

const subscriptionService = {
  async getCurrentSubscription(userId) {
    const sub = await subscriptionModel.findActiveByUserId(userId);
    if (!sub) {
      return {
        tier: 'free',
        maxTokens: FREE_LIMITS.maxTokens,
        taskScheduling: FREE_LIMITS.taskScheduling,
        expiresAt: null,
      };
    }
    return {
      tier: sub.tier,
      maxTokens: sub.max_tokens,
      taskScheduling: ['trial', 'basic'].includes(sub.tier),
      expiresAt: sub.expires_at,
      startsAt: sub.starts_at,
    };
  },

  async checkTokenLimit(userId, currentCount) {
    const sub = await this.getCurrentSubscription(userId);
    if (currentCount >= sub.maxTokens) {
      throw new ForbiddenError(`当前套餐最多添加 ${sub.maxTokens} 个Token，请升级套餐`);
    }
  },

  async checkTaskScheduling(userId) {
    const sub = await this.getCurrentSubscription(userId);
    if (!sub.taskScheduling) {
      throw new ForbiddenError('免费版不支持任务调度，请升级套餐');
    }
  },

  async expireOverdueSubscriptions() {
    const count = await subscriptionModel.expireOverdue();
    if (count > 0) {
      console.log(`[Subscription] Expired ${count} overdue subscriptions`);
    }
    return count;
  },
};

module.exports = subscriptionService;
