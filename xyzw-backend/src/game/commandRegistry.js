const { g_utils } = require('./bonProtocol');

const errorCodeMap = {
  700010: "任务未达成完成条件",
  1400010: "没有购买该月卡,不能领取每日奖励",
  12000116: "今日已领取免费奖励",
  3300060: "扫荡条件不满足",
  1300050: "请修改您的采购次数",
  200020: "出了点小问题，请尝试重启游戏解决～",
  200160: "模块未开启",
  7500140: "请先输入密码",
  7500100: "密码输入错误",
  7500120: "密码输入错误次数已达上限",
  200400: "操作太快，请稍后再试",
  200760: "您当前看到的界面已发生变化，请重新登录",
  2300190: "今天已经签到过了",
  2300370: "俱乐部商品购买数量超出上限",
  400000: "物品不存在",
  1500020: "能量不足",
  2300070: "未加入俱乐部",
  3500020: "没有可领取的奖励",
  12000050: "今日发车次数已达上限",
  12000060: "不在发车时间内",
  400190: "没有可领取的签到奖励",
  1000020: "今天已经领取过奖励了",
  3300050: "购买数量超出限制",
  700020: "已经领取过这个任务",
  12400000: "挂机奖励领取过于频繁",
  2300250: "俱乐部BOSS今日攻打次数已用完",
  400010: "物品数量不足",
  7900023: "已达到使用次数上限",
  12300040: "没有空格子了",
  12300080: "未达到解锁条件",
  200330: "无效的ID",
  1500040: "上座塔的奖励未领取",
  1500010: "已经全部通关",
};

class CommandRegistry {
  constructor(encoder, enc) {
    this.encoder = encoder;
    this.enc = enc;
    this.commands = new Map();
  }

  register(cmd, defaultBody = {}) {
    this.commands.set(cmd, (ack = 0, seq = 0, params = {}) => ({
      cmd,
      ack,
      seq,
      time: Date.now(),
      body: this.encoder?.bon?.encode
        ? this.encoder.bon.encode({ ...defaultBody, ...params })
        : { ...defaultBody, ...params },
    }));
    return this;
  }

  registerHeartbeat() {
    this.commands.set("heart_beat", (ack, seq) => ({
      cmd: "_sys/ack",
      ack,
      seq,
      time: Date.now(),
      body: {},
    }));
    return this;
  }

  encodePacket(raw) {
    if (this.encoder?.encode && this.enc) {
      return this.encoder.encode(raw, this.enc);
    }
    return JSON.stringify(raw);
  }

  build(cmd, ack, seq, params) {
    const fn = this.commands.get(cmd);
    if (!fn) throw new Error(`Unknown cmd: ${cmd}`);
    return fn(ack, seq, params);
  }
}

function registerDefaultCommands(reg) {
  const registry = reg
    .registerHeartbeat()
    .register("role_getroleinfo", {
      clientVersion: "2.21.2-fa918e1997301834-wx",
      inviteUid: 0,
      platform: "hortor",
      platformExt: "mix",
      scene: "",
    })
    .register("system_getdatabundlever", { isAudit: false })
    .register("system_buygold", { buyNum: 1 })
    .register("system_claimhangupreward")
    .register("system_signinreward")
    .register("system_mysharecallback", { isSkipShareCard: true, type: 2 })
    .register("system_custom", { key: "", value: 0 })
    .register("task_claimdailypoint", { taskId: 1 })
    .register("task_claimdailyreward", { rewardId: 0 })
    .register("task_claimweekreward", { rewardId: 0 })
    .register("friend_batch", { friendId: 0 })
    .register("hero_recruit", { byClub: false, recruitNumber: 1, recruitType: 3 })
    .register("item_openbox", { itemId: 2001, number: 10 })
    .register("item_batchclaimboxpointreward")
    .register("item_openpack")
    .register("rank_getserverrank")
    .register("arena_startarea")
    .register("fight_startlevel")
    .register("arena_getareatarget", { refresh: false })
    .register("arena_getarearank")
    .register("store_goodslist", { storeId: 1 })
    .register("store_buy", { goodsId: 1 })
    .register("store_purchase", { goodsId: 1 })
    .register("store_refresh", { storeId: 1 })
    .register("legion_getinfo")
    .register("legion_signin")
    .register("legion_getwarrank")
    .register("legionwar_getdetails")
    .register("legion_storebuygoods")
    .register("legion_kickout")
    .register("legion_applylist")
    .register("legion_approveapply")
    .register("legion_refuseapply")
    .register("legion_agree")
    .register("legion_ignore")
    .register("legion_research")
    .register("legion_resetresearch")
    .register("legion_getinfobyid")
    .register("legion_getarearank")
    .register("saltroad_getsaltroadwartotalrank")
    .register("legionwar_getgoldmonthwarrank")
    .register("legion_getopponent")
    .register("legion_getbattlefield")
    .register("legion_claimpayloadtask")
    .register("legion_claimpayloadtaskprogress")
    .register("saltroad_getwartype")
    .register("saltroad_getsaltroadwargrouprank")
    .register("league_getbattlefield")
    .register("league_getgroupopponent")
    .register("legion_signup")
    .register("mail_getlist", { category: [0, 4, 5], lastId: 0, size: 60 })
    .register("mail_claimallattachment", { category: 0 })
    .register("mail_getmtlinfo")
    .register("mail_getmtlshortinfo")
    .register("study_startgame")
    .register("study_answer")
    .register("study_claimreward", { rewardId: 1 })
    .register("fight_starttower")
    .register("fight_startboss")
    .register("fight_startlegionboss")
    .register("fight_startdungeon")
    .register("fight_startpvp")
    .register("evotower_getinfo")
    .register("evotower_fight")
    .register("evotower_getlegionjoinmembers")
    .register("evotower_readyfight")
    .register("evotower_claimreward")
    .register("mergebox_getinfo")
    .register("mergebox_claimfreeenergy")
    .register("mergebox_openbox")
    .register("mergebox_automergeitem", { actType: 1 })
    .register("mergebox_mergeitem", { actType: 1 })
    .register("mergebox_claimcostprogress", { actType: 1 })
    .register("mergebox_claimmergeprogress", { actType: 1 })
    .register("evotower_claimtask", { taskId: 1 })
    .register("bottlehelper_claim")
    .register("bottlehelper_start", { bottleType: -1 })
    .register("bottlehelper_stop", { bottleType: -1 })
    .register("legionmatch_rolesignup")
    .register("artifact_lottery", { lotteryNumber: 1, newFree: true, type: 1 })
    .register("artifact_exchange")
    .register("genie_sweep", { genieId: 1 })
    .register("genie_buysweep")
    .register("discount_claimreward", { discountId: 1 })
    .register("collection_claimfreereward")
    .register("card_claimreward", { cardId: 1 })
    .register("tower_getinfo")
    .register("tower_claimreward")
    .register("presetteam_getinfo")
    .register("presetteam_setteam")
    .register("presetteam_saveteam", { teamId: 1 })
    .register("role_gettargetteam")
    .register("hero_exchange")
    .register("hero_gointobattle")
    .register("hero_gobackbattle")
    .register("artifact_load")
    .register("artifact_unload")
    .register("lordweapon_changedefaultweapon")
    .register("pearl_replaceskill")
    .register("pearl_exchangeskill")
    .register("pearl_unloadskill")
    .register("hero_heroupgradelevel")
    .register("hero_heroupgradeorder")
    .register("hero_rebirth")
    .register("hero_heroupgradestar")
    .register("book_upgrade")
    .register("book_claimpointreward")
    .register("rank_getroleinfo")
    .register("nightmare_getroleinfo")
    .register("dungeon_selecthero")
    .register("bosstower_gethelprank")
    .register("dungeon_buymerchant")
    .register("activity_get")
    .register("activity_recyclewarorderrewardclaim")
    .register("legion_getpayloadtask")
    .register("legion_getpayloadkillrecord")
    .register("legion_getpayloadbf")
    .register("legion_getpayloadrecord")
    .register("warguess_getrank")
    .register("warguess_startguess")
    .register("warguess_getguesscoinreward")
    .register("legion_payloadsignup")
    .register("collection_goodslist")
    .register("gacha_drawreward", { num: 1, isGroup: false })
    .register("car_getrolecar")
    .register("car_refresh", { carId: 0 })
    .register("car_claim", { carId: 0 })
    .register("car_send", { carId: 0, helperId: 0, text: "" })
    .register("car_getmemberhelpingcnt")
    .register("car_getmemberrank")
    .register("car_research")
    .register("car_claimpartconsumereward")
    .register("legacy_getinfo")
    .register("legacy_claimhangup")
    .register("legacy_gift_getlist")
    .register("legacy_gift_send", { recipientId: 0, itemId: 0, quantity: 0 })
    .register("legacy_gift_received")
    .register("role_commitpassword", { password: "", passwordType: 1 })
    .register("legacy_sendgift", { itemCnt: 0, legacyUIds: [], targetId: 0 })
    .register("equipment_confirm", { heroId: 0, part: 0, quenchId: 0, quenches: {} })
    .register("equipment_quench", { heroId: 0, part: 0, quenchId: 0, quenches: {}, seed: 0, skipOrange: false })
    .register("equipment_updatequenchlock", { heroId: 0, part: 0, slot: 0, isLocked: false })
    .register("matchteam_getroleteaminfo")
    .register("bosstower_getinfo")
    .register("bosstower_startboss")
    .register("bosstower_startbox")
    .register("discount_getdiscountinfo")
    .register("towers_getinfo")
    .register("towers_start")
    .register("towers_fight")
    .register("system_sendchatmessage");

  registry.commands.set("fight_startareaarena", (ack = 0, seq = 0, params = {}) => {
    if (params?.targetId === undefined || params?.targetId === null) {
      throw new Error("fight_startareaarena requires targetId in params");
    }
    const payload = { ...params };
    const body = registry.encoder?.bon?.encode
      ? registry.encoder.bon.encode(payload)
      : payload;
    return { cmd: "fight_startareaarena", ack, seq, time: Date.now(), body };
  });

  registry.commands.set("fight_startpvp", (ack = 0, seq = 0, params = {}) => {
    const payload = { ...params };
    const body = registry.encoder?.bon?.encode
      ? registry.encoder.bon.encode(payload)
      : payload;
    return { cmd: "fight_startpvp", ack, seq, time: Date.now(), body };
  });

  return registry;
}

module.exports = { CommandRegistry, registerDefaultCommands, errorCodeMap };
