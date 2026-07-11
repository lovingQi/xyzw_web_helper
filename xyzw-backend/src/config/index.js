require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  host: process.env.HOST || '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL || 'postgres://xyzw:xyzw@localhost:5432/xyzw',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  tokenEncryptKey: process.env.TOKEN_ENCRYPT_KEY || '',

  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    appId: process.env.PAYMENT_APP_ID || '',
    appSecret: process.env.PAYMENT_APP_SECRET || '',
    notifyUrl: process.env.PAYMENT_NOTIFY_URL || '',
    returnUrl: process.env.PAYMENT_RETURN_URL || '',
    mockEnabled: process.env.PAYMENT_MOCK_ENABLED === 'true' || process.env.NODE_ENV !== 'production',
  },

  admin: {
    apiKey: process.env.ADMIN_API_KEY || '',
  },

  proxy: {
    enabled: process.env.PROXY_ENABLED === 'true',
    apiUrl: process.env.PROXY_API_URL || '',
    apiKey: process.env.PROXY_API_KEY || '',
  },
};

module.exports = config;
