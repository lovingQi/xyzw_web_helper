const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');

async function subscriptionRoutes(fastify) {
  fastify.get('/api/subscription/plans', async () => {
    return { plans: paymentService.getPlans() };
  });

  fastify.get('/api/subscription', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    return subscriptionService.getCurrentSubscription(request.user.id);
  });
}

module.exports = subscriptionRoutes;
