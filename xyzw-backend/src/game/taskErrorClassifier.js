const RULES = [
  { code: '1500020', type: 'normal_end', message: '能量不足', action: 'stop' },
  { code: '1500040', type: 'recoverable', message: '上座塔奖励未领取', action: 'claim_tower_reward' },
  { code: '200400', type: 'retryable', message: '操作过快', action: 'wait_retry' },
  { code: '2300070', type: 'normal_skip', message: '未加入俱乐部', action: 'skip' },
  { code: '200160', type: 'normal_skip', message: '模块未开启', action: 'skip' },
  { code: '3500020', type: 'normal_skip', message: '没有可领取的奖励', action: 'skip' },
  { code: '12000116', type: 'normal_skip', message: '今日已领取免费奖励', action: 'skip' },
  { code: '2300190', type: 'normal_skip', message: '今天已经签到过了', action: 'skip' },
  { code: '400190', type: 'normal_skip', message: '没有可领取的签到奖励', action: 'skip' },
  { code: '400122', type: 'normal_end', message: '宝箱数量已发生变化', action: 'stop' },
  { code: '1000020', type: 'normal_skip', message: '今天已经领取过奖励了', action: 'skip' },
  { code: '200120', type: 'normal_skip', message: '已经领取过奖励了', action: 'skip' },
  { code: '700010', type: 'normal_skip', message: '任务未达成完成条件', action: 'skip' },
  { code: '700020', type: 'normal_skip', message: '已经领取过这个任务', action: 'skip' },
  { code: '12000050', type: 'normal_end', message: '今日发车次数已达上限', action: 'stop' },
  { code: '12000060', type: 'normal_skip', message: '不在发车时间内', action: 'skip' },
  { code: '2300250', type: 'normal_end', message: '俱乐部BOSS今日攻打次数已用完', action: 'stop' },
  { code: '3300050', type: 'normal_end', message: '购买数量超出限制', action: 'stop' },
  { code: '7900023', type: 'normal_end', message: '已达到使用次数上限', action: 'stop' },
  { code: '1500010', type: 'normal_end', message: '已经全部通关', action: 'stop' },
];

function extractErrorCode(errorOrMessage) {
  const message = typeof errorOrMessage === 'string'
    ? errorOrMessage
    : errorOrMessage?.message || '';
  const match = message.match(/\b\d{5,}\b/);
  return match ? match[0] : null;
}

function classifyTaskError(errorOrMessage) {
  const message = typeof errorOrMessage === 'string'
    ? errorOrMessage
    : errorOrMessage?.message || '';
  const code = extractErrorCode(message);
  const rule = code ? RULES.find((item) => item.code === code) : null;
  if (rule) {
    return {
      ...rule,
      code,
      rawMessage: message,
      isKnown: true,
      isNormal: rule.type === 'normal_end' || rule.type === 'normal_skip',
      isRetryable: rule.type === 'retryable',
      isRecoverable: rule.type === 'recoverable',
    };
  }
  return {
    code,
    type: 'failure',
    message: message || '未知错误',
    action: 'fail',
    rawMessage: message,
    isKnown: false,
    isNormal: false,
    isRetryable: false,
    isRecoverable: false,
  };
}

module.exports = {
  RULES,
  extractErrorCode,
  classifyTaskError,
};
