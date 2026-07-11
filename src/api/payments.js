import apiClient from './client';

export const paymentsApi = {
  async createOrder({ planId, paymentMethod, maxTokens }) {
    const { data } = await apiClient.post('/payments/create', {
      planId,
      paymentMethod,
      maxTokens,
    });
    return data;
  },

  async getHistory({ limit = 20, offset = 0 } = {}) {
    const { data } = await apiClient.get('/payments/history', {
      params: { limit, offset },
    });
    return data;
  },
};
