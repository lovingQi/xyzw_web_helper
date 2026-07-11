const tokenService = require('../services/tokenService');

async function tokenRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/api/tokens', async (request, reply) => {
    const { name, token, server, importMethod, sourceUrl, remark } = request.body || {};
    const record = await tokenService.addToken(request.user.id, {
      name, token, server, importMethod, sourceUrl, remark,
    });
    reply.code(201).send(record);
  });

  fastify.get('/api/tokens', async (request) => {
    const tokens = await tokenService.getTokens(request.user.id);
    return { tokens };
  });

  fastify.post('/api/tokens/cleanup-duplicates', async (request) => {
    return tokenService.cleanupDuplicates(request.user.id);
  });

  fastify.get('/api/tokens/:id', async (request) => {
    const token = await tokenService.getTokenWithDecryption(
      parseInt(request.params.id, 10),
      request.user.id
    );
    const { encrypted_token, decryptedToken, ...safe } = token;
    safe.tokenPreview = decryptedToken.slice(0, 8) + '...' + decryptedToken.slice(-8);
    return safe;
  });

  fastify.put('/api/tokens/:id', async (request) => {
    const { name, remark } = request.body || {};
    const updated = await tokenService.updateToken(
      parseInt(request.params.id, 10),
      request.user.id,
      { name, remark }
    );
    return updated;
  });

  fastify.delete('/api/tokens/:id', async (request) => {
    await tokenService.deleteToken(
      parseInt(request.params.id, 10),
      request.user.id
    );
    return { ok: true };
  });
}

module.exports = tokenRoutes;
