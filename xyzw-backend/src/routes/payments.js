const paymentService = require('../services/paymentService');

async function paymentRoutes(fastify) {
  fastify.post('/api/payments/create', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { planId, paymentMethod } = request.body || {};
    const result = await paymentService.createOrder(request.user.id, {
      planId, paymentMethod,
    });
    reply.code(201).send(result);
  });

  // Third-party payment callback (no auth)
  fastify.post('/api/payments/notify', async (request, reply) => {
    const { orderNo, tradeNo, status } = request.body || {};
    // TODO: verify signature from third-party payment provider
    const success = await paymentService.handleCallback({ orderNo, tradeNo, status });
    reply.send({ success });
  });

  fastify.get('/api/payments/history', {
    preHandler: [fastify.authenticate],
  }, async (request) => {
    const { limit = 20, offset = 0 } = request.query;
    const payments = await paymentService.getPaymentHistory(request.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    return { payments };
  });
}

module.exports = paymentRoutes;
