<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2 class="auth-title">注册</h2>
      <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleRegister">
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="form.email" placeholder="请输入邮箱" />
        </n-form-item>
        <n-form-item label="昵称" path="nickname">
          <n-input v-model:value="form.nickname" placeholder="请输入昵称（选填）" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" placeholder="请输入密码（至少6位）"
            show-password-on="click" />
        </n-form-item>
        <n-form-item label="确认密码" path="confirmPassword">
          <n-input v-model:value="form.confirmPassword" type="password" placeholder="请再次输入密码"
            show-password-on="click" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="handleRegister">
          注册
        </n-button>
      </n-form>
      <div class="auth-footer">
        已有账号？<router-link to="/login">立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage } from 'naive-ui';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const loading = ref(false);
const formRef = ref(null);

const form = reactive({
  email: '',
  nickname: '',
  password: '',
  confirmPassword: '',
});

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    {
      type: 'email',
      message: '请输入正确的邮箱格式',
      trigger: ['blur', 'input'],
    },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: ['blur', 'input'] },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_, value) => value === form.password,
      message: '两次密码输入不一致',
      trigger: ['blur', 'input'],
    },
  ],
};

async function handleRegister() {
  try {
    await formRef.value?.validate();
  } catch (_) {
    return;
  }

  loading.value = true;
  try {
    await authStore.register({
      email: form.email,
      password: form.password,
      nickname: form.nickname || undefined,
    });
    await subscriptionStore.fetchCurrent().catch(() => {});
    message.success('注册成功');
    router.push('/admin/dashboard');
  } catch (error) {
    message.error(error.response?.data?.message || '注册失败');
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
  color: #1f2937 !important;
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
  color: #1f2937 !important;
}
.auth-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #4b5563 !important;
}
.auth-footer a {
  color: #667eea !important;
  text-decoration: none;
}

.auth-card :deep(.n-form-item-label),
.auth-card :deep(.n-form-item-label__text) {
  color: #374151 !important;
}

.auth-card :deep(.n-input),
.auth-card :deep(.n-input-wrapper) {
  background-color: #ffffff !important;
  color: #1f2937 !important;
}

.auth-card :deep(.n-input__input),
.auth-card :deep(.n-input__input-el) {
  color: #1f2937 !important;
}

.auth-card :deep(.n-input__placeholder),
.auth-card :deep(input::placeholder) {
  color: #9ca3af !important;
}
</style>
