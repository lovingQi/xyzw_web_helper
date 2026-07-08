const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userModel = require('../models/userModel');
const { ConflictError, UnauthorizedError, ValidationError } = require('../utils/errors');

const SALT_ROUNDS = 10;

const userService = {
  async register({ email, password, nickname }) {
    if (!email || !password) {
      throw new ValidationError('邮箱和密码不能为空');
    }
    if (password.length < 6) {
      throw new ValidationError('密码长度不能少于6位');
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      throw new ConflictError('该邮箱已注册');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userModel.create({
      email,
      passwordHash,
      nickname: nickname || email.split('@')[0],
    });

    const tokens = this.generateTokens(user);
    return { user, ...tokens };
  },

  async login({ email, password }) {
    if (!email || !password) {
      throw new ValidationError('邮箱和密码不能为空');
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('账号已被禁用');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      status: user.status,
      created_at: user.created_at,
    };

    const tokens = this.generateTokens(safeUser);
    return { user: safeUser, ...tokens };
  },

  async refreshToken(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.secret);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('无效的刷新令牌');
      }

      const user = await userModel.findById(payload.id);
      if (!user || user.status !== 'active') {
        throw new UnauthorizedError('用户不存在或已被禁用');
      }

      const tokens = this.generateTokens(user);
      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('刷新令牌已过期或无效');
    }
  },

  generateTokens(user) {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, type: 'access' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    return { accessToken, refreshToken };
  },
};

module.exports = userService;
