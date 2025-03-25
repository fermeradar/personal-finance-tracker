// src/utils/logger.js
const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Simple logger utility
 */
class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '..', '..', 'logs');
    this.currentDate = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `app-${this.currentDate}.log`);
    
    // Create log directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Check if we should change the log file due to date change
    setInterval(() => {
      const newDate = new Date().toISOString().split('T')[0];
      if (newDate !== this.currentDate) {
        this.currentDate = newDate;
        this.logFile = path.join(this.logDir, `app-${this.currentDate}.log`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Format log message
   * @param {String} level - Log level
   * @param {String} message - Log message
   * @param {Object} data - Additional data
   * @returns {String} - Formatted log message
   */
  formatLog(level, message, data) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        logMessage += `\n${util.inspect(data, { depth: null, colors: false })}`;
      } else {
        logMessage += ` ${data}`;
      }
    }
    
    return logMessage;
  }

  /**
   * Write to log file
   * @param {String} message - Log message
   */
  writeToFile(message) {
    fs.appendFileSync(this.logFile, message + '\n');
  }

  /**
   * Write to database log
   * @param {String} level - Log level
   * @param {String} message - Log message
   * @param {Object} data - Additional data
   */
  async writeToDatabase(level, message, data) {
    try {
      // Avoid circular dependency by requiring pool here
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      await pool.query(
        'INSERT INTO system_logs(log_type, log_message, log_details) VALUES($1, $2, $3)',
        [level, message, data ? JSON.stringify(data) : null]
      );
    } catch (error) {
      // Log to file only since DB might be unavailable
      const errorMsg = `Failed to write log to database: ${error.message}`;
      console.error(errorMsg);
      this.writeToFile(`[${new Date().toISOString()}] [ERROR] ${errorMsg}`);
    }
  }

  /**
   * Log info message
   * @param {String} message - Log message
   * @param {Object} data - Additional data
   */
  info(message, data) {
    const formattedMessage = this.formatLog('info', message, data);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
    
    // Only write certain info logs to DB (not cluttering it)
    if (message.includes('error') || message.includes('failed') || message.includes('success')) {
      this.writeToDatabase('info', message, data).catch(() => {});
    }
  }

  /**
   * Log warning message
   * @param {String} message - Log message
   * @param {Object} data - Additional data
   */
  warn(message, data) {
    const formattedMessage = this.formatLog('warn', message, data);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
    this.writeToDatabase('warn', message, data).catch(() => {});
  }

  /**
   * Log error message
   * @param {String} message - Log message
   * @param {Object} data - Additional data
   */
  error(message, data) {
    const formattedMessage = this.formatLog('error', message, data);
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
    this.writeToDatabase('error', message, data).catch(() => {});
  }

  /**
   * Log debug message (only in development)
   * @param {String} message - Log message
   * @param {Object} data - Additional data
   */
  debug(message, data) {
    if (process.env.NODE_ENV !== 'production') {
      const formattedMessage = this.formatLog('debug', message, data);
      console.debug(formattedMessage);
      this.writeToFile(formattedMessage);
    }
  }
}

module.exports = new Logger();
