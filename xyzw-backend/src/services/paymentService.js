const crypto = require('crypto');
const paymentModel = require('../models/paymentModel');
const subscriptionModel = require('../models/subscriptionModel');
const { ValidationError } = require('../utils/errors');

const PLANS = {
  monthly: { tier: 'basic', days: 30, amountCents: 500, label: '月卡', maxTokens: 10 },
  quarterly: { tier: 'basic', days: 90, amountCents: 1300, label: '季卡', maxTokens: 10 },
  yearly: { tier: 'basic', days: 365, amountCents: 4500, label: '年卡', maxTokens: 10 },
};

function generateOrderNo() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `XY${timestamp}${random}`.toUpperCase();
}

const paymentService = {
  getPlans() {
    return Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      label: plan.label,
      tier: plan.tier,
      days: plan.days,
      price: plan.amountCents / 100,
      maxTokens: plan.maxTokens,
    }));
  },

  async createOrder(userId, { planId, paymentMethod }) {
    const plan = PLANS[planId];
    if (!plan) {
      throw new ValidationError('无效的套餐');
    }
    if (!['wechat', 'alipay'].includes(paymentMethod)) {
      throw new ValidationError('无效的支付方式');
    }

    const orderNo = generateOrderNo();
    const expireAt = new Date(Date.now() + 30 * 60 * 1000);

    const payment = await paymentModel.create({
      userId,
      orderNo,
      amountCents: plan.amountCents,
      paymentMethod,
      subscriptionTier: plan.tier,
      subscriptionDays: plan.days,
      expireAt,
    });

    // TODO: 对接第三方支付API获取支付URL/二维码
    // const payResult = await thirdPartyPay.create({ orderNo, amount, ... });

    return {
      orderNo: payment.order_no,
      amount: plan.amountCents / 100,
      label: plan.label,
      paymentMethod,
      // payUrl: payResult.payUrl,
      // qrCodeUrl: payResult.qrCodeUrl,
      message: '支付接口待对接，请联系管理员手动激活',
    };
  },

  async handleCallback({ orderNo, tradeNo, status }) {
    const payment = await paymentModel.findByOrderNo(orderNo);
    if (!payment) return false;
    if (payment.payment_status === 'paid') return true;

    if (status === 'success') {
      await paymentModel.updateStatus(orderNo, {
        paymentStatus: 'paid',
        tradeNo,
        paidAt: new Date(),
      });

      const plan = Object.values(PLANS).find(p =>
        p.amountCents === payment.amount_cents && p.tier === payment.subscription_tier
      );

      await subscriptionModel.extendOrCreate(
        payment.user_id,
        payment.subscription_tier,
        plan?.maxTokens || 10,
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

  async getPaymentHistory(userId, { limit, offset } = {}) {
    return paymentModel.findByUserId(userId, { limit, offset });
  },
};

module.exports = paymentService;
