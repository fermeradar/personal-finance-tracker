const Sentry = require('@sentry/node');
const { logger } = require('../../utils/logger');
const { AppError } = require('../../utils/errors/AppError');
const telegramNotification = require('./telegram-notification-service');

class ErrorMonitoringService {
  constructor() {
    this.initialized = false;
    this.sentryEnabled = false;
    this.errorCounts = new Map();
    this.lastErrors = new Map();
    this.errorThresholds = {
      rateLimit: 100, // errors per minute
      critical: 50,   // critical errors per minute
      warning: 200    // total errors per minute
    };
    this.lastSummaryTime = null;
  }

  initialize(config = {}) {
    if (this.initialized) {
      return;
    }

    const {
      dsn,
      environment = process.env.NODE_ENV || 'development',
      tracesSampleRate = 1.0,
      integrations = [],
      errorThresholds = {}
    } = config;

    // Update error thresholds if provided
    this.errorThresholds = {
      ...this.errorThresholds,
      ...errorThresholds
    };

    if (dsn) {
      Sentry.init({
        dsn,
        environment,
        tracesSampleRate,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express(),
          new Sentry.Integrations.Postgres(),
          new Sentry.Integrations.Redis(),
          ...integrations
        ],
        beforeSend(event) {
          // Don't send errors in development
          if (environment === 'development') {
            return null;
          }
          return event;
        },
        // Configure error sampling
        sampleRate: environment === 'production' ? 0.1 : 1.0,
        // Configure performance monitoring
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
        // Configure session tracking
        autoSessionTracking: true,
        // Configure release tracking
        release: process.env.npm_package_version,
        // Configure environment
        environment
      });

      this.sentryEnabled = true;
      logger.info('Sentry error monitoring initialized');
    } else {
      logger.warn('Sentry DSN not provided, using fallback error monitoring');
    }

    // Initialize error tracking
    this.initializeErrorTracking();

    this.initialized = true;
  }

  initializeErrorTracking() {
    // Reset error counts every minute
    setInterval(() => {
      this.errorCounts.clear();
      this.lastErrors.clear();
    }, 60000);
  }

  captureError(error, context = {}) {
    if (!this.initialized) {
      logger.warn('Error monitoring not initialized');
      return;
    }

    // Add common context
    const errorContext = {
      ...context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version
    };

    // If it's our custom error, add its details
    if (error instanceof AppError) {
      errorContext.errorCode = error.code;
      errorContext.statusCode = error.statusCode;
      errorContext.details = error.details;
    }

    // Update error tracking
    this.updateErrorTracking(error);

    // Log the error
    logger.error({
      message: error.message,
      stack: error.stack,
      ...errorContext
    });

    // Send to Sentry if enabled
    if (this.sentryEnabled) {
      Sentry.withScope(scope => {
        // Add context to Sentry scope
        Object.entries(errorContext).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });

        // Set error level based on type and frequency
        const errorLevel = this.determineErrorLevel(error);
        scope.setLevel(errorLevel);

        // Add error tags
        scope.setTag('error_type', error.name || 'UnknownError');
        scope.setTag('error_code', error.code || 'UNKNOWN');
        if (error instanceof AppError) {
          scope.setTag('error_category', this.getErrorCategory(error));
        }

        Sentry.captureException(error);
      });
    }

    // Check error thresholds and trigger alerts if needed
    this.checkErrorThresholds(error);
  }

  captureMessage(message, level = 'info', context = {}) {
    if (!this.initialized) {
      logger.warn('Error monitoring not initialized');
      return;
    }

    // Log the message
    logger[level]({
      message,
      ...context
    });

    // Send to Sentry if enabled
    if (this.sentryEnabled) {
      Sentry.withScope(scope => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureMessage(message, level);
      });
    }
  }

  updateErrorTracking(error) {
    const now = Date.now();
    const errorKey = error.name || 'UnknownError';
    
    // Update error count
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    
    // Update last error
    this.lastErrors.set(errorKey, {
      timestamp: now,
      error: error.message,
      stack: error.stack
    });
  }

  determineErrorLevel(error) {
    if (error instanceof AppError) {
      switch (error.statusCode) {
        case 400:
          return 'warning';
        case 401:
        case 403:
          return 'info';
        case 404:
          return 'debug';
        case 429:
          return 'warning';
        case 500:
          return 'error';
        default:
          return 'error';
      }
    }
    return 'error';
  }

  getErrorCategory(error) {
    if (error instanceof AppError) {
      if (error.name.includes('Database')) return 'database';
      if (error.name.includes('Validation')) return 'validation';
      if (error.name.includes('Authentication')) return 'auth';
      if (error.name.includes('Authorization')) return 'auth';
      if (error.name.includes('NotFound')) return 'resource';
      if (error.name.includes('File')) return 'file';
      if (error.name.includes('RateLimit')) return 'rate_limit';
      if (error.name.includes('Business')) return 'business';
      return 'other';
    }
    return 'unknown';
  }

  checkErrorThresholds(error) {
    const errorKey = error.name || 'UnknownError';
    const currentCount = this.errorCounts.get(errorKey) || 0;
    
    // Check rate limit errors
    if (error instanceof AppError && error.statusCode === 429) {
      if (currentCount > this.errorThresholds.rateLimit) {
        this.triggerAlert('rate_limit', {
          error: errorKey,
          count: currentCount,
          threshold: this.errorThresholds.rateLimit
        });
      }
    }
    
    // Check critical errors
    if (error instanceof AppError && error.statusCode >= 500) {
      if (currentCount > this.errorThresholds.critical) {
        this.triggerAlert('critical', {
          error: errorKey,
          count: currentCount,
          threshold: this.errorThresholds.critical
        });
      }
    }
    
    // Check total errors
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    if (totalErrors > this.errorThresholds.warning) {
      this.triggerAlert('warning', {
        totalErrors,
        threshold: this.errorThresholds.warning
      });
    }
  }

  triggerAlert(type, data) {
    // Log the alert
    logger.warn(`Error monitoring alert: ${type}`, data);
    
    // Send to Sentry if enabled
    if (this.sentryEnabled) {
      Sentry.captureMessage(`Error monitoring alert: ${type}`, {
        level: type === 'critical' ? 'error' : 'warning',
        extra: data
      });
    }
    
    // Send Telegram notification
    telegramNotification.sendErrorAlert(type, data).catch(error => {
      logger.error('Failed to send Telegram notification:', error);
    });
  }

  setUser(user) {
    if (!this.initialized) {
      return;
    }

    if (this.sentryEnabled) {
      Sentry.setUser(user);
    }
  }

  setTag(key, value) {
    if (!this.initialized) {
      return;
    }

    if (this.sentryEnabled) {
      Sentry.setTag(key, value);
    }
  }

  setContext(key, value) {
    if (!this.initialized) {
      return;
    }

    if (this.sentryEnabled) {
      Sentry.setContext(key, value);
    }
  }

  // Get current error statistics
  getErrorStats() {
    const stats = {
      counts: Object.fromEntries(this.errorCounts),
      lastErrors: Object.fromEntries(this.lastErrors),
      thresholds: this.errorThresholds
    };

    // Send periodic error summary to Telegram
    if (this.shouldSendErrorSummary()) {
      telegramNotification.sendErrorSummary(stats).catch(error => {
        logger.error('Failed to send error summary to Telegram:', error);
      });
    }

    return stats;
  }

  shouldSendErrorSummary() {
    // Send summary every hour
    const now = Date.now();
    if (!this.lastSummaryTime || now - this.lastSummaryTime > 3600000) {
      this.lastSummaryTime = now;
      return true;
    }
    return false;
  }
}

// Create singleton instance
const errorMonitoring = new ErrorMonitoringService();

module.exports = errorMonitoring; 