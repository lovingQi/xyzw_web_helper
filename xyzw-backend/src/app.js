const fastify = require('fastify');
const { AppError } = require('./utils/errors');

function buildApp(opts = {}) {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    ...opts,
  });

  // Plugins
  app.register(require('./plugins/cors'));
  app.register(require('./plugins/auth'));

  // Routes
  app.register(require('./routes/auth'));
  app.register(require('./routes/tokens'));
  app.register(require('./routes/tasks'));
  app.register(require('./routes/payments'));
  app.register(require('./routes/subscription'));

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
      return;
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode).send({
        code: error.code || 'BAD_REQUEST',
        message: error.message,
      });
      return;
    }

    request.log.error(error);
    reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : error.message,
    });
  });

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}

module.exports = buildApp;
