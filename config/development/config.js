module.exports = {
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/personal_finance_dev',
    poolSize: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Bot configuration
  bot: {
    token: process.env.BOT_TOKEN_DEV,
    webhookUrl: process.env.WEBHOOK_URL_DEV,
    adminUserIds: process.env.ADMIN_USER_IDS_DEV?.split(',') || [],
  },

  // OCR configuration
  ocr: {
    apiKey: process.env.OCR_API_KEY_DEV,
    dailyLimit: 100,
    supportedLanguages: ['en', 'ru'],
  },

  // Analytics configuration
  analytics: {
    enabled: true,
    sampleRate: 1.0,
    anonymizeData: true,
  },

  // Logging configuration
  logging: {
    level: 'debug',
    format: 'dev',
    transports: ['console', 'file'],
    filename: 'logs/development.log',
  },

  // Security configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET_DEV,
    tokenExpiration: '24h',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },

  // Feature flags
  features: {
    enableReceiptProcessing: true,
    enableAnalytics: true,
    enableBenchmarking: true,
    enableMultiLanguage: true,
    enableLocationTracking: true,
    enableBackup: true,
  }
}; 