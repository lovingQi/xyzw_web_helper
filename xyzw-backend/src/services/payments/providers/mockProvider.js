const { ValidationError } = require('../../../utils/errors');

function assertMockEnabled(config) {
  if (config.env === 'production' && !config.payment.mockEnabled) {
    throw new ValidationError('生产环境未启用模拟支付，请配置真实支付服务商');
  }
}

const mockProvider = {
  name: 'mock',

  async createOrder({ payment, price, plan, paymentMethod, config }) {
    assertMockEnabled(config);

    return {
      provider: this.name,
      orderNo: payment.order_no,
      amount: price.amount,
      amountCents: price.amountCents,
      label: plan.label,
      paymentMethod,
      maxTokens: price.maxTokens,
      extraTokens: price.extraTokens,
      expiresAt: payment.expire_at,
      payUrl: null,
      qrCodeUrl: null,
      message: '当前为模拟支付模式：可用 /api/payments/notify 模拟回调，或联系管理员手动激活。',
    };
  },

  verifyNotify({ body = {}, config }) {
    assertMockEnabled(config);

    const orderNo = body.orderNo || body.order_no;
    if (!orderNo) {
      throw new ValidationError('缺少订单号');
    }

    return {
      orderNo,
      tradeNo: body.tradeNo || body.trade_no || `MOCK-${orderNo}`,
      status: body.status === 'success' || body.paymentStatus === 'paid' ? 'success' : 'failed',
      raw: body,
    };
  },
};

module.exports = mockProvider;
