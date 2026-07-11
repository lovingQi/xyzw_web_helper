const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');
const subscriptionModel = require('../models/subscriptionModel');
const config = require('../config');
const { UnauthorizedError, ValidationError } = require('../utils/errors');

async function subscriptionRoutes(fastify) {
  fastify.get('/api/subscription/plans', async () => {
    return { plans: paymentService.getPlans() };
  });

  fastify.get('/api/subscription', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    return subscriptionService.getCurrentSubscription(request.user.id);
  });

  fastify.post('/api/subscription/admin/trial', async (request, reply) => {
    const apiKey = request.headers['x-admin-api-key'];
    if (!config.admin.apiKey || apiKey !== config.admin.apiKey) {
      throw new UnauthorizedError('无效的管理员密钥');
    }

    const { userId } = request.body || {};
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw new ValidationError('无效的用户ID');
    }

    const subscription = await subscriptionModel.extendOrCreate(
      parsedUserId,
      'trial',
      1,
      7,
      null
    );

    reply.code(201).send({ subscription });
  });
}

module.exports = subscriptionRoutes;
