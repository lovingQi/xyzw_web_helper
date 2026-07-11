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
      if (current === targetFormation) return false;
      await this.exec('presetteam_saveteam', { teamId: targetFormation }, `切换到${formationName}${targetFormation}`);
      return true;
    } catch (error) {
      try {
        await this.exec('presetteam_saveteam', { teamId: targetFormation }, `强制切换到${formationName}${targetFormation}`);
        return true;
      } catch (_) {
        throw error;
      }
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
        fn: () => this.exec('system_signinreward', {}, '签到奖励'),
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
      if (s.freeGachaEnable) {
        tasks.push({
          type: 'gacha',
          name: '免费扭蛋',
          fn: () => this.exec('gacha_drawreward', { num: 1, isGroup: false }, '免费扭蛋'),
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
    if (taskType === 'daily_all') {
      return this.runDailyTasks();
    }

    if (['tower', 'study'].includes(taskType)) {
      return {
        success: false,
        tasksRun: 0,
        tasksFailed: 0,
        error: `任务类型 ${taskType} 尚未实现`,
        logs: [{
          time: new Date().toISOString(),
          message: `任务类型 ${taskType} 尚未实现`,
          type: 'error',
        }],
      };
    }

    this.settings = {
      ...this.settings,
      onlyTaskTypes: [taskType],
    };

    return this.runDailyTasks();
  }
}

module.exports = { TaskRunner, pickArenaTargetId, isTodayAvailable, getTodayBossId };
