import apiClient from './client';

export const authApi = {
  async register({ email, password, nickname }) {
    const { data } = await apiClient.post('/auth/register', { email, password, nickname });
    return data;
  },

  async login({ email, password }) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  },

  async refresh(refreshToken) {
    const { data } = await apiClient.post('/auth/refresh', { refreshToken });
    return data;
  },

  async logout() {
    const { data } = await apiClient.post('/auth/logout');
    return data;
  },
};
