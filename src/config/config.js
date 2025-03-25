import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'personal_finance',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    notificationChatId: process.env.TELEGRAM_NOTIFICATION_CHAT_ID,
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    bcryptSaltRounds: 10,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
}; 