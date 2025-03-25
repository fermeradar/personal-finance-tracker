const winston = require('winston');
const { format } = winston;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to winston
winston.addColors(colors);

// Create the format for our logs
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  format.colorize({ all: true }),
  format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define which transports to use based on environment
const transports = [
  // Write all logs to console
  new winston.transports.Console(),
  // Write all logs error (and above) to error.log
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  // Write all logs to combined.log
  new winston.transports.File({ filename: 'logs/combined.log' }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format: logFormat,
  transports,
  // Don't exit on error
  exitOnError: false,
});

// Create a stream object for Morgan integration
const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
};

// Add error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode,
    details: err.details,
    method: req.method,
    url: req.url,
    userId: req.user?.id
  });
  
  next(err);
};

module.exports = {
  logger,
  stream,
  requestLogger,
  errorLogger
}; 