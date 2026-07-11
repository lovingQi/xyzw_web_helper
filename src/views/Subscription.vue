<template>
  <div class="subscription-page">
    <section class="page-header">
      <div>
        <h1>订阅套餐</h1>
        <p>查看当前套餐、Token 上限和任务调度权限。</p>
      </div>
      <router-link to="/admin/tokens" class="back-link">返回 Token 管理</router-link>
    </section>

    <section class="current-band">
      <div class="current-item">
        <span>当前套餐</span>
        <strong>{{ subscriptionStore.tierLabel }}</strong>
      </div>
      <div class="current-item">
        <span>Token 上限</span>
        <strong>{{ subscriptionStore.maxTokens }} 个</strong>
      </div>
      <div class="current-item">
        <span>任务调度</span>
        <strong>{{ subscriptionStore.taskScheduling ? "已开启" : "未开启" }}</strong>
      </div>
      <div class="current-item">
        <span>到期时间</span>
        <strong>{{ expiresText }}</strong>
      </div>
    </section>

    <section class="plans-section">
      <n-spin :show="subscriptionStore.plansLoading">
        <div class="plans-grid">
          <article v-for="plan in subscriptionStore.plans" :key="plan.id" class="plan-card">
            <div class="plan-top">
              <h2>{{ plan.label }}</h2>
              <span>{{ plan.days }} 天</span>
            </div>
            <div class="price">¥{{ estimatePlanAmount(plan) }}</div>
            <div class="token-picker">
              <span>Token 数量</span>
              <n-input-number
                v-model:value="selectedTokenCounts[plan.id]"
                :min="plan.minTokens || 1"
                :max="plan.maxTokensLimit || 50"
                :step="1"
                button-placement="both"
              />
            </div>
            <div class="plan-meta">
              <span>基础包含 {{ plan.includedTokens || 1 }} 个 Token</span>
              <span>额外 Token：1-2 个 ¥2/个/月，第 3 个起 ¥1/个/月</span>
              <span>当前额外 {{ getExtraTokens(plan) }} 个 Token</span>
              <span>任务调度已开启</span>
            </div>
            <n-button
              type="primary"
              block
              :loading="creatingPlanId === plan.id"
              @click="createOrder(plan.id)"
            >
              创建订单
            </n-button>
          </article>
        </div>
      </n-spin>
    </section>

    <n-modal v-model:show="showOrderModal" preset="card" title="支付订单" class="order-modal">
      <div v-if="createdOrder" class="order-info">
        <div><span>订单号</span><strong>{{ createdOrder.orderNo }}</strong></div>
        <div><span>套餐</span><strong>{{ createdOrder.label }}</strong></div>
        <div><span>Token 数量</span><strong>{{ createdOrder.maxTokens }} 个</strong></div>
        <div><span>额外 Token</span><strong>{{ createdOrder.extraTokens }} 个</strong></div>
        <div><span>金额</span><strong>¥{{ createdOrder.amount }}</strong></div>
        <n-alert type="info" :bordered="false">
          {{ createdOrder.message || "请根据支付页面完成付款。" }}
        </n-alert>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useMessage } from 'naive-ui';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const message = useMessage();
const subscriptionStore = useSubscriptionStore();
const creatingPlanId = ref('');
const showOrderModal = ref(false);
const createdOrder = ref(null);
const selectedTokenCounts = ref({});

const expiresText = computed(() => {
  if (!subscriptionStore.expiresAt) return '无';
  return new Date(subscriptionStore.expiresAt).toLocaleString();
});

function calculateExtraMonthlyPrice(extraTokens) {
  if (extraTokens <= 0) return 0;
  if (extraTokens <= 2) return extraTokens * 2;
  return 4 + (extraTokens - 2);
}

function getSelectedTokens(plan) {
  return selectedTokenCounts.value[plan.id] || plan.includedTokens || 1;
}

function getExtraTokens(plan) {
  return Math.max(getSelectedTokens(plan) - (plan.includedTokens || 1), 0);
}

function estimatePlanAmount(plan) {
  const baseMonthlyPrice = plan.pricingRules?.baseMonthlyPrice || 5;
  const monthlyPrice = baseMonthlyPrice + calculateExtraMonthlyPrice(getExtraTokens(plan));
  return Math.round(monthlyPrice * (plan.months || 1) * (plan.discount || 1));
}

async function createOrder(planId) {
  const plan = subscriptionStore.plans.find(item => item.id === planId);
  creatingPlanId.value = planId;
  try {
    createdOrder.value = await subscriptionStore.createOrder({
      planId,
      paymentMethod: 'wechat',
      maxTokens: plan ? getSelectedTokens(plan) : 1,
    });
    showOrderModal.value = true;
    message.success('订单已创建');
  } catch (error) {
    message.error(error.response?.data?.message || '创建订单失败');
  } finally {
    creatingPlanId.value = '';
  }
}

onMounted(async () => {
  await Promise.all([
    subscriptionStore.fetchCurrent(),
    subscriptionStore.fetchPlans(),
  ]);
  subscriptionStore.plans.forEach((plan) => {
    selectedTokenCounts.value[plan.id] = plan.includedTokens || 1;
  });
});
</script>

<style scoped>
.subscription-page {
  min-height: 100vh;
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 32px;
}

.page-header {
  max-width: 1100px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.page-header p {
  margin: 0;
  color: var(--text-secondary);
}

.back-link {
  color: var(--primary-color);
  text-decoration: none;
}

.current-band,
.plans-grid {
  max-width: 1100px;
  margin: 0 auto;
}

.current-band {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.current-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.current-item span,
.plan-meta {
  color: var(--text-secondary);
  font-size: 13px;
}

.current-item strong {
  font-size: 18px;
}

.plans-section {
  margin-top: 24px;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.plan-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 20px;
}

.plan-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plan-top h2 {
  margin: 0;
  font-size: 20px;
}

.plan-top span {
  color: var(--text-secondary);
}

.price {
  margin: 20px 0;
  font-size: 34px;
  font-weight: 700;
}

.token-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.token-picker span {
  color: var(--text-secondary);
  font-size: 13px;
}

.plan-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.order-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.order-info div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

@media (max-width: 768px) {
  .subscription-page {
    padding: 20px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .current-band,
  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>
