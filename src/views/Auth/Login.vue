<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2 class="auth-title">登录</h2>
      <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="form.email" placeholder="请输入邮箱" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" placeholder="请输入密码"
            show-password-on="click" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="handleLogin">
          登录
        </n-button>
      </n-form>
      <div class="auth-footer">
        还没有账号？<router-link to="/register">立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const loading = ref(false);

const form = reactive({
  email: '',
  password: '',
});

const rules = {
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  if (!form.email || !form.password) {
    message.warning('请填写邮箱和密码');
    return;
  }
  loading.value = true;
  try {
    await authStore.login({ email: form.email, password: form.password });
    message.success('登录成功');
    router.push('/admin/dashboard');
  } catch (error) {
    message.error(error.response?.data?.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.auth-card {
  background: var(--n-color, #fff);
  border-radius: 12px;
  padding: 40px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.auth-title {
  text-align: center;
  margin-bottom: 32px;
  font-size: 24px;
  font-weight: 600;
}
.auth-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
}
.auth-footer a {
  color: #667eea;
  text-decoration: none;
}
</style>
