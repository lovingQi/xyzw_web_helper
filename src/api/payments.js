import apiClient from './client';

export const paymentsApi = {
  async createOrder({ planId, paymentMethod }) {
    const { data } = await apiClient.post('/payments/create', {
      planId, paymentMethod,
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
