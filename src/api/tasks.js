import apiClient from './client';

export const tasksApi = {
  async getTasks(tokenId) {
    const params = tokenId ? { tokenId } : {};
    const { data } = await apiClient.get('/tasks', { params });
    return data.tasks;
  },

  async createTask({ tokenId, taskType, cronExpression, timeJitterMs, settings }) {
    const { data } = await apiClient.post('/tasks', {
      tokenId, taskType, cronExpression, timeJitterMs, settings,
    });
    return data;
  },

  async updateTask(id, { enabled, cronExpression, timeJitterMs, settings }) {
    const { data } = await apiClient.put(`/tasks/${id}`, {
      enabled, cronExpression, timeJitterMs, settings,
    });
    return data;
  },

  async deleteTask(id) {
    const { data } = await apiClient.delete(`/tasks/${id}`);
    return data;
  },

  async runNow(id) {
    const { data } = await apiClient.post(`/tasks/${id}/run-now`);
    return data;
  },

  async getLogs({ tokenId, limit = 50, offset = 0 } = {}) {
    const params = { limit, offset };
    if (tokenId) params.tokenId = tokenId;
    const { data } = await apiClient.get('/tasks/logs', { params });
    return data;
  },
};
