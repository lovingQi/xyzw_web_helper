const WebSocket = require('ws');
const { g_utils, getEnc } = require('./bonProtocol');
const { CommandRegistry, registerDefaultCommands } = require('./commandRegistry');

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
        this.ws = new WebSocket(url, wsOptions);
        this.ws.binaryType = 'arraybuffer';

        this.ws.on('open', () => {
          clearTimeout(timeoutId);
          this.connecting = false;
          this.connected = true;
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
          this._cleanup();
        });

        this.ws.on('error', (err) => {
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
    this._cleanup();
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
    const respKey = `${cmd}resp`;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waitingPromises.delete(respKey);
        reject(new Error(`Request timeout: ${cmd}`));
      }, timeout);

      this.waitingPromises.set(respKey, { resolve, reject, timeoutId });
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
        const respKey = `${cmd}resp`;
        if (this.waitingPromises.has(respKey)) {
          const { resolve, timeoutId } = this.waitingPromises.get(respKey);
          clearTimeout(timeoutId);
          this.waitingPromises.delete(respKey);
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
      const data = g_utils.encode(packet, this.channel);
      this.ws.send(data);
    } catch (err) {
      // silently ignore send errors
    }
  }

  _cleanup() {
    this._stopHeartbeat();
    this._stopQueueProcessor();
    for (const [, { reject, timeoutId }] of this.waitingPromises) {
      clearTimeout(timeoutId);
      reject(new Error('Connection closed'));
    }
    this.waitingPromises.clear();
  }

  static buildWsUrl(token, baseUrl = 'wss://xxz-xyzw.hortorgames.com/agent') {
    return `${baseUrl}?p=${encodeURIComponent(token)}&e=x&lang=chinese`;
  }
}

module.exports = { GameWsClient };
