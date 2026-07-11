/**
 * 后端任务执行器
 * 基于前端 dailyTaskRunner.js 改造，去掉 Vue/Pinia/localStorage 依赖
 * 接收 wsClient 实例，纯异步函数，返回结果对象
 */

const pickArenaTargetId = (targets) => {
  if (!targets) return null;
  if (Array.isArray(targets)) {
    const c = targets[0];
    return c?.roleId || c?.id || c?.targetId;
  }
  const c = targets?.rankList?.[0] || targets?.roleList?.[0] ||
    targets?.targets?.[0] || targets?.targetList?.[0] || targets?.list?.[0];
  if (c) return c.roleId || c.id || c.targetId;
  return targets?.roleId || targets?.id || targets?.targetId;
};

const isTodayAvailable = (statisticsTime) => {
  if (!statisticsTime) return true;
  const today = new Date().toDateString();
  const recordDate = new Date(statisticsTime * 1000).toDateString();
  return today !== recordDate;
};

const getTodayBossId = () => {
  const DAY_BOSS_MAP = [9904, 9905, 9901, 9902, 9903, 9904, 9905];
  return DAY_BOSS_MAP[new Date().getDay()];
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const { LEGACY_TASK_ALIASES } = require('./batchTaskDefinitions');
const { classifyTaskError } = require('./taskErrorClassifier');

class SkipTaskError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SkipTaskError';
  }
}

class TaskRunner {
  constructor(wsClient, settings = {}) {
    this.ws = wsClient;
    this.settings = {
      commandDelay: 500,
      taskDelay: 500,
      arenaFormation: 1,
      bossFormation: 1,
      bossTimes: 2,
      claimBottle: true,
      payRecruit: true,
      openBox: true,
      arenaEnable: true,
      claimHangUp: true,
      claimEmail: true,
      freeGachaEnable: true,
      addHangUpTime: true,
      restartBottle: true,
      claimDailyGifts: true,
      claimCollection: true,
      freeFishing: true,
      genieSweep: true,
      blackMarketPurchase: true,
      dreamDungeon: true,
      claimTaskPoints: true,
      claimWeeklyReward: true,
      claimWarOrder: true,
      boxCount: 100,
      fishCount: 100,
      recruitCount: 100,
      defaultBoxType: 2001,
      defaultFishType: 1,
      targetBoxPoints: 1000,
      towerFormation: 1,
      weirdTowerMaxClimb: 10,
      legionBossEnable: true,
      ...settings,
    };
    this.logs = [];
  }

  log(message, type = 'info') {
    this.logs.push({
      time: new Date().toISOString(),
      message,
      type,
    });
  }

  async exec(cmd, params = {}, description = '', timeout = 8000) {
    const sentAt = new Date().toISOString();
    try {
      if (description) this.log(`执行: ${description}`);
      const result = await this.ws.sendWithPromise(cmd, params, timeout);
      await delay(this.settings.commandDelay);
      if (description) this.log(`${description} - 成功`, 'success');
      return result;
    } catch (error) {
      if (description) this.log(`${description} - 失败: ${error.message}`, 'error');
      this.logDiagnostics(cmd, sentAt);
      throw error;
    }
  }

  async tolerate(fn, description = '') {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SkipTaskError) throw error;
      if (description) {
        this.log(`${description} - 容错继续: ${error.message}`, 'warning');
      }
      return null;
    }
  }

  async execOptionalNoResponse(cmd, params = {}, description = '', timeout = 5000, options = {}) {
    try {
      return await this.exec(cmd, params, description, timeout);
    } catch (error) {
      const classified = classifyTaskError(error);
      if (classified.isNormal) {
        this.log(`${description || cmd} - ${classified.message}，正常跳过`, 'success');
        return null;
      }
      if (Array.isArray(options.normalErrorCodes) && classified.code && options.normalErrorCodes.includes(classified.code)) {
        this.log(`${description || cmd} - ${classified.message}，按当前任务正常跳过`, 'success');
        return null;
      }
      if (error.message?.includes('Request timeout')) {
        this.log(`${description || cmd} - 命令已发出但未收到业务响应，按待确认跳过`, 'warning');
        return null;
      }
      throw error;
    }
  }

  logDiagnostics(cmd, since) {
    if (!this.ws?.getDiagnostics) return;
    const diagnostics = this.ws.getDiagnostics();
    const lastReceived = diagnostics.lastReceivedMessages
      ?.map((item) => item.cmd)
      .join(', ') || '无';
    const lastSent = diagnostics.lastSentCommands
      ?.map((item) => item.cmd)
      .join(', ') || '无';
    this.log(`诊断[${cmd}]: 最近发送=${lastSent}; 最近收到=${lastReceived}`, 'warning');
    if (diagnostics.lastClose) {
      this.log(`诊断[${cmd}]: 最近关闭 code=${diagnostics.lastClose.code}, reason=${diagnostics.lastClose.reason || 'none'}`, 'warning');
    }
    if (diagnostics.lastError) {
      this.log(`诊断[${cmd}]: 最近错误 ${diagnostics.lastError.message}`, 'warning');
    }
    const postCommandMessages = diagnostics.lastReceivedMessages
      ?.filter((item) => item.at >= since && item.cmd !== '_sys/ack')
      .map((item) => item.cmd);
    if (postCommandMessages?.length) {
      this.log(`抓包[${cmd}]: 命令发出后收到=${postCommandMessages.join(', ')}`, 'warning');
    } else {
      this.log(`抓包[${cmd}]: 命令发出后未收到非心跳业务消息`, 'warning');
    }
  }

  skip(message) {
    this.log(message, 'success');
    throw new SkipTaskError(message);
  }

  async switchFormation(targetFormation, formationName = '阵容') {
    try {
      const teamInfo = await this.exec('presetteam_getinfo', {}, '获取阵容信息');
      const current = teamInfo?.presetTeamInfo?.useTeamId;
      this.log(`${formationName}: 当前阵容=${current ?? '未知'}, 目标阵容=${targetFormation}`);
      if (current === targetFormation) return false;
      const saveResp = await this.exec('presetteam_saveteam', { teamId: targetFormation }, `切换到${formationName}${targetFormation}`);
      this.log(`${formationName}: 保存阵容响应=${JSON.stringify(saveResp || {})}`);
      return true;
    } catch (error) {
      try {
        const forceResp = await this.exec('presetteam_saveteam', { teamId: targetFormation }, `强制切换到${formationName}${targetFormation}`);
        this.log(`${formationName}: 强制保存阵容响应=${JSON.stringify(forceResp || {})}`);
        return true;
      } catch (_) {
        throw error;
      }
    }
  }

  createResult() {
    return { success: false, tasksRun: 0, tasksFailed: 0, logs: this.logs };
  }

  async runSteps(steps, result = this.createResult()) {
    if (!steps.length) {
      result.error = '没有可执行的任务';
      this.log(result.error, 'error');
      result.logs = this.logs;
      return result;
    }

    for (const step of steps) {
      try {
        await step.fn();
        result.tasksRun++;
      } catch (error) {
        if (error instanceof SkipTaskError) {
          result.tasksRun++;
        } else {
          const classified = classifyTaskError(error);
          if (classified.isNormal) {
            this.log(`任务[${step.name}]正常结束: ${classified.message}`, 'success');
            result.tasksRun++;
          } else {
            result.tasksFailed++;
            this.log(`任务[${step.name}]失败: ${error.message}`, 'error');
          }
        }
      }
      await delay(this.settings.taskDelay);
    }

    result.success = result.tasksFailed === 0;
    if (result.tasksFailed > 0) {
      result.error = `${result.tasksFailed} 个任务失败`;
    }
    result.logs = this.logs;
    return result;
  }

  handleNormalClassifiedError(error, context) {
    const classified = classifyTaskError(error);
    if (classified.isNormal) {
      this.log(`${context}: ${classified.message}，正常结束`, 'success');
      return true;
    }
    return false;
  }

  async batchOpenBox(boxType = this.settings.defaultBoxType, totalCount = this.settings.boxCount) {
    const count = Math.max(0, Number(totalCount || 0));
    if (!count) this.skip('开箱数量为0，跳过');
    this.log(`批量开箱: itemId=${boxType}, count=${count}`);
    await this.repeatByBatch(count, 10, (number, idx) =>
      this.exec('item_openbox', { itemId: boxType, number }, `批量开箱 ${idx}/${Math.ceil(count / 10)}`, 8000)
    );
    await this.tolerate(() => this.exec('item_batchclaimboxpointreward', {}, '领取宝箱积分'), '领取宝箱积分');
  }

  async batchFish(fishType = this.settings.defaultFishType, totalCount = this.settings.fishCount) {
    const count = Math.max(0, Number(totalCount || 0));
    if (!count) this.skip('钓鱼数量为0，跳过');
    this.log(`批量钓鱼: type=${fishType}, count=${count}`);
    await this.repeatByBatch(count, 10, (number, idx) =>
      this.exec('artifact_lottery', { type: fishType, lotteryNumber: number, newFree: true }, `批量钓鱼 ${idx}/${Math.ceil(count / 10)}`, 8000)
    );
    await this.tolerate(() => this.exec('artifact_exchange', {}, '领取钓鱼累计奖励'), '领取钓鱼累计奖励');
  }

  async batchRecruit(totalCount = this.settings.recruitCount) {
    const count = Math.max(0, Number(totalCount || 0));
    if (!count) this.skip('招募数量为0，跳过');
    await this.repeatByBatch(count, 10, (number, idx) =>
      this.exec('hero_recruit', { recruitType: 1, recruitNumber: number }, `批量招募 ${idx}/${Math.ceil(count / 10)}`, 8000)
    );
  }

  async repeatByBatch(totalCount, batchSize, fn) {
    const batches = Math.floor(totalCount / batchSize);
    const remainder = totalCount % batchSize;
    for (let i = 0; i < batches; i++) {
      await fn(batchSize, i + 1);
    }
    if (remainder > 0) {
      await fn(remainder, batches + 1);
    }
  }

  async runBaoku(minTower, maxTower, includeBoxes) {
    const info = await this.exec('bosstower_getinfo', {}, '获取宝库信息', 8000);
    const towerId = Number(info?.bossTower?.towerId || info?.rawData?.bossTower?.towerId || 0);
    if (towerId < minTower || towerId > maxTower) {
      this.skip(`当前宝库层数 ${towerId || '未知'} 不在 ${minTower}-${maxTower} 层，跳过`);
    }
    for (let i = 0; i < 2; i++) {
      await this.exec('bosstower_startboss', {}, `宝库打Boss ${i + 1}/2`, 10000);
    }
    if (includeBoxes) {
      for (let i = 0; i < 9; i++) {
        await this.exec('bosstower_startbox', {}, `宝库开箱 ${i + 1}/9`, 10000);
      }
    }
  }

  async runTower(maxCount = 100) {
    await this.switchFormation(this.settings.towerFormation, '爬塔阵容');
    await this.tolerate(() => this.exec('tower_getinfo', {}, '获取爬塔信息'), '获取爬塔信息');
    let roleInfo = await this.tolerate(() => this.exec('role_getroleinfo', {}, '获取角色信息'), '获取角色信息');
    let completed = 0;
    let consecutiveFailures = 0;
    while (completed < maxCount) {
      try {
        await this.exec('fight_starttower', {}, `爬塔 ${completed + 1}/${maxCount}`, 8000);
        completed++;
        consecutiveFailures = 0;
      } catch (error) {
        const classified = classifyTaskError(error);
        if (classified.action === 'wait_retry') {
          this.log('爬塔操作过快，等待5秒后重试', 'warning');
          await delay(5000);
          continue;
        }

        if (classified.action === 'claim_tower_reward') {
          this.log('上座塔奖励未领取，尝试自动领取后继续', 'warning');
          roleInfo = roleInfo || await this.tolerate(() => this.exec('role_getroleinfo', {}, '刷新角色信息'), '刷新角色信息');
          const towerId = roleInfo?.role?.tower?.id || roleInfo?.rawData?.role?.tower?.id;
          const rewardFloor = Math.floor(Number(towerId || 0) / 10);
          if (rewardFloor > 0) {
            await this.tolerate(
              () => this.exec('tower_claimreward', { rewardId: rewardFloor }, `领取第${rewardFloor}层爬塔奖励`, 8000),
              `领取第${rewardFloor}层爬塔奖励`
            );
          } else {
            this.log(`无法从角色信息识别奖励层数: towerId=${towerId ?? '未知'}`, 'warning');
          }
          await delay(3000);
          roleInfo = await this.tolerate(() => this.exec('role_getroleinfo', {}, '刷新角色信息'), '刷新角色信息');
          consecutiveFailures = 0;
          continue;
        }

        if (classified.isNormal) {
          this.log(`爬塔${classified.message}，正常结束`, 'success');
          break;
        }

        consecutiveFailures++;
        if (consecutiveFailures >= 3) throw error;
        this.log(`爬塔失败，等待2秒后重试: ${error.message}`, 'warning');
        await delay(2000);
      }
    }
    this.log(`爬塔结束，共执行 ${completed} 次`, 'success');
  }

  async runWeirdTower(maxCount = this.settings.weirdTowerMaxClimb) {
    await this.switchFormation(this.settings.towerFormation, '怪异塔阵容');
    await this.tolerate(() => this.exec('evotower_getinfo', {}, '获取怪异塔信息'), '获取怪异塔信息');
    const count = Math.max(1, Number(maxCount || 10));
    for (let i = 0; i < count; i++) {
      await this.exec('evotower_fight', {}, `怪异塔挑战 ${i + 1}/${count}`, 12000);
    }
  }

  async runOpenBoxByPoints() {
    const targetPoints = Math.max(0, Number(this.settings.targetBoxPoints || 0));
    if (!targetPoints) this.skip('目标积分为0，跳过按积分开箱');
    const roleInfo = await this.exec('role_getroleinfo', {}, '获取箱子库存', 12000);
    const role = roleInfo?.rawData?.role || roleInfo?.role || {};
    const items = role.items || {};
    const boxes = [
      { id: 2004, points: 50, reserve: 0 },
      { id: 2003, points: 20, reserve: 0 },
      { id: 2002, points: 10, reserve: 0 },
      { id: 2001, points: 1, reserve: 200 },
    ];
    let remaining = targetPoints;
    for (const box of boxes) {
      const owned = Number(items?.[box.id]?.quantity || 0);
      const available = Math.max(owned - box.reserve, 0);
      const need = Math.ceil(remaining / box.points);
      const toOpen = Math.min(available, need);
      const batchCount = Math.floor(toOpen / 10) * 10;
      if (batchCount > 0) {
        await this.batchOpenBox(box.id, batchCount);
        remaining -= batchCount * box.points;
      }
      if (remaining <= 0) break;
    }
    if (remaining > 0) {
      throw new Error(`箱子积分不足，仍缺 ${remaining}`);
    }
  }

  async runSmartSendCar() {
    const res = await this.exec('car_getrolecar', {}, '获取车辆信息', 12000);
    const cars = this.normalizeCars(res?.body || res);
    let sent = 0;
    for (const car of cars) {
      if (Number(car.sendAt || 0) !== 0) continue;
      const carId = String(car.id || car.carId || '');
      if (!carId) continue;
      await this.exec('car_send', { carId, helperId: car.helperId ? String(car.helperId) : 0, text: '', isUpgrade: false }, `发车 ${carId}`, 12000);
      sent++;
    }
    if (!sent) this.skip('没有待发车辆');
  }

  async runClaimCars() {
    const res = await this.exec('car_getrolecar', {}, '获取车辆信息', 12000);
    const cars = this.normalizeCars(res?.body || res);
    let claimed = 0;
    const now = Date.now();
    for (const car of cars) {
      const carId = String(car.id || car.carId || '');
      const sendAt = Number(car.sendAt || 0);
      if (!carId || !sendAt) continue;
      const elapsedMs = sendAt > 1e12 ? now - sendAt : now - sendAt * 1000;
      if (elapsedMs < 4 * 60 * 60 * 1000) continue;
      await this.exec('car_claim', { carId }, `收车 ${carId}`, 12000);
      claimed++;
      await this.tolerate(() => this.exec('car_research', { researchId: 1 }, '车辆改装升级'), '车辆改装升级');
      await this.tolerate(() => this.exec('car_claimpartconsumereward', {}, '领取车辆改装累计奖励'), '领取车辆改装累计奖励');
    }
    if (!claimed) this.skip('没有可收取车辆');
  }

  normalizeCars(payload) {
    const data = payload?.roleCar || payload?.car || payload;
    const raw = data?.cars || data?.carList || data?.list || data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
    return [];
  }

  async runBatchTaskValue(taskValue) {
    const mapped = LEGACY_TASK_ALIASES[taskValue] || taskValue;
    const s = this.settings;
    const dailyTypeMap = {
      claimHangUpRewards: 'hangup',
      batchAddHangUpTime: 'hangup_time',
      resetBottles: 'bottle_timer',
      batchlingguanzi: 'bottle',
      batchclubsign: 'legion_signin',
      batcharenafight: 'arena',
      store_purchase: 'black_market',
      collection_claimfreereward: 'collection',
      batchGenieSweep: 'genie',
      mail: 'mail',
      gacha: 'gacha',
      recruit: 'recruit',
      buygold: 'buygold',
      daily_share: 'daily_share',
      friend: 'friend',
      daily_reward: 'daily_reward',
      daily_point: 'daily_point',
      weekly_reward: 'weekly_reward',
      war_order: 'war_order',
      legion_boss: 'legion_boss',
      daily_gift: 'daily_gift',
      boss: 'boss',
    };

    if (mapped === 'startBatch') return this.runDailyTasks();
    if (dailyTypeMap[mapped]) {
      this.settings = { ...this.settings, onlyTaskTypes: [dailyTypeMap[mapped]] };
      return this.runDailyTasks();
    }

    this.logs = [];
    const result = this.createResult();
    const run = (name, fn) => this.runSteps([{ name, fn }], result);

    switch (mapped) {
      case 'climbTower':
        return run('一键爬塔', () => this.runTower(Number(s.towerMaxClimb || 100)));
      case 'climbWeirdTower':
        return run('一键爬怪异塔', () => this.runWeirdTower());
      case 'batchStudy':
        return run('一键答题', () => this.runStudy());
      case 'batchSmartSendCar':
        return run('智能发车', () => this.runSmartSendCar());
      case 'batchClaimCars':
        return run('一键收车', () => this.runClaimCars());
      case 'batchOpenBox':
        return run('批量开箱', () => this.batchOpenBox(s.defaultBoxType, s.boxCount));
      case 'batchOpenBoxByPoints':
        return run('按积分开箱', () => this.runOpenBoxByPoints());
      case 'batchClaimBoxPointReward':
        return run('领取宝箱积分', () => this.exec('item_batchclaimboxpointreward', {}, '领取宝箱积分', 8000));
      case 'batchFish':
        return run('批量钓鱼', () => this.batchFish(s.defaultFishType, s.fishCount));
      case 'batchRecruit':
        return run('批量招募', () => this.batchRecruit(s.recruitCount));
      case 'batchbaoku13':
        return run('一键宝库前3层', () => this.runBaoku(1, 3, true));
      case 'batchbaoku45':
        return run('一键宝库4,5层', () => this.runBaoku(4, 5, false));
      case 'batchmengjing':
        return run('一键梦境', () => this.exec('dungeon_selecthero', { battleTeam: { 0: 107 } }, '咸王梦境', 8000));
      case 'batchClaimFreeEnergy':
        return run('领取怪异塔免费道具', () => this.exec('mergebox_claimfreeenergy', { actType: 1 }, '领取怪异塔免费道具', 8000));
      case 'skinChallenge':
        return run('一键换皮闯关', () => this.runSkinChallenge());
      case 'legion_storebuygoods':
        return run('购买四圣碎片', () => this.exec('legion_storebuygoods', { id: 6 }, '购买四圣碎片', 8000));
      case 'batchLegacyClaim':
        return run('领取功法残卷', () => this.exec('legacy_claimhangup', {}, '领取功法残卷', 8000));
      case 'batchLegacyGiftSendEnhanced':
        return run('赠送功法残卷', () => this.runLegacyGift());
      case 'batchUseItems':
        return run('使用怪异塔道具', () => this.runMergeBoxUseItems());
      case 'batchMergeItems':
        return run('怪异塔合成', () => this.runMergeBoxMergeItems());
      case 'batchClaimPeachTasks':
        return run('领取蟠桃园任务', () => this.runPeachTasks());
      case 'batchTopUpFish':
        return run('钓鱼补齐', () => this.batchFish(s.defaultFishType, Math.max(Number(s.monthlyFishTarget || 320) - Number(s.monthlyFishDone || 0), 0)));
      case 'batchTopUpArena':
        return run('竞技场补齐', () => this.runArenaTimes(Math.max(Number(s.monthlyArenaTarget || 240) - Number(s.monthlyArenaDone || 0), 0)));
      case 'batchBuyDreamItems':
        return run('购买梦境商品', () => this.runBuyDreamItems());
      default:
        result.error = `任务类型 ${taskValue} 尚未实现`;
        this.log(result.error, 'error');
        result.logs = this.logs;
        return result;
    }
  }

  async runTaskGroup(taskValues) {
    this.logs = [];
    const result = this.createResult();
    const selected = Array.isArray(taskValues) ? taskValues.filter(Boolean) : [];
    if (!selected.length) {
      result.error = '没有选择任务';
      this.log(result.error, 'error');
      result.logs = this.logs;
      return result;
    }

    for (const taskValue of selected) {
      this.log(`开始任务: ${taskValue}`);
      const beforeRun = result.tasksRun;
      const beforeFailed = result.tasksFailed;
      const subRunner = new TaskRunner(this.ws, this.settings);
      const subResult = await subRunner.runBatchTaskValue(taskValue);
      if (Array.isArray(subResult.logs)) {
        this.logs.push(...subResult.logs);
      }
      result.tasksRun += Math.max(0, Number(subResult.tasksRun || 0));
      result.tasksFailed += Math.max(0, Number(subResult.tasksFailed || 0));
      if (subResult.error) this.log(`任务 ${taskValue} 结果: ${subResult.error}`, subResult.success ? 'warning' : 'error');
      if (result.tasksRun === beforeRun && result.tasksFailed === beforeFailed) {
        result.tasksRun++;
      }
      await delay(this.settings.taskDelay);
    }

    result.success = result.tasksFailed === 0;
    if (result.tasksFailed > 0) result.error = `${result.tasksFailed} 个任务失败`;
    result.logs = this.logs;
    return result;
  }

  async runArenaTimes(times) {
    const count = Math.max(0, Number(times || 0));
    if (!count) this.skip('竞技场补齐次数为0，跳过');
    for (let i = 0; i < count; i++) {
      await this.settingsRunArenaOnce(`竞技场补齐 ${i + 1}/${count}`);
    }
  }

  async runStudy() {
    const start = await this.exec('study_startgame', {}, '开始答题', 8000);
    const questions = start?.questions || start?.study?.questions || start?.rawData?.questions || [];
    if (Array.isArray(questions) && questions.length) {
      for (const question of questions) {
        const questionId = question.id || question.questionId || question.qid;
        const answer = question.answer || question.value || 1;
        await this.exec('study_answer', { questionId, answer }, `答题 ${questionId || ''}`.trim(), 8000);
      }
    } else {
      await this.tolerate(() => this.exec('study_answer', { answer: 1 }, '答题默认答案'), '答题默认答案');
    }
    await this.tolerate(() => this.exec('study_claimreward', { rewardId: 1 }, '领取答题奖励'), '领取答题奖励');
  }

  async settingsRunArenaOnce(description) {
    await this.exec('arena_startarea', {}, `${description}: 进入竞技场`);
    let battleVersion;
    try {
      const levelResp = await this.exec('fight_startlevel', {}, `${description}: 获取battleVersion`);
      battleVersion = levelResp?.rawData?.battleVersion || levelResp?.battleVersion;
    } catch (_) { /* ignore */ }
    const targetResp = await this.exec('arena_getareatarget', { refresh: false }, `${description}: 获取目标`);
    const targetId = pickArenaTargetId(targetResp?.rawData || targetResp);
    if (!targetId) throw new Error('没有可挑战的目标');
    const params = { targetId };
    if (battleVersion) params.battleVersion = battleVersion;
    await this.exec('fight_startareaarena', params, description, 10000);
  }

  async runSkinChallenge() {
    const actId = this.settings.towerActId;
    const params = actId ? { actId } : {};
    const info = await this.exec('towers_getinfo', params, '获取换皮闯关信息', 8000);
    const actualActId = actId || info?.actId || info?.towerData?.actId;
    if (!actualActId) throw new Error('无法获取换皮闯关 actId');
    for (let towerType = 1; towerType <= 6; towerType++) {
      await this.tolerate(() => this.exec('towers_start', { actId: actualActId, towerType }, `换皮闯关开始 ${towerType}`, 8000), `换皮闯关开始 ${towerType}`);
      await this.tolerate(() => this.exec('towers_fight', { actId: actualActId, towerType }, `换皮闯关战斗 ${towerType}`, 10000), `换皮闯关战斗 ${towerType}`);
    }
  }

  async runLegacyGift() {
    const recipientId = this.settings.recipientId || this.settings.receiverId;
    const password = this.settings.password;
    if (!recipientId || !password) {
      throw new Error('赠送功法残卷需要配置 recipientId/receiverId 和 password');
    }
    await this.exec('role_commitpassword', { password, passwordType: 1 }, '提交安全密码', 8000);
    const info = await this.exec('legacy_getinfo', {}, '获取功法信息', 8000);
    const legacyMap = info?.legacy?.legacyMap || info?.legacyMap || {};
    const legacyUIds = Object.values(legacyMap).slice(0, 10).map((item) => item.uid || item.uId || item.id).filter(Boolean);
    if (!legacyUIds.length) this.skip('没有可赠送的功法残卷');
    await this.exec('legacy_sendgift', { itemCnt: legacyUIds.length, legacyUIds, targetId: Number(recipientId) }, '赠送功法残卷', 10000);
  }

  async runMergeBoxUseItems() {
    const info = await this.exec('mergebox_getinfo', { actType: 1 }, '获取怪异塔合成信息', 8000);
    const left = Number(info?.mergeBox?.lotteryLeftCnt || info?.evoTower?.lotteryLeftCnt || this.settings.mergeBoxUseCount || 1);
    const count = Math.min(Math.max(left, 1), Number(this.settings.maxMergeBoxUse || 50));
    for (let i = 0; i < count; i++) {
      await this.exec('mergebox_openbox', { actType: 1, pos: { gridX: 4, gridY: 5 } }, `使用怪异塔道具 ${i + 1}/${count}`, 8000);
    }
    await this.tolerate(() => this.exec('mergebox_claimcostprogress', { actType: 1 }, '领取使用累计奖励'), '领取使用累计奖励');
  }

  async runMergeBoxMergeItems() {
    const loops = Math.max(1, Number(this.settings.mergeBoxMergeLoops || 10));
    for (let i = 0; i < loops; i++) {
      await this.tolerate(() => this.exec('mergebox_automergeitem', { actType: 1 }, `怪异塔自动合成 ${i + 1}/${loops}`, 10000), `怪异塔自动合成 ${i + 1}/${loops}`);
    }
    await this.tolerate(() => this.exec('mergebox_claimmergeprogress', { actType: 1 }, '领取合成累计奖励'), '领取合成累计奖励');
  }

  async runPeachTasks() {
    const taskIds = this.settings.peachTaskIds || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const taskId of taskIds) {
      await this.tolerate(() => this.exec('legion_claimpayloadtask', { taskId }, `领取蟠桃园任务 ${taskId}`, 8000), `领取蟠桃园任务 ${taskId}`);
    }
    await this.tolerate(() => this.exec('legion_claimpayloadtaskprogress', {}, '领取蟠桃园进度奖励'), '领取蟠桃园进度奖励');
  }

  async runBuyDreamItems() {
    const list = Array.isArray(this.settings.dreamPurchaseList) ? this.settings.dreamPurchaseList : [];
    if (!list.length) throw new Error('购买梦境商品需要配置 dreamPurchaseList');
    for (const item of list) {
      const [id, index, pos] = String(item).split('-').map(Number);
      await this.exec('dungeon_buymerchant', { id, index, pos: Number.isFinite(pos) ? pos : 0 }, `购买梦境商品 ${item}`, 8000);
    }
  }

  async runDailyTasks() {
    this.logs = [];
    const result = { success: false, tasksRun: 0, tasksFailed: 0, logs: this.logs };

    try {
      this.log('获取角色信息...');
      const roleInfoResp = await this.exec('role_getroleinfo', {}, '获取角色信息');

      const roleData = roleInfoResp?.rawData?.role || roleInfoResp?.role;
      if (!roleData) {
        this.log('角色数据不存在', 'error');
        result.error = '角色数据不存在';
        return result;
      }

      this.log(`角色: ${roleData.name || 'unknown'}, 等级: ${roleData.level || '?'}`);

      const completed = roleData.dailyTask?.complete ?? {};
      const isTaskCompleted = (taskId) => completed[taskId] === -1;
      const statistics = roleData.statistics ?? {};
      const statisticsTime = roleData.statisticsTime ?? {};
      const s = this.settings;

      const tasks = [];

      // 1. 分享
      if (!isTaskCompleted(2)) {
        tasks.push({ type: 'daily_share', name: '分享游戏', fn: () => this.exec('system_mysharecallback', { isSkipShareCard: true, type: 2 }, '分享游戏') });
      }

      // 2. 赠送好友金币
      if (!isTaskCompleted(3)) {
        tasks.push({ type: 'friend', name: '赠送好友金币', fn: () => this.exec('friend_batch', {}, '赠送好友金币') });
      }

      // 3. 招募
      if (!isTaskCompleted(4)) {
        tasks.push({ type: 'recruit', name: '免费招募', fn: () => this.exec('hero_recruit', { recruitType: 3, recruitNumber: 1 }, '免费招募') });
        if (s.payRecruit) {
          tasks.push({ type: 'recruit', name: '付费招募', fn: () => this.exec('hero_recruit', { recruitType: 1, recruitNumber: 1 }, '付费招募') });
        }
      }

      // 4. 免费点金
      if (!isTaskCompleted(6) && isTodayAvailable(statisticsTime['buy:gold'])) {
        for (let i = 0; i < 3; i++) {
          tasks.push({ type: 'buygold', name: `免费点金 ${i + 1}/3`, fn: () => this.exec('system_buygold', { buyNum: 1 }, `免费点金 ${i + 1}`) });
        }
      }

      // 5. 领取挂机奖励
      if (!isTaskCompleted(5) && s.claimHangUp) {
        tasks.push({ type: 'hangup', name: '领取挂机奖励', fn: () => this.exec('system_claimhangupreward', {}, '领取挂机奖励') });
        if (s.addHangUpTime) {
          for (let i = 0; i < 4; i++) {
            tasks.push({
              type: 'hangup_time',
              name: `挂机加钟 ${i + 1}/4`,
              fn: () => this.exec('system_mysharecallback', { isSkipShareCard: true, type: 2 }, `挂机加钟 ${i + 1}`),
            });
          }
        }
      }

      // 5.1 开箱
      if (!isTaskCompleted(7) && s.openBox) {
        tasks.push({ type: 'open_box', name: '开启木质宝箱', fn: () => this.exec('item_openbox', { itemId: 2001, number: 10 }, '开启木质宝箱10个') });
      }

      // 5.2 盐罐启停
      if (s.restartBottle) {
        tasks.push({ type: 'bottle_timer', name: '停止盐罐计时', fn: () => this.tolerate(() => this.exec('bottlehelper_stop', {}, '停止盐罐计时'), '停止盐罐计时') });
        tasks.push({ type: 'bottle_timer', name: '开始盐罐计时', fn: () => this.tolerate(() => this.exec('bottlehelper_start', {}, '开始盐罐计时'), '开始盐罐计时') });
      }

      // 6. 签到
      tasks.push({
        type: 'daily_signin',
        name: '签到',
        fn: () => this.execOptionalNoResponse('system_signinreward', {}, '签到奖励'),
      });

      // 7. 竞技场
      if (s.arenaEnable && !isTaskCompleted(1)) {
        tasks.push({
          type: 'arena',
          name: '竞技场',
          fn: async () => {
            if (s.arenaFormation) {
              await this.switchFormation(s.arenaFormation, '竞技场阵容');
            }

            await this.exec('arena_startarea', {}, '进入竞技场');
            await delay(300);

            let battleVersion;
            try {
              const levelResp = await this.exec('fight_startlevel', {}, '获取battleVersion');
              battleVersion = levelResp?.rawData?.battleVersion || levelResp?.battleVersion;
            } catch (_) { /* ignore */ }

            const targetResp = await this.exec('arena_getareatarget', { refresh: false }, '获取竞技场目标');
            const targetData = targetResp?.rawData || targetResp;
            const targetId = pickArenaTargetId(targetData);
            if (!targetId) throw new Error('没有可挑战的目标');

            const fightParams = { targetId };
            if (battleVersion) fightParams.battleVersion = battleVersion;
            await this.exec('fight_startareaarena', fightParams, '竞技场战斗');

            if (originalFormation && s.arenaFormation !== originalFormation) {
              await this.switchFormation(originalFormation, '原始阵容');
            }
          },
        });
      }

      // 8. Boss
      if (!isTaskCompleted(7)) {
        tasks.push({
          type: 'boss',
          name: 'Boss战',
          fn: async () => {
            if (s.bossFormation) {
              await this.switchFormation(s.bossFormation, 'Boss阵容');
            }
            const bossId = getTodayBossId();
            for (let i = 0; i < (s.bossTimes || 2); i++) {
              await this.exec('fight_startboss', { bossId }, `Boss战 ${i + 1}`);
            }
            if (originalFormation && s.bossFormation !== originalFormation) {
              await this.switchFormation(originalFormation, '原始阵容');
            }
          },
        });
      }

      if (s.legionBossEnable && (s.bossTimes || 0) > 0) {
        let alreadyLegionBoss = statistics['legion:boss'] ?? 0;
        if (isTodayAvailable(statisticsTime['legion:boss'])) {
          alreadyLegionBoss = 0;
        }
        const remainingLegionBoss = Math.max((s.bossTimes || 2) - alreadyLegionBoss, 0);
        if (remainingLegionBoss > 0) {
          tasks.push({
            type: 'legion_boss',
            name: '军团Boss',
            fn: async () => {
              if (s.bossFormation) {
                await this.switchFormation(s.bossFormation, 'Boss阵容');
              }
              for (let i = 0; i < remainingLegionBoss; i++) {
                await this.exec('fight_startlegionboss', {}, `军团Boss ${i + 1}/${remainingLegionBoss}`, 12000);
              }
              if (originalFormation && s.bossFormation !== originalFormation) {
                await this.switchFormation(originalFormation, '原始阵容');
              }
            },
          });
        }
      }

      // 9. 领取每日任务奖励
      tasks.push({ type: 'daily_reward', name: '领取每日任务奖励', fn: async () => {
        for (let rewardId = 0; rewardId <= 4; rewardId++) {
          try { await this.exec('task_claimdailyreward', { rewardId }, `领取每日奖励 ${rewardId}`); } catch (_) { /* ignore */ }
        }
      }});

      // 10. 邮件
      if (s.claimEmail) {
        tasks.push({ type: 'mail', name: '领取邮件', fn: () => this.exec('mail_claimallattachment', { category: 0 }, '领取邮件附件') });
      }

      if (s.claimDailyGifts) {
        tasks.push({ type: 'daily_gift', name: '领取每日礼包', fn: () => this.tolerate(() => this.exec('discount_claimreward', { discountId: 1 }, '领取每日礼包'), '领取每日礼包') });
        tasks.push({ type: 'daily_gift', name: '领取免费礼包', fn: () => this.tolerate(() => this.exec('card_claimreward', { cardId: 1 }, '领取免费礼包'), '领取免费礼包') });
        tasks.push({ type: 'daily_gift', name: '领取永久卡礼包', fn: () => this.tolerate(() => this.exec('card_claimreward', { cardId: 4003 }, '领取永久卡礼包'), '领取永久卡礼包') });
      }

      // 11. 免费扭蛋
      if (s.freeGachaEnable && isTodayAvailable(statisticsTime['gacha:free'])) {
        tasks.push({
          type: 'gacha',
          name: '免费扭蛋',
          fn: () => this.execOptionalNoResponse('gacha_drawreward', { num: 1, isGroup: false }, '免费扭蛋', 5000, {
            normalErrorCodes: ['200020'],
          }),
        });
      }

      // 12. 军团签到
      tasks.push({
        type: 'legion_signin',
        name: '军团签到',
        fn: () => {
          if (!roleData.legionId && !roleData.legionID && !roleData.legionInfo?.id) {
            this.skip('角色未加入军团，跳过军团签到');
          }
          if (!isTodayAvailable(statisticsTime['legion:sign:in'])) {
            this.skip('军团签到今日已完成，跳过签到');
          }
          return this.exec('legion_signin', {}, '军团签到');
        },
      });

      // 13. 领取瓶子
      if (s.claimBottle) {
        tasks.push({
          type: 'bottle',
          name: '领取瓶子',
          fn: () => {
            if (isTaskCompleted(14)) {
              this.skip('领取瓶子今日已完成，跳过领取');
            }
            const helperStopTime = Number(roleData.bottleHelpers?.helperStopTime || 0);
            if (!helperStopTime) {
              this.skip('未发现运行中的盐罐机器人，跳过领取瓶子');
            }
            if (helperStopTime > Date.now() / 1000) {
              this.skip('盐罐机器人仍在计时，跳过领取瓶子');
            }
            return this.exec('bottlehelper_claim', {}, '领取瓶子奖励');
          },
        });
      }

      // 14. 珍宝阁免费奖励
      if (s.claimCollection) {
        tasks.push({ type: 'collection', name: '开始领取珍宝阁礼包', fn: () => this.tolerate(() => this.exec('collection_goodslist', {}, '开始领取珍宝阁礼包'), '开始领取珍宝阁礼包') });
        tasks.push({ type: 'collection', name: '珍宝阁', fn: () => this.tolerate(() => this.exec('collection_claimfreereward', {}, '珍宝阁免费奖励'), '珍宝阁免费奖励') });
      }

      if (s.freeFishing && isTodayAvailable(statistics['artifact:normal:lottery:time'])) {
        for (let i = 0; i < 3; i++) {
          tasks.push({
            type: 'fishing',
            name: `免费钓鱼 ${i + 1}/3`,
            fn: () => this.tolerate(() => this.exec('artifact_lottery', { lotteryNumber: 1, newFree: true, type: 1 }, `免费钓鱼 ${i + 1}`), `免费钓鱼 ${i + 1}`),
          });
        }
      }

      if (s.genieSweep) {
        const kingdoms = ['魏国', '蜀国', '吴国', '群雄'];
        for (let gid = 1; gid <= 4; gid++) {
          if (isTodayAvailable(statisticsTime[`genie:daily:free:${gid}`])) {
            tasks.push({
              type: 'genie',
              name: `${kingdoms[gid - 1]}灯神免费扫荡`,
              fn: () => this.tolerate(() => this.exec('genie_sweep', { genieId: gid }, `${kingdoms[gid - 1]}灯神免费扫荡`), `${kingdoms[gid - 1]}灯神免费扫荡`),
            });
          }
        }
        for (let i = 0; i < 3; i++) {
          tasks.push({
            type: 'genie',
            name: `领取免费扫荡卷 ${i + 1}/3`,
            fn: () => this.tolerate(() => this.exec('genie_buysweep', {}, `领取免费扫荡卷 ${i + 1}`), `领取免费扫荡卷 ${i + 1}`),
          });
        }
        if (new Date().getDay() === 1 && isTodayAvailable(statisticsTime['genie:daily:free:5'])) {
          tasks.push({
            type: 'genie',
            name: '深海灯神',
            fn: () => this.tolerate(() => this.exec('genie_sweep', { genieId: 5, sweepCnt: 1 }, '深海灯神'), '深海灯神'),
          });
        }
      }

      if (!isTaskCompleted(12) && s.blackMarketPurchase) {
        tasks.push({ type: 'black_market', name: '黑市购买1次物品', fn: () => this.tolerate(() => this.exec('store_purchase', { goodsId: 1 }, '黑市购买1次物品'), '黑市购买1次物品') });
      }

      const dayOfWeek = new Date().getDay();
      if (s.dreamDungeon && [0, 1, 3, 4].includes(dayOfWeek)) {
        tasks.push({ type: 'dream', name: '咸王梦境', fn: () => this.tolerate(() => this.exec('dungeon_selecthero', { battleTeam: { 0: 107 } }, '咸王梦境'), '咸王梦境') });
      }

      if (s.claimTaskPoints) {
        for (let taskId = 1; taskId <= 10; taskId++) {
          tasks.push({
            type: 'daily_point',
            name: `领取任务奖励${taskId}`,
            fn: () => this.tolerate(() => this.exec('task_claimdailypoint', { taskId }, `领取任务奖励${taskId}`, 5000), `领取任务奖励${taskId}`),
          });
        }
      }

      if (s.claimWeeklyReward) {
        tasks.push({ type: 'weekly_reward', name: '领取周常任务奖励', fn: () => this.tolerate(() => this.exec('task_claimweekreward', {}, '领取周常任务奖励'), '领取周常任务奖励') });
      }

      if (s.claimWarOrder) {
        tasks.push({ type: 'war_order', name: '领取通行证奖励', fn: () => this.tolerate(() => this.exec('activity_recyclewarorderrewardclaim', { actId: 1 }, '领取通行证奖励'), '领取通行证奖励') });
      }

      const selectedTypes = Array.isArray(s.onlyTaskTypes) ? new Set(s.onlyTaskTypes) : null;
      const runnableTasks = selectedTypes
        ? tasks.filter((task) => selectedTypes.has(task.type))
        : tasks;

      if (selectedTypes) {
        this.log(`筛选任务类型: ${Array.from(selectedTypes).join(', ')}`);
      }

      if (runnableTasks.length === 0) {
        result.success = false;
        result.error = selectedTypes
          ? `没有可执行的任务类型: ${Array.from(selectedTypes).join(', ')}`
          : '没有可执行的任务';
        this.log(result.error, 'error');
        return result;
      }

      let originalFormation = null;
      const needsFormation = runnableTasks.some((task) => ['arena', 'boss', 'legion_boss'].includes(task.type));
      if (needsFormation) {
        try {
          const teamInfo = await this.exec('presetteam_getinfo', {}, '获取当前阵容');
          originalFormation = teamInfo?.presetTeamInfo?.useTeamId;
        } catch (_) { /* ignore */ }
      }

      // Execute selected tasks
      for (const task of runnableTasks) {
        try {
          await task.fn();
          result.tasksRun++;
          await delay(this.settings.taskDelay);
        } catch (error) {
          if (error instanceof SkipTaskError) {
            result.tasksRun++;
            await delay(this.settings.taskDelay);
            continue;
          }
          result.tasksFailed++;
          this.log(`任务[${task.name}]失败: ${error.message}`, 'error');
        }
      }

      result.success = result.tasksFailed === 0;
      if (result.tasksFailed > 0) {
        result.error = `${result.tasksFailed} 个任务失败`;
      }
      this.log(`任务执行完成: ${result.tasksRun} 成功, ${result.tasksFailed} 失败`);
    } catch (error) {
      result.error = error.message;
      this.log(`任务执行异常: ${error.message}`, 'error');
    }

    result.logs = this.logs;
    return result;
  }

  async runTaskType(taskType = 'daily_all') {
    if (taskType === 'task_group') {
      return this.runTaskGroup(this.settings.selectedTasks);
    }

    if (Array.isArray(this.settings.selectedTasks) && this.settings.selectedTasks.length > 0) {
      return this.runTaskGroup(this.settings.selectedTasks);
    }

    return this.runBatchTaskValue(taskType);
  }
}

module.exports = { TaskRunner, pickArenaTargetId, isTodayAvailable, getTodayBossId };
