const axios = require('axios');
const { logger } = require('../../utils/logger');

class TelegramNotificationService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.enabled = Boolean(this.botToken && this.chatId);
  }

  async sendMessage(message, options = {}) {
    if (!this.enabled) {
      logger.warn('Telegram notifications are not configured');
      return;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      logger.info('Telegram notification sent successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to send Telegram notification:', error.message);
      throw error;
    }
  }

  formatErrorAlert(type, data) {
    const timestamp = new Date().toISOString();
    let message = `<b>🚨 Error Alert: ${type.toUpperCase()}</b>\n\n`;

    // Add environment and version info
    message += `<b>Environment:</b> ${process.env.NODE_ENV || 'development'}\n`;
    message += `<b>Version:</b> ${process.env.npm_package_version || 'unknown'}\n\n`;

    switch (type) {
      case 'rate_limit':
        message += `<b>Rate Limit Details:</b>\n`;
        message += `• Error Type: ${data.error}\n`;
        message += `• Current Count: ${data.count}\n`;
        message += `• Threshold: ${data.threshold}\n`;
        if (data.context) {
          message += `• Endpoint: ${data.context.path || 'unknown'}\n`;
          message += `• Method: ${data.context.method || 'unknown'}\n`;
          message += `• IP: ${data.context.ip || 'unknown'}\n`;
        }
        break;

      case 'critical':
        message += `<b>Critical Error Details:</b>\n`;
        message += `• Error Type: ${data.error}\n`;
        message += `• Current Count: ${data.count}\n`;
        message += `• Threshold: ${data.threshold}\n`;
        if (data.context) {
          message += `• User ID: ${data.context.userId || 'unknown'}\n`;
          message += `• Action: ${data.context.action || 'unknown'}\n`;
          message += `• Stack Trace:\n<code>${data.context.stack?.slice(0, 500) || 'No stack trace'}</code>\n`;
        }
        break;

      case 'warning':
        message += `<b>Warning Details:</b>\n`;
        message += `• Total Errors: ${data.totalErrors}\n`;
        message += `• Threshold: ${data.threshold}\n`;
        if (data.context) {
          message += `• Error Types:\n`;
          Object.entries(data.context.errorTypes || {}).forEach(([type, count]) => {
            message += `  - ${type}: ${count}\n`;
          });
        }
        break;

      default:
        message += `<b>Error Details:</b>\n`;
        message += `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }

    // Add timestamp and request ID if available
    message += `\n<b>Timestamp:</b> ${timestamp}`;
    if (data.context?.requestId) {
      message += `\n<b>Request ID:</b> ${data.context.requestId}`;
    }

    return message;
  }

  async sendErrorAlert(type, data) {
    const message = this.formatErrorAlert(type, data);
    await this.sendMessage(message);
  }

  async sendErrorSummary(stats) {
    const message = this.formatErrorSummary(stats);
    await this.sendMessage(message);
  }

  formatErrorSummary(stats) {
    const timestamp = new Date().toISOString();
    let message = `<b>📊 Error Summary Report</b>\n\n`;

    // Add environment and version info
    message += `<b>Environment:</b> ${process.env.NODE_ENV || 'development'}\n`;
    message += `<b>Version:</b> ${process.env.npm_package_version || 'unknown'}\n\n`;

    // Add error counts with categories
    message += `<b>Error Counts by Category:</b>\n`;
    const categories = this.categorizeErrors(stats.counts);
    Object.entries(categories).forEach(([category, errors]) => {
      message += `\n<b>${category}:</b>\n`;
      errors.forEach(({ name, count }) => {
        message += `• ${name}: ${count}\n`;
      });
    });

    // Add last errors with more details
    message += `\n<b>Recent Errors:</b>\n`;
    Object.entries(stats.lastErrors).forEach(([error, details]) => {
      message += `\n<b>${error}:</b>\n`;
      message += `• Time: ${new Date(details.timestamp).toLocaleString()}\n`;
      message += `• Message: ${details.error}\n`;
      if (details.context) {
        message += `• User: ${details.context.userId || 'unknown'}\n`;
        message += `• Action: ${details.context.action || 'unknown'}\n`;
      }
      if (details.stack) {
        message += `• Stack:\n<code>${details.stack.slice(0, 200)}...</code>\n`;
      }
    });

    // Add thresholds and status
    message += `\n<b>Thresholds:</b>\n`;
    Object.entries(stats.thresholds).forEach(([type, value]) => {
      const currentValue = this.getCurrentValue(stats, type);
      const status = currentValue > value ? '⚠️ Exceeded' : '✅ Normal';
      message += `• ${type}: ${value} (${status})\n`;
    });

    message += `\n<b>Generated at:</b> ${timestamp}`;
    return message;
  }

  categorizeErrors(errorCounts) {
    const categories = {
      'Database': [],
      'Validation': [],
      'Authentication': [],
      'Authorization': [],
      'File Processing': [],
      'Rate Limiting': [],
      'Business Logic': [],
      'Other': []
    };

    Object.entries(errorCounts).forEach(([error, count]) => {
      const errorInfo = { name: error, count };
      if (error.includes('Database')) categories['Database'].push(errorInfo);
      else if (error.includes('Validation')) categories['Validation'].push(errorInfo);
      else if (error.includes('Auth')) categories['Authentication'].push(errorInfo);
      else if (error.includes('File')) categories['File Processing'].push(errorInfo);
      else if (error.includes('RateLimit')) categories['Rate Limiting'].push(errorInfo);
      else if (error.includes('Business')) categories['Business Logic'].push(errorInfo);
      else categories['Other'].push(errorInfo);
    });

    // Remove empty categories
    return Object.fromEntries(
      Object.entries(categories).filter(([_, errors]) => errors.length > 0)
    );
  }

  getCurrentValue(stats, type) {
    switch (type) {
      case 'rateLimit':
        return Math.max(...Object.values(stats.counts));
      case 'critical':
        return Object.entries(stats.counts)
          .filter(([error]) => error.includes('Critical'))
          .reduce((sum, [_, count]) => sum + count, 0);
      case 'warning':
        return Object.values(stats.counts).reduce((sum, count) => sum + count, 0);
      default:
        return 0;
    }
  }
}

// Create singleton instance
const telegramNotification = new TelegramNotificationService();

module.exports = telegramNotification; 