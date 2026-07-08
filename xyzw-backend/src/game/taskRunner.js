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
    try {
      if (description) this.log(`执行: ${description}`);
      const result = await this.ws.sendWithPromise(cmd, params, timeout);
      await delay(this.settings.commandDelay);
      if (description) this.log(`${description} - 成功`, 'success');
      return result;
    } catch (error) {
      if (description) this.log(`${description} - 失败: ${error.message}`, 'error');
      throw error;
    }
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

      let originalFormation = null;
      try {
        const teamInfo = await this.exec('presetteam_getinfo', {}, '获取当前阵容');
        originalFormation = teamInfo?.presetTeamInfo?.useTeamId;
      } catch (_) { /* ignore */ }

      const completed = roleData.dailyTask?.complete ?? {};
      const isTaskCompleted = (taskId) => completed[taskId] === -1;
      const statisticsTime = roleData.statisticsTime ?? {};
      const s = this.settings;

      const tasks = [];

      // 1. 分享
      if (!isTaskCompleted(2)) {
        tasks.push({ name: '分享游戏', fn: () => this.exec('system_mysharecallback', { isSkipShareCard: true, type: 2 }, '分享游戏') });
      }

      // 2. 赠送好友金币
      if (!isTaskCompleted(3)) {
        tasks.push({ name: '赠送好友金币', fn: () => this.exec('friend_batch', {}, '赠送好友金币') });
      }

      // 3. 招募
      if (!isTaskCompleted(4)) {
        tasks.push({ name: '免费招募', fn: () => this.exec('hero_recruit', { recruitType: 3, recruitNumber: 1 }, '免费招募') });
        if (s.payRecruit) {
          tasks.push({ name: '付费招募', fn: () => this.exec('hero_recruit', { recruitType: 1, recruitNumber: 1 }, '付费招募') });
        }
      }

      // 4. 免费点金
      if (!isTaskCompleted(6) && isTodayAvailable(statisticsTime['buy:gold'])) {
        for (let i = 0; i < 3; i++) {
          tasks.push({ name: `免费点金 ${i + 1}/3`, fn: () => this.exec('system_buygold', { buyNum: 1 }, `免费点金 ${i + 1}`) });
        }
      }

      // 5. 领取挂机奖励
      if (!isTaskCompleted(5) && s.claimHangUp) {
        tasks.push({ name: '领取挂机奖励', fn: () => this.exec('system_claimhangupreward', {}, '领取挂机奖励') });
      }

      // 6. 签到
      tasks.push({ name: '签到', fn: () => this.exec('system_signinreward', {}, '签到奖励') });

      // 7. 竞技场
      if (s.arenaEnable && !isTaskCompleted(1)) {
        tasks.push({
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

      // 9. 领取每日任务奖励
      tasks.push({ name: '领取每日任务奖励', fn: async () => {
        for (let rewardId = 0; rewardId <= 4; rewardId++) {
          try { await this.exec('task_claimdailyreward', { rewardId }, `领取每日奖励 ${rewardId}`); } catch (_) { /* ignore */ }
        }
      }});

      // 10. 邮件
      if (s.claimEmail) {
        tasks.push({ name: '领取邮件', fn: () => this.exec('mail_claimallattachment', { category: 0 }, '领取邮件附件') });
      }

      // 11. 免费扭蛋
      if (s.freeGachaEnable) {
        tasks.push({ name: '免费扭蛋', fn: () => this.exec('gacha_drawreward', { num: 1, isGroup: false }, '免费扭蛋') });
      }

      // 12. 军团签到
      tasks.push({ name: '军团签到', fn: () => this.exec('legion_signin', {}, '军团签到') });

      // 13. 领取瓶子
      if (s.claimBottle) {
        tasks.push({ name: '领取瓶子', fn: () => this.exec('bottlehelper_claim', {}, '领取瓶子奖励') });
      }

      // 14. 珍宝阁免费奖励
      tasks.push({ name: '珍宝阁', fn: () => this.exec('collection_claimfreereward', {}, '珍宝阁免费奖励') });

      // Execute all tasks
      for (const task of tasks) {
        try {
          await task.fn();
          result.tasksRun++;
          await delay(this.settings.taskDelay);
        } catch (error) {
          result.tasksFailed++;
          this.log(`任务[${task.name}]失败: ${error.message}`, 'error');
        }
      }

      result.success = true;
      this.log(`每日任务完成: ${result.tasksRun} 成功, ${result.tasksFailed} 失败`);
    } catch (error) {
      result.error = error.message;
      this.log(`任务执行异常: ${error.message}`, 'error');
    }

    result.logs = this.logs;
    return result;
  }
}

module.exports = { TaskRunner, pickArenaTargetId, isTodayAvailable, getTodayBossId };
