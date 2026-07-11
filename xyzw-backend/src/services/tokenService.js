const tokenModel = require('../models/tokenModel');
const subscriptionService = require('./subscriptionService');
const { encrypt, decrypt, sha256 } = require('../utils/crypto');
const { ValidationError, ConflictError, NotFoundError, ForbiddenError } = require('../utils/errors');

const MAX_FREE_TOKENS = 2;

const tokenService = {
  async addToken(userId, { name, token, server, importMethod, sourceUrl, remark }) {
    if (!token) {
      throw new ValidationError('Token不能为空');
    }

    const tokenHash = sha256(token);
    const existing = await tokenModel.findByHashAndUser(tokenHash, userId);
    if (existing) {
      return existing;
    }

    const currentCount = await tokenModel.countByUserId(userId);
    await subscriptionService.checkTokenLimit(userId, currentCount);

    try {
      const encryptedToken = encrypt(token);
      const record = await tokenModel.create({
        userId,
        name: name || '未命名',
        encryptedToken,
        tokenHash,
        server: server || '',
        roleName: null,
        roleLevel: null,
        importMethod: importMethod || 'manual',
        sourceUrl: sourceUrl || null,
        remark: remark || null,
      });
      return record;
    } catch (err) {
      if (err.code === '23505' && err.constraint === 'idx_tokens_hash') {
        throw new ConflictError('该Token已存在');
      }
      throw err;
    }
  },

  async getTokens(userId) {
    return tokenModel.findByUserId(userId);
  },

  async getTokenWithDecryption(id, userId) {
    const token = await tokenModel.findByIdAndUser(id, userId);
    if (!token) {
      throw new NotFoundError('Token不存在');
    }
    token.decryptedToken = decrypt(token.encrypted_token);
    return token;
  },

  async updateToken(id, userId, { name, remark }) {
    const fields = {};
    if (name !== undefined) fields.name = name;
    if (remark !== undefined) fields.remark = remark;

    if (Object.keys(fields).length === 0) {
      throw new ValidationError('没有可更新的字段');
    }

    const updated = await tokenModel.update(id, userId, fields);
    if (!updated) {
      throw new NotFoundError('Token不存在');
    }
    return updated;
  },

  async deleteToken(id, userId) {
    const deleted = await tokenModel.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('Token不存在');
    }
    return true;
  },

  async getTokenCount(userId) {
    return tokenModel.countByUserId(userId);
  },
};

module.exports = tokenService;
