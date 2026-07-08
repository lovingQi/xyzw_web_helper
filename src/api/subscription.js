import apiClient from './client';

export const subscriptionApi = {
  async getPlans() {
    const { data } = await apiClient.get('/subscription/plans');
    return data.plans;
  },

  async getCurrent() {
    const { data } = await apiClient.get('/subscription');
    return data;
  },
};
