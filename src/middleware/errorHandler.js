const { logger } = require('../utils/logger');
const errorMonitoring = require('../services/monitoring/error-monitoring-service');
const {
  AppError,
  // Database Errors
  DatabaseError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DatabaseTransactionError,
  // Validation Errors
  ValidationError,
  InputValidationError,
  SchemaValidationError,
  CurrencyValidationError,
  DateValidationError,
  // Authentication & Authorization Errors
  AuthenticationError,
  TokenError,
  TokenExpiredError,
  InvalidCredentialsError,
  AuthorizationError,
  InsufficientPermissionsError,
  ResourceAccessError,
  // Resource Errors
  NotFoundError,
  ResourceConflictError,
  DuplicateResourceError,
  // External Service Errors
  ExternalServiceError,
  APIError,
  ServiceUnavailableError,
  // Rate Limiting Errors
  RateLimitError,
  RateLimitExceededError,
  // Business Logic Errors
  BusinessLogicError,
  InvalidOperationError,
  StateTransitionError,
  // File Processing Errors
  FileProcessingError,
  FileUploadError,
  FileValidationError,
  FileSizeError,
  FileTypeError
} = require('../utils/errors/AppError');

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  // Prepare error context
  const errorContext = {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    query: req.query,
    body: req.body,
    headers: req.headers
  };

  // Capture error with monitoring service
  errorMonitoring.captureError(err, errorContext);

  // If it's our custom error, send the formatted response
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle specific known errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: err.message,
      details: err.errors
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Invalid token provided',
      details: { type: 'JWT_ERROR' }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      code: 'TOKEN_EXPIRED',
      message: 'Token has expired',
      details: { type: 'JWT_EXPIRED' }
    });
  }

  // Handle database errors
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      status: 'error',
      code: 'DUPLICATE_ENTRY',
      message: 'Resource already exists',
      details: { type: 'UNIQUE_VIOLATION' }
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      status: 'error',
      code: 'FOREIGN_KEY_VIOLATION',
      message: 'Invalid reference to related resource',
      details: { type: 'FOREIGN_KEY_ERROR' }
    });
  }

  if (err.code === '42P01') { // Undefined table
    return res.status(500).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'Database table not found',
      details: { type: 'UNDEFINED_TABLE' }
    });
  }

  if (err.code === '28000') { // Invalid input syntax
    return res.status(400).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'Invalid input syntax',
      details: { type: 'INVALID_SYNTAX' }
    });
  }

  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'error',
      code: 'FILE_SIZE_ERROR',
      message: 'File size exceeds limit',
      details: { type: 'FILE_SIZE_LIMIT' }
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      status: 'error',
      code: 'FILE_COUNT_ERROR',
      message: 'Too many files uploaded',
      details: { type: 'FILE_COUNT_LIMIT' }
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      status: 'error',
      code: 'FILE_TYPE_ERROR',
      message: 'Unexpected file type',
      details: { type: 'UNEXPECTED_FILE_TYPE' }
    });
  }

  // Handle rate limiting errors
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests',
      details: { type: 'RATE_LIMIT_EXCEEDED' }
    });
  }

  // Handle network errors
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      status: 'error',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
      details: { type: 'CONNECTION_REFUSED' }
    });
  }

  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      status: 'error',
      code: 'GATEWAY_TIMEOUT',
      message: 'Request timed out',
      details: { type: 'TIMEOUT' }
    });
  }

  // Default error
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    details: {
      type: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    },
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  errorMonitoring.captureError(error, {
    path: req.path,
    method: req.method
  });
  next(error);
};

// Method not allowed handler
const methodNotAllowedHandler = (req, res, next) => {
  const error = new BusinessLogicError(`Method ${req.method} not allowed for ${req.originalUrl}`);
  errorMonitoring.captureError(error, {
    path: req.path,
    method: req.method
  });
  next(error);
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  methodNotAllowedHandler
}; 