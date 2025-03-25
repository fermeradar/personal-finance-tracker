module.exports = {
  // Sentry configuration
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      // Add any additional Sentry integrations here
    ]
  },

  // Logging configuration
  logging: {
    // Log file paths
    errorLog: 'logs/error.log',
    combinedLog: 'logs/combined.log',
    
    // Log levels
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    
    // Log rotation settings
    maxSize: '20m',
    maxFiles: '14d',
    
    // Log format
    format: {
      timestamp: 'YYYY-MM-DD HH:mm:ss:ms',
      colorize: true
    }
  },

  // Error handling configuration
  errorHandling: {
    // Whether to expose error details in production
    exposeErrors: process.env.NODE_ENV === 'development',
    
    // Custom error messages
    messages: {
      default: 'An unexpected error occurred',
      validation: 'Validation failed',
      notFound: 'Resource not found',
      unauthorized: 'Unauthorized access',
      forbidden: 'Access forbidden',
      rateLimit: 'Too many requests'
    },
    
    // Error codes
    codes: {
      validation: 'VALIDATION_ERROR',
      notFound: 'NOT_FOUND',
      unauthorized: 'UNAUTHORIZED',
      forbidden: 'FORBIDDEN',
      rateLimit: 'RATE_LIMIT_ERROR',
      database: 'DATABASE_ERROR',
      external: 'EXTERNAL_SERVICE_ERROR'
    }
  }
}; 