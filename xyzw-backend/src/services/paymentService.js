const crypto = require('crypto');
const config = require('../config');
const paymentModel = require('../models/paymentModel');
const subscriptionModel = require('../models/subscriptionModel');
const { ValidationError } = require('../utils/errors');
const { getProvider, listProviders } = require('./payments/providers');

const INCLUDED_TOKENS = 1;
const MIN_TOKENS = 1;
const MAX_TOKENS = 50;

const PLAN_PERIODS = {
  monthly: { tier: 'basic', days: 30, label: '月卡', months: 1, discount: 1 },
  quarterly: { tier: 'basic', days: 90, label: '季卡', months: 3, discount: 0.9 },
  yearly: { tier: 'basic', days: 365, label: '年卡', months: 12, discount: 0.8 },
};

function generateOrderNo() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `XY${timestamp}${random}`.toUpperCase();
}

function calculateExtraMonthlyPrice(extraTokens) {
  if (extraTokens <= 0) return 0;
  if (extraTokens <= 2) return extraTokens * 2;
  return 4 + (extraTokens - 2);
}

function calculatePlanPrice({ planId, maxTokens }) {
  const plan = PLAN_PERIODS[planId];
  if (!plan) {
    throw new ValidationError('无效的套餐');
  }

  const parsedTokens = Number(maxTokens);
  if (!Number.isInteger(parsedTokens) || parsedTokens < MIN_TOKENS || parsedTokens > MAX_TOKENS) {
    throw new ValidationError(`Token 数量必须是 ${MIN_TOKENS}-${MAX_TOKENS} 的整数`);
  }

  const extraTokens = Math.max(parsedTokens - INCLUDED_TOKENS, 0);
  const monthlyPrice = 5 + calculateExtraMonthlyPrice(extraTokens);
  const amount = Math.round(monthlyPrice * plan.months * plan.discount);

  return {
    plan,
    maxTokens: parsedTokens,
    extraTokens,
    monthlyPrice,
    amount,
    amountCents: amount * 100,
  };
}

const paymentService = {
  getPlans() {
    return Object.entries(PLAN_PERIODS).map(([key, plan]) => ({
      id: key,
      label: plan.label,
      tier: plan.tier,
      days: plan.days,
      basePrice: calculatePlanPrice({ planId: key, maxTokens: INCLUDED_TOKENS }).amount,
      includedTokens: INCLUDED_TOKENS,
      minTokens: MIN_TOKENS,
      maxTokensLimit: MAX_TOKENS,
      months: plan.months,
      discount: plan.discount,
      pricingRules: {
        baseMonthlyPrice: 5,
        extraTokenTiers: [
          { from: 1, to: 2, monthlyPrice: 2 },
          { from: 3, to: null, monthlyPrice: 1 },
        ],
      },
    }));
  },

  getProviderInfo() {
    return {
      current: config.payment.provider,
      available: listProviders(),
      mockEnabled: config.payment.mockEnabled,
    };
  },

  async createOrder(userId, { planId, paymentMethod, maxTokens = INCLUDED_TOKENS }) {
    if (!['wechat', 'alipay'].includes(paymentMethod)) {
      throw new ValidationError('无效的支付方式');
    }

    const price = calculatePlanPrice({ planId, maxTokens });
    const { plan } = price;
    const orderNo = generateOrderNo();
    const expireAt = new Date(Date.now() + 30 * 60 * 1000);

    const payment = await paymentModel.create({
      userId,
      orderNo,
      amountCents: price.amountCents,
      paymentMethod,
      subscriptionTier: plan.tier,
      subscriptionDays: plan.days,
      expireAt,
      maxTokens: price.maxTokens,
      extraTokens: price.extraTokens,
    });

    const provider = getProvider(config.payment.provider);
    return provider.createOrder({
      payment,
      price,
      plan,
      paymentMethod,
      config,
    });
  },

  async applyPaymentResult({ orderNo, tradeNo, status }) {
    const payment = await paymentModel.findByOrderNo(orderNo);
    if (!payment) return false;
    if (payment.payment_status === 'paid') return true;

    if (status === 'success') {
      await paymentModel.updateStatus(orderNo, {
        paymentStatus: 'paid',
        tradeNo,
        paidAt: new Date(),
      });

      await subscriptionModel.extendOrCreate(
        payment.user_id,
        payment.subscription_tier,
        payment.max_tokens || INCLUDED_TOKENS,
        payment.subscription_days,
        payment.id
      );

      return true;
    }

    await paymentModel.updateStatus(orderNo, {
      paymentStatus: 'failed',
      tradeNo,
      paidAt: null,
    });
    return false;
  },

  async handleCallback({ body, query, headers }) {
    const provider = getProvider(config.payment.provider);
    const verified = provider.verifyNotify({ body, query, headers, config });
    return this.applyPaymentResult(verified);
  },

  async getPaymentHistory(userId, { limit, offset } = {}) {
    const payments = await paymentModel.findByUserId(userId, { limit, offset });
    return payments.map((payment) => ({
      ...payment,
      provider: config.payment.provider,
    }));
  },

  calculatePlanPrice,
};

module.exports = paymentService;
