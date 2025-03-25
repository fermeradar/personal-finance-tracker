module.exports = {
  // Database configuration
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/personal_finance_test',
    poolSize: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Bot configuration
  bot: {
    token: process.env.TEST_BOT_TOKEN || 'test_token',
    webhookUrl: process.env.TEST_WEBHOOK_URL || 'http://localhost:3000/test/webhook',
    adminUserIds: process.env.TEST_ADMIN_USER_IDS?.split(',') || ['123456789'],
  },

  // OCR configuration
  ocr: {
    apiKey: process.env.TEST_OCR_API_KEY || 'test_key',
    dailyLimit: 100,
    supportedLanguages: ['en', 'ru'],
  },

  // Analytics configuration
  analytics: {
    enabled: false, // Disable analytics during tests
    sampleRate: 0,
    anonymizeData: true,
  },

  // Logging configuration
  logging: {
    level: 'error',
    format: 'test',
    transports: ['console'],
  },

  // Security configuration
  security: {
    sessionSecret: 'test_secret',
    tokenExpiration: '1h',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // Higher limit for tests
    }
  },

  // Feature flags
  features: {
    enableReceiptProcessing: true,
    enableAnalytics: false,
    enableBenchmarking: true,
    enableMultiLanguage: true,
    enableLocationTracking: true,
    enableBackup: true,
  }
}; 