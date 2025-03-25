class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

// Database Errors
class DatabaseError extends AppError {
  constructor(message, details = {}) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

class DatabaseConnectionError extends DatabaseError {
  constructor(message = 'Database connection failed', details = {}) {
    super(message, { ...details, type: 'CONNECTION_ERROR' });
  }
}

class DatabaseQueryError extends DatabaseError {
  constructor(message = 'Database query failed', details = {}) {
    super(message, { ...details, type: 'QUERY_ERROR' });
  }
}

class DatabaseTransactionError extends DatabaseError {
  constructor(message = 'Database transaction failed', details = {}) {
    super(message, { ...details, type: 'TRANSACTION_ERROR' });
  }
}

// Validation Errors
class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class InputValidationError extends ValidationError {
  constructor(message = 'Invalid input data', details = {}) {
    super(message, { ...details, type: 'INPUT_VALIDATION' });
  }
}

class SchemaValidationError extends ValidationError {
  constructor(message = 'Schema validation failed', details = {}) {
    super(message, { ...details, type: 'SCHEMA_VALIDATION' });
  }
}

class CurrencyValidationError extends ValidationError {
  constructor(message = 'Invalid currency', details = {}) {
    super(message, { ...details, type: 'CURRENCY_VALIDATION' });
  }
}

class DateValidationError extends ValidationError {
  constructor(message = 'Invalid date format or range', details = {}) {
    super(message, { ...details, type: 'DATE_VALIDATION' });
  }
}

// Authentication & Authorization Errors
class AuthenticationError extends AppError {
  constructor(message, details = {}) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

class TokenError extends AuthenticationError {
  constructor(message = 'Token validation failed', details = {}) {
    super(message, { ...details, type: 'TOKEN_ERROR' });
  }
}

class TokenExpiredError extends TokenError {
  constructor(message = 'Token has expired', details = {}) {
    super(message, { ...details, type: 'TOKEN_EXPIRED' });
  }
}

class InvalidCredentialsError extends AuthenticationError {
  constructor(message = 'Invalid credentials', details = {}) {
    super(message, { ...details, type: 'INVALID_CREDENTIALS' });
  }
}

class AuthorizationError extends AppError {
  constructor(message, details = {}) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

class InsufficientPermissionsError extends AuthorizationError {
  constructor(message = 'Insufficient permissions', details = {}) {
    super(message, { ...details, type: 'INSUFFICIENT_PERMISSIONS' });
  }
}

class ResourceAccessError extends AuthorizationError {
  constructor(message = 'Access to resource denied', details = {}) {
    super(message, { ...details, type: 'RESOURCE_ACCESS' });
  }
}

// Resource Errors
class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ResourceConflictError extends AppError {
  constructor(message = 'Resource conflict', details = {}) {
    super(message, 409, 'RESOURCE_CONFLICT', details);
  }
}

class DuplicateResourceError extends ResourceConflictError {
  constructor(message = 'Resource already exists', details = {}) {
    super(message, { ...details, type: 'DUPLICATE_RESOURCE' });
  }
}

// External Service Errors
class ExternalServiceError extends AppError {
  constructor(message, details = {}) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

class APIError extends ExternalServiceError {
  constructor(message = 'External API error', details = {}) {
    super(message, { ...details, type: 'API_ERROR' });
  }
}

class ServiceUnavailableError extends ExternalServiceError {
  constructor(message = 'Service temporarily unavailable', details = {}) {
    super(message, { ...details, type: 'SERVICE_UNAVAILABLE' });
  }
}

class RateLimitError extends AppError {
  constructor(message, details = {}) {
    super(message, 429, 'RATE_LIMIT_ERROR', details);
  }
}

class RateLimitExceededError extends RateLimitError {
  constructor(message = 'Rate limit exceeded', details = {}) {
    super(message, { ...details, type: 'RATE_LIMIT_EXCEEDED' });
  }
}

// Business Logic Errors
class BusinessLogicError extends AppError {
  constructor(message, details = {}) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR', details);
  }
}

class InvalidOperationError extends BusinessLogicError {
  constructor(message = 'Invalid operation', details = {}) {
    super(message, { ...details, type: 'INVALID_OPERATION' });
  }
}

class StateTransitionError extends BusinessLogicError {
  constructor(message = 'Invalid state transition', details = {}) {
    super(message, { ...details, type: 'STATE_TRANSITION' });
  }
}

// File Processing Errors
class FileProcessingError extends AppError {
  constructor(message, details = {}) {
    super(message, 422, 'FILE_PROCESSING_ERROR', details);
  }
}

class FileUploadError extends FileProcessingError {
  constructor(message = 'File upload failed', details = {}) {
    super(message, { ...details, type: 'FILE_UPLOAD' });
  }
}

class FileValidationError extends FileProcessingError {
  constructor(message = 'File validation failed', details = {}) {
    super(message, { ...details, type: 'FILE_VALIDATION' });
  }
}

class FileSizeError extends FileValidationError {
  constructor(message = 'File size exceeds limit', details = {}) {
    super(message, { ...details, type: 'FILE_SIZE' });
  }
}

class FileTypeError extends FileValidationError {
  constructor(message = 'Invalid file type', details = {}) {
    super(message, { ...details, type: 'FILE_TYPE' });
  }
}

module.exports = {
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
}; 