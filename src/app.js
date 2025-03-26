let dashboardRoutes;
let $2;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { logger } = require('./utils/logger');
const monitoringService = require('./services/monitoring/monitoring-service');
const analyticsService = require('./services/monitoring/analytics-service');
const healthCheckService = require('./services/monitoring/health-check-service');
const healthRoutes = require('./routes/health');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const securityHeaders = require('./middleware/securityHeaders');
const _dashboard = require($2);
const { rateLimit } = require('express-rate-limit');
const { _body, _validationResult } = require('express-validator');
const jwt = require('express-jwt');
const _TelegramBot = require($2);
const _winston = require($2);
const _moment = require($2);
const { _pool, validateConnection, closePool } = require('./config/database');

const app = express();

// Initialize monitoring
app.use(monitoringService.trackRequest.bind(monitoringService));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.telegram.org"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin']
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// JWT authentication
const _jwtMiddleware = jwt({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  algorithms: ['HS256']
}).unless({
  path: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/health',
    '/api/metrics/export'
  ]
});

// Basic middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Security middleware
app.use(securityHeaders);
app.use(rateLimiter);

// Routes
app.use('/api/health', healthRoutes);
app.use('/dashboard', dashboardRoutes);

// Track user activity
app.use((req, res, next) => {
  if (req.user) {
    analyticsService.trackUserAction(req.user.id, req.method, {
      path: req.path,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      feature: req.path.split('/')[2] // Extract feature from path
    });
  }
  next();
});

// Error handling
app.use(errorHandler);

// Database connection validation middleware
app.use(async (req, res, next) => {
  try {
    const isValid = await validateConnection();
    if (!isValid) {
      return res.status(503).json({ error: 'Database connection unavailable' });
    }
    next();
  } catch (error) {
    logger.error('Database validation error:', error);
    res.status(503).json({ error: 'Database connection error' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await validateConnection();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus ? 'connected' : 'disconnected',
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  
  try {
    // Close database connections
    await healthCheckService.cleanup();
    
    // Clean up monitoring data
    await monitoringService.cleanup();
    
    // Clean up analytics data
    await analyticsService.cleanupOldData();
    
    await closePool();
    
    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  try {
    const dbStatus = await validateConnection();
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Database connection: ${dbStatus ? 'successful' : 'failed'}`);
  } catch (error) {
    logger.error('Server startup error:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await closePool();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app; 