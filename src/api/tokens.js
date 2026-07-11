import apiClient from './client';

export const tokensApi = {
  async getTokens() {
    const { data } = await apiClient.get('/tokens');
    return data.tokens;
  },

  async addToken({ name, token, server, importMethod, sourceUrl, remark }) {
    const { data } = await apiClient.post('/tokens', {
      name, token, server, importMethod, sourceUrl, remark,
    });
    return data;
  },

  async getToken(id) {
    const { data } = await apiClient.get(`/tokens/${id}`);
    return data;
  },

  async updateToken(id, { name, remark }) {
    const { data } = await apiClient.put(`/tokens/${id}`, { name, remark });
    return data;
  },

  async deleteToken(id) {
    const { data } = await apiClient.delete(`/tokens/${id}`);
    return data;
  },

  async cleanupDuplicates() {
    const { data } = await apiClient.post('/tokens/cleanup-duplicates');
    return data;
  },

  async testToken(id) {
    const { data } = await apiClient.post(`/tokens/${id}/test`);
    return data;
  },
};
