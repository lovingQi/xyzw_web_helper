const { ValidationError } = require('../../../utils/errors');
const mockProvider = require('./mockProvider');

function createPendingProvider(name, label) {
  return {
    name,
    async createOrder() {
      throw new ValidationError(`${label} 支付 Provider 尚未接入，请先配置商户参数并实现签名/下单逻辑`);
    },
    verifyNotify() {
      throw new ValidationError(`${label} 支付 Provider 尚未接入，请先实现回调验签逻辑`);
    },
  };
}

const providers = {
  mock: mockProvider,
  xunhupay: createPendingProvider('xunhupay', '虎皮椒'),
  payjs: createPendingProvider('payjs', 'PayJS'),
};

function getProvider(name = 'mock') {
  const key = String(name || 'mock').toLowerCase();
  const provider = providers[key];
  if (!provider) {
    throw new ValidationError(`未知支付 Provider: ${name}`);
  }
  return provider;
}

function listProviders() {
  return Object.keys(providers);
}

module.exports = {
  getProvider,
  listProviders,
};
