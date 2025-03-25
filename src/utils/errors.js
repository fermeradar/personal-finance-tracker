class AppError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, {
      code: 'VALIDATION_ERROR',
      details
    });
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, {
      code: 'AUTHENTICATION_ERROR'
    });
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 403, {
      code: 'AUTHORIZATION_ERROR'
    });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, {
      code: 'NOT_FOUND_ERROR'
    });
  }
}

class DatabaseError extends AppError {
  constructor(message, details) {
    super(message, 500, {
      code: 'DATABASE_ERROR',
      details
    });
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.details?.code || 'INTERNAL_ERROR',
        message: err.message,
        stack: err.stack,
        details: err.details
      }
    });
  } else {
    // Production error response
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.details?.code || 'INTERNAL_ERROR',
          message: err.message,
          details: err.details
        }
      });
    } else {
      // Programming or unknown errors
      console.error('ERROR 💥', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong!'
        }
      });
    }
  }
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  errorHandler
}; 