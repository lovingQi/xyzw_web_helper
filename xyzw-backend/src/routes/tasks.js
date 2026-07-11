const taskService = require('../services/taskService');

async function taskRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/api/tasks', async (request) => {
    const tokenId = request.query.tokenId ? parseInt(request.query.tokenId, 10) : null;
    const tasks = await taskService.getTasks(request.user.id, tokenId);
    return { tasks };
  });

  fastify.get('/api/tasks/definitions', async () => {
    return taskService.getDefinitions();
  });

  fastify.get('/api/tasks/scheduler-status', async () => {
    return taskService.getSchedulerStatus();
  });

  fastify.post('/api/tasks', async (request, reply) => {
    const { tokenId, taskType, cronExpression, timeJitterMs, settings } = request.body || {};
    const task = await taskService.createTask(request.user.id, {
      tokenId, taskType, cronExpression, timeJitterMs, settings,
    });
    reply.code(201).send(task);
  });

  fastify.put('/api/tasks/:id', async (request) => {
    const { enabled, cronExpression, timeJitterMs, settings } = request.body || {};
    const updated = await taskService.updateTask(
      parseInt(request.params.id, 10),
      request.user.id,
      { enabled, cronExpression, timeJitterMs, settings }
    );
    return updated;
  });

  fastify.delete('/api/tasks/:id', async (request) => {
    await taskService.deleteTask(
      parseInt(request.params.id, 10),
      request.user.id
    );
    return { ok: true };
  });

  fastify.post('/api/tasks/:id/run-now', async (request) => {
    const result = await taskService.runNow(
      parseInt(request.params.id, 10),
      request.user.id
    );
    return result;
  });

  fastify.get('/api/tasks/logs', async (request) => {
    const { tokenId, taskConfigId, limit = 50, offset = 0 } = request.query;
    return taskService.getLogs(request.user.id, {
      tokenId: tokenId ? parseInt(tokenId, 10) : null,
      taskConfigId: taskConfigId ? parseInt(taskConfigId, 10) : null,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  });
}

module.exports = taskRoutes;
