const userService = require('../services/userService');

async function authRoutes(fastify) {
  fastify.post('/api/auth/register', async (request, reply) => {
    const { email, password, nickname } = request.body || {};
    const result = await userService.register({ email, password, nickname });
    reply.code(201).send(result);
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    const result = await userService.login({ email, password });
    reply.send(result);
  });

  fastify.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body || {};
    if (!refreshToken) {
      reply.code(400).send({ code: 'VALIDATION_ERROR', message: '缺少刷新令牌' });
      return;
    }
    const tokens = await userService.refreshToken(refreshToken);
    reply.send(tokens);
  });

  fastify.post('/api/auth/logout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    reply.send({ ok: true });
  });
}

module.exports = authRoutes;
