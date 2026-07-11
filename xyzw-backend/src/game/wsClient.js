const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { g_utils, getEnc } = require('./bonProtocol');
const { CommandRegistry, registerDefaultCommands } = require('./commandRegistry');

function getProxyUrl(targetUrl) {
  const protocol = targetUrl.protocol.replace(':', '').toLowerCase();
  if (protocol === 'wss' || protocol === 'https') {
    return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
  }
  return process.env.HTTP_PROXY || process.env.http_proxy || '';
}

function hostMatchesNoProxy(hostname, rule) {
  const normalizedRule = rule.trim().toLowerCase();
  const normalizedHost = hostname.toLowerCase();
  if (!normalizedRule) return false;
  if (normalizedRule === '*') return true;
  if (normalizedRule === '<local>') {
    return !normalizedHost.includes('.');
  }
  if (normalizedRule.startsWith('.')) {
    return normalizedHost === normalizedRule.slice(1) || normalizedHost.endsWith(normalizedRule);
  }
  if (normalizedRule.endsWith('*')) {
    return normalizedHost.startsWith(normalizedRule.slice(0, -1));
  }
  return normalizedHost === normalizedRule || normalizedHost.endsWith(`.${normalizedRule}`);
}

function shouldBypassProxy(targetUrl) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
  if (!noProxy) return false;
  return noProxy.split(',').some((rule) => hostMatchesNoProxy(targetUrl.hostname, rule));
}

function buildProxyWsOptions(url, wsOptions = {}) {
  const targetUrl = new URL(url);
  if (wsOptions.agent || shouldBypassProxy(targetUrl)) {
    return wsOptions;
  }

  const proxyUrl = getProxyUrl(targetUrl);
  if (!proxyUrl) {
    return wsOptions;
  }

  return {
    ...wsOptions,
    agent: new HttpsProxyAgent(proxyUrl),
  };
}

function getResponseKey(cmd) {
  return String(cmd || '').toLowerCase();
}

const RESPONSE_TO_COMMAND_MAP = {
  fight_startpvpresp: 'fight_startpvp',
  activity_getresp: 'activity_get',
  collection_goodslistresp: 'collection_goodslist',
  collection_claimfreerewardresp: 'collection_claimfreereward',
  legion_getarearankresp: 'legion_getarearank',
  legionwar_getgoldmonthwarrankresp: 'legionwar_getgoldmonthwarrank',
  nightmare_getroleinforesp: 'nightmare_getroleinfo',
  studyresp: 'study_startgame',
  role_getroleinforesp: 'role_getroleinfo',
  hero_recruitresp: 'hero_recruit',
  friend_batchresp: 'friend_batch',
  system_claimhanguprewardresp: 'system_claimhangupreward',
  item_openboxresp: ['item_openbox', 'item_batchclaimboxpointreward'],
  bottlehelper_claimresp: 'bottlehelper_claim',
  bottlehelper_startresp: 'bottlehelper_start',
  bottlehelper_stopresp: 'bottlehelper_stop',
  legion_signinresp: 'legion_signin',
  fight_startbossresp: 'fight_startboss',
  fight_startlegionbossresp: 'fight_startlegionboss',
  fight_startareaarenaresp: 'fight_startareaarena',
  arena_startarearesp: 'arena_startarea',
  arena_getareatargetresp: 'arena_getareatarget',
  arena_getarearankresp: 'arena_getarearank',
  presetteam_saveteamresp: 'presetteam_saveteam',
  presetteam_getinforesp: 'presetteam_getinfo',
  mail_claimallattachmentresp: 'mail_claimallattachment',
  store_buyresp: 'store_purchase',
  system_getdatabundleverresp: 'system_getdatabundlever',
  tower_claimrewardresp: 'tower_claimreward',
  fight_starttowerresp: 'fight_starttower',
  evotowerinforesp: 'evotower_getinfo',
  evotower_fightresp: 'evotower_fight',
  evotower_getlegionjoinmembersresp: 'evotower_getlegionjoinmembers',
  mergeboxinforesp: 'mergebox_getinfo',
  mergebox_claimfreeenergyresp: 'mergebox_claimfreeenergy',
  mergebox_openboxresp: 'mergebox_openbox',
  mergebox_automergeitemresp: 'mergebox_automergeitem',
  mergebox_mergeitemresp: 'mergebox_mergeitem',
  mergebox_claimcostprogressresp: 'mergebox_claimcostprogress',
  mergebox_claimmergeprogressresp: 'mergebox_claimmergeprogress',
  evotower_claimtaskresp: 'evotower_claimtask',
  item_openpackresp: 'item_openpack',
  equipment_quenchresp: 'equipment_quench',
  rank_getserverrankresp: 'rank_getserverrank',
  legion_claimpayloadtaskresp: 'legion_claimpayloadtask',
  legion_claimpayloadtaskprogressresp: 'legion_claimpayloadtaskprogress',
  saltroad_getwartyperesp: 'saltroad_getwartype',
  saltroad_getsaltroadwartotalrankresp: 'saltroad_getsaltroadwartotalrank',
  warguess_getrankresp: 'warguess_getrank',
  warguess_startguessresp: 'warguess_startguess',
  warguess_getguesscoinrewardresp: 'warguess_getguesscoinreward',
  league_getbattlefieldresp: 'league_getbattlefield',
  league_getgroupopponentresp: 'league_getgroupopponent',
  legion_signupresp: 'legion_signup',
  legion_payloadsignupresp: 'legion_payloadsignup',
  pearl_replaceskillresp: 'pearl_replaceskill',
  pearl_exchangeskillresp: 'pearl_exchangeskill',
  pearl_unloadskillresp: 'pearl_unloadskill',
  matchteam_getroleteaminforesp: 'matchteam_getroleteaminfo',
  bosstower_getinforesp: 'bosstower_getinfo',
  bosstower_startbossresp: 'bosstower_startboss',
  bosstower_startboxresp: 'bosstower_startbox',
  discount_getdiscountinforesp: 'discount_getdiscountinfo',
  hero_heroupgradestarresp: 'hero_heroupgradestar',
  hero_heroupgradelevelresp: 'hero_heroupgradelevel',
  hero_heroupgradeorderresp: 'hero_heroupgradeorder',
  book_upgraderesp: 'book_upgrade',
  book_claimpointrewardresp: 'book_claimpointreward',
  legion_getinforesp: 'legion_getinfo',
  legion_getinforresp: 'legion_getinfo',
  car_getrolecarresp: 'car_getrolecar',
  car_refreshresp: 'car_refresh',
  car_claimresp: 'car_claim',
  car_sendresp: 'car_send',
  car_getmemberhelpingcntresp: 'car_getmemberhelpingcnt',
  car_getmemberrankresp: 'car_getmemberrank',
  car_researchresp: 'car_research',
  car_claimpartconsumerewardresp: 'car_claimpartconsumereward',
  role_gettargetteamresp: 'role_gettargetteam',
  activity_warorderclaimresp: 'activity_recyclewarorderrewardclaim',
  bosstower_gethelprankresp: 'bosstower_gethelprank',
  legacy_getinforesp: 'legacy_getinfo',
  legacy_claimhangupresp: 'legacy_claimhangup',
  legacy_sendgiftresp: 'legacy_sendgift',
  legacy_getgiftsresp: 'legacy_getgifts',
  towers_getinforesp: 'towers_getinfo',
  towers_startresp: 'towers_start',
  towers_fightresp: 'towers_fight',
  task_claimdailyrewardresp: 'task_claimdailyreward',
  task_claimweekrewardresp: 'task_claimweekreward',
  legion_researchresp: ['legion_research', 'legion_resetresearch'],
  syncresp: [
    'system_mysharecallback',
    'task_claimdailypoint',
    'role_commitpassword',
    'hero_gointobattle',
    'hero_gobackbattle',
    'lordweapon_changedefaultweapon',
  ],
  syncrewardresp: [
    'system_buygold',
    'discount_claimreward',
    'card_claimreward',
    'artifact_lottery',
    'genie_sweep',
    'genie_buysweep',
    'system_signinreward',
    'dungeon_selecthero',
    'artifact_exchange',
    'hero_exchange',
    'hero_rebirth',
  ],
};

function getMappedCommandKeys(respCmdKey) {
  const mapped = RESPONSE_TO_COMMAND_MAP[respCmdKey];
  const commands = Array.isArray(mapped) ? mapped : mapped ? [mapped] : [];
  return commands.flatMap((cmd) => [
    getResponseKey(cmd),
    getResponseKey(`${cmd}resp`),
  ]);
}

class GameWsClient {
  constructor(options = {}) {
    const {
      heartbeatInterval = 2000,
      queueInterval = 50,
      channel = 'x',
      autoReconnect = false,
      connectTimeout = 15000,
    } = options;

    this.heartbeatInterval = heartbeatInterval;
    this.queueInterval = queueInterval;
    this.channel = channel;
    this.autoReconnect = autoReconnect;
    this.connectTimeout = connectTimeout;

    this.ws = null;
    this.connected = false;
    this.connecting = false;

    this.ack = 0;
    this.seq = 1;

    this._heartbeatTimer = null;
    this._queueTimer = null;

    this.sendQueue = [];
    this.waitingPromises = new Map();
    this.lastClose = null;
    this.lastError = null;
    this.lastReceivedMessages = [];
    this.lastSentCommands = [];

    this.onMessage = () => {};

    this.registry = registerDefaultCommands(
      new CommandRegistry(g_utils, getEnc(this.channel))
    );
  }

  connect(url, wsOptions = {}) {
    if (this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.connecting = true;

      const timeoutId = setTimeout(() => {
        if (this.connecting) {
          this.connecting = false;
          if (this.ws) {
            this.ws.terminate();
            this.ws = null;
          }
          reject(new Error('WebSocket connection timeout'));
        }
      }, this.connectTimeout);

      try {
        this.ws = new WebSocket(url, buildProxyWsOptions(url, wsOptions));
        this.ws.binaryType = 'arraybuffer';

        this.ws.on('open', () => {
          clearTimeout(timeoutId);
          this.connecting = false;
          this.connected = true;
          this.lastClose = null;
          this.lastError = null;
          this.seq = 1;
          this._startHeartbeat();
          this._startQueueProcessor();
          resolve();
        });

        this.ws.on('message', (data) => {
          const buf = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          this._handleMessage(buf);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(timeoutId);
          this.connecting = false;
          this.connected = false;
          this.lastClose = {
            code,
            reason: reason ? reason.toString() : '',
            at: new Date().toISOString(),
          };
          this._cleanup(`Connection closed: code=${code}, reason=${this.lastClose.reason || 'none'}`);
        });

        this.ws.on('error', (err) => {
          this.lastError = {
            message: err.message,
            at: new Date().toISOString(),
          };
          if (this.connecting) {
            clearTimeout(timeoutId);
            this.connecting = false;
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeoutId);
        this.connecting = false;
        reject(err);
      }
    });
  }

  close() {
    this.autoReconnect = false;
    if (this.ws) {
      try { this.ws.close(1000, 'normal'); } catch (_) { /* ignore */ }
      this.ws = null;
    }
    this._cleanup('Connection closed by client');
  }

  send(payload) {
    if (Array.isArray(payload)) {
      this.sendQueue.push(...payload);
    } else {
      this.sendQueue.push(payload);
    }
  }

  sendCmd(cmd, params = {}) {
    const packet = this.registry.build(cmd, this.ack, this.seq++, params);
    this.sendQueue.push(packet);
  }

  sendWithPromise(cmd, params = {}, timeout = 8000) {
    const respKey = getResponseKey(`${cmd}resp`);
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waitingPromises.delete(respKey);
        const diagnostics = this.getDiagnostics();
        const closeText = this.lastClose
          ? `; last close code=${this.lastClose.code}, reason=${this.lastClose.reason || 'none'}`
          : '';
        const errorText = this.lastError
          ? `; last error=${this.lastError.message}`
          : '';
        const receivedText = diagnostics.lastReceivedMessages.length
          ? `; last received=${diagnostics.lastReceivedMessages.map((item) => item.cmd).join(',')}`
          : '';
        reject(new Error(`Request timeout: ${cmd}${closeText}${errorText}${receivedText}`));
      }, timeout);

      this.waitingPromises.set(respKey, { cmd, resolve, reject, timeoutId });
      this.sendCmd(cmd, params);
    });
  }

  async connectAndExecute(url, taskFn, wsOptions = {}) {
    try {
      await this.connect(url, wsOptions);
      const result = await taskFn(this);
      return result;
    } finally {
      this.close();
    }
  }

  _handleMessage(data) {
    try {
      const enc = getEnc(this.channel);
      const message = g_utils.parse(data, enc);

      if (!message) return;

      if (message.seq) {
        this.ack = message.seq;
      }

      const cmd = message.cmd || message._raw?.cmd;

      if (cmd) {
        this.lastReceivedMessages.push({
          cmd,
          at: new Date().toISOString(),
        });
        this.lastReceivedMessages = this.lastReceivedMessages.slice(-10);

        const respCmdKey = getResponseKey(cmd);
        const candidateKeys = [
          respCmdKey,
          getResponseKey(`${cmd}resp`),
          ...getMappedCommandKeys(respCmdKey),
        ];
        const matchedKey = candidateKeys.find((key) => this.waitingPromises.has(key));
        if (matchedKey) {
          const { resolve, timeoutId } = this.waitingPromises.get(matchedKey);
          clearTimeout(timeoutId);
          this.waitingPromises.delete(matchedKey);
          resolve(message);
          return;
        }
      }

      this.onMessage(message);
    } catch (err) {
      // silently ignore parse errors
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    if (!this.heartbeatInterval) return;
    this._heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this._rawSend({
          ack: this.ack,
          body: {},
          cmd: '_sys/ack',
          seq: 0,
          time: Date.now(),
        });
      }
    }, this.heartbeatInterval);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _startQueueProcessor() {
    this._stopQueueProcessor();
    this._queueTimer = setInterval(() => {
      this._processQueue();
    }, this.queueInterval);
  }

  _stopQueueProcessor() {
    if (this._queueTimer) {
      clearInterval(this._queueTimer);
      this._queueTimer = null;
    }
  }

  _processQueue() {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this.sendQueue.length === 0) return;
    const item = this.sendQueue.shift();
    this._rawSend(item);
  }

  _rawSend(packet) {
    try {
      if (packet?.cmd && packet.cmd !== '_sys/ack') {
        this.lastSentCommands.push({
          cmd: packet.cmd,
          at: new Date().toISOString(),
        });
        this.lastSentCommands = this.lastSentCommands.slice(-10);
      }
      const data = g_utils.encode(packet, this.channel);
      this.ws.send(data);
    } catch (err) {
      // silently ignore send errors
    }
  }

  getDiagnostics() {
    return {
      connected: this.connected,
      waitingCommands: Array.from(this.waitingPromises.values()).map((item) => item.cmd),
      lastReceivedMessages: this.lastReceivedMessages,
      lastSentCommands: this.lastSentCommands,
      lastClose: this.lastClose,
      lastError: this.lastError,
    };
  }

  _cleanup(reason = 'Connection closed') {
    this._stopHeartbeat();
    this._stopQueueProcessor();
    for (const [, { cmd, reject, timeoutId }] of this.waitingPromises) {
      clearTimeout(timeoutId);
      reject(new Error(`${reason}${cmd ? ` while waiting for ${cmd}` : ''}`));
    }
    this.waitingPromises.clear();
  }

  static buildWsUrl(token, baseUrl = 'wss://xxz-xyzw.hortorgames.com/agent') {
    return `${baseUrl}?p=${encodeURIComponent(token)}&e=x&lang=chinese`;
  }
}

module.exports = { GameWsClient };
