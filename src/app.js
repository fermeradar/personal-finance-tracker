const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const { errorHandler } = require('./middleware/errorHandler');
const { securityHeadersMiddleware } = require('./middleware/securityHeaders');
const { rateLimiter } = require('./middleware/rateLimiter');
const { logger } = require('./utils/logger');

const app = express();

// Basic middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Security middleware
app.use(securityHeadersMiddleware);
app.use(cors());

// Rate limiting
app.use('/api/auth', rateLimiter.auth);
app.use('/api', rateLimiter.api);
app.use('/api/upload', rateLimiter.upload);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/upload', require('./routes/upload'));

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

module.exports = app; 