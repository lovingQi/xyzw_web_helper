const fp = require('fastify-plugin');
const jwt = require('jsonwebtoken');
const config = require('../config');

async function authPlugin(fastify) {
  fastify.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: '缺少认证令牌' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      if (payload.type !== 'access') {
        reply.code(401).send({ code: 'UNAUTHORIZED', message: '无效的令牌类型' });
        return;
      }
      request.user = { id: payload.id, email: payload.email };
    } catch (err) {
      reply.code(401).send({ code: 'UNAUTHORIZED', message: '令牌已过期或无效' });
    }
  });
}

module.exports = fp(authPlugin);
