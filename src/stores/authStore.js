import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';

export const useAuthStore = defineStore('auth-saas', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
  const accessToken = ref(localStorage.getItem('accessToken') || '');
  const refreshToken = ref(localStorage.getItem('refreshToken') || '');

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value);
  const userEmail = computed(() => user.value?.email || '');
  const userNickname = computed(() => user.value?.nickname || '');

  function saveAuth(data) {
    user.value = data.user;
    accessToken.value = data.accessToken;
    refreshToken.value = data.refreshToken;
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  function clearAuth() {
    user.value = null;
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async function register({ email, password, nickname }) {
    const data = await authApi.register({ email, password, nickname });
    saveAuth(data);
    return data;
  }

  async function login({ email, password }) {
    const data = await authApi.login({ email, password });
    saveAuth(data);
    return data;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (_) { /* ignore */ }
    clearAuth();
  }

  return {
    user,
    accessToken,
    refreshToken,
    isLoggedIn,
    userEmail,
    userNickname,
    register,
    login,
    logout,
    clearAuth,
  };
});
