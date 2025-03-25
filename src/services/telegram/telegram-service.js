import { Bot } from 'grammy';
import { config } from '../../config/config.js';
import { logger } from '../../utils/logger.js';

class TelegramService {
  constructor() {
    if (!config.telegram.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }
    this.bot = new Bot(config.telegram.botToken);
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.bot.catch((err) => {
      logger.error('Error in Telegram bot:', err);
    });
  }

  async sendMessage(chatId, message, options = {}) {
    try {
      const result = await this.bot.api.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        ...options,
      });
      return result;
    } catch (error) {
      logger.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  async sendNotification(message) {
    if (!config.telegram.notificationChatId) {
      throw new Error('TELEGRAM_NOTIFICATION_CHAT_ID is not set');
    }
    return this.sendMessage(config.telegram.notificationChatId, message);
  }

  async start() {
    try {
      await this.bot.start();
      logger.info('Telegram bot started successfully');
    } catch (error) {
      logger.error('Failed to start Telegram bot:', error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.bot.stop();
      logger.info('Telegram bot stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Telegram bot:', error);
      throw error;
    }
  }
}

export const telegramService = new TelegramService(); 