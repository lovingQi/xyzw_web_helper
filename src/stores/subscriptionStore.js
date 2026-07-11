import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { subscriptionApi } from '@/api/subscription';
import { paymentsApi } from '@/api/payments';

const PLAN_LABELS = {
  free: '免费版',
  basic: '基础版',
};

export const useSubscriptionStore = defineStore('subscription', () => {
  const current = ref(null);
  const plans = ref([]);
  const loading = ref(false);
  const plansLoading = ref(false);
  const error = ref('');

  const tier = computed(() => current.value?.tier || 'free');
  const tierLabel = computed(() => PLAN_LABELS[tier.value] || tier.value);
  const maxTokens = computed(() => current.value?.maxTokens ?? 2);
  const taskScheduling = computed(() => !!current.value?.taskScheduling);
  const expiresAt = computed(() => current.value?.expiresAt || null);

  async function fetchCurrent() {
    loading.value = true;
    error.value = '';
    try {
      current.value = await subscriptionApi.getCurrent();
      return current.value;
    } catch (err) {
      error.value = err.response?.data?.message || '套餐信息加载失败';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPlans() {
    plansLoading.value = true;
    try {
      plans.value = await subscriptionApi.getPlans();
      return plans.value;
    } finally {
      plansLoading.value = false;
    }
  }

  async function createOrder({ planId, paymentMethod }) {
    return paymentsApi.createOrder({ planId, paymentMethod });
  }

  function clear() {
    current.value = null;
    plans.value = [];
    error.value = '';
  }

  return {
    current,
    plans,
    loading,
    plansLoading,
    error,
    tier,
    tierLabel,
    maxTokens,
    taskScheduling,
    expiresAt,
    fetchCurrent,
    fetchPlans,
    createOrder,
    clear,
  };
});
