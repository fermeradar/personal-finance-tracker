module.exports = {
  // Database configuration
  database: {
    url: process.env.DATABASE_URL,
    poolSize: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Bot configuration
  bot: {
    token: process.env.BOT_TOKEN,
    webhookUrl: process.env.WEBHOOK_URL,
    adminUserIds: process.env.ADMIN_USER_IDS?.split(',') || [],
  },

  // OCR configuration
  ocr: {
    apiKey: process.env.OCR_API_KEY,
    dailyLimit: 1000,
    supportedLanguages: ['en', 'ru'],
  },

  // Analytics configuration
  analytics: {
    enabled: true,
    sampleRate: 0.1, // Sample 10% of users
    anonymizeData: true,
  },

  // Logging configuration
  logging: {
    level: 'info',
    format: 'json',
    transports: ['file'],
    filename: 'logs/production.log',
  },

  // Security configuration
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    tokenExpiration: '24h',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50 // limit each IP to 50 requests per windowMs
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