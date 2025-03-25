const Joi = require('joi');
const { InputValidationError } = require('../utils/errors/AppError');
const { logger } = require('../utils/logger');

// Validation schemas
const schemas = {
  // User schemas
  createUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    language: Joi.string().valid('en', 'ru').default('en'),
    timezone: Joi.string().required(),
    currency: Joi.string().valid('USD', 'EUR', 'RUB').required()
  }),

  updateUser: Joi.object({
    email: Joi.string().email(),
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    language: Joi.string().valid('en', 'ru'),
    timezone: Joi.string(),
    currency: Joi.string().valid('USD', 'EUR', 'RUB')
  }),

  // Expense schemas
  createExpense: Joi.object({
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid('USD', 'EUR', 'RUB').required(),
    categoryId: Joi.string().uuid().required(),
    description: Joi.string().max(500).required(),
    date: Joi.date().iso().required(),
    paymentMethod: Joi.string().valid('cash', 'card', 'transfer').required(),
    merchant: Joi.string().max(100),
    tags: Joi.array().items(Joi.string().max(50)),
    receiptUrl: Joi.string().uri()
  }),

  updateExpense: Joi.object({
    amount: Joi.number().positive(),
    currency: Joi.string().valid('USD', 'EUR', 'RUB'),
    categoryId: Joi.string().uuid(),
    description: Joi.string().max(500),
    date: Joi.date().iso(),
    paymentMethod: Joi.string().valid('cash', 'card', 'transfer'),
    merchant: Joi.string().max(100),
    tags: Joi.array().items(Joi.string().max(50)),
    receiptUrl: Joi.string().uri()
  }),

  // Category schemas
  createCategory: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    icon: Joi.string().max(50).required(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
    isSystem: Joi.boolean().default(false)
  }),

  updateCategory: Joi.object({
    name: Joi.string().min(2).max(100),
    icon: Joi.string().max(50),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    isSystem: Joi.boolean()
  }),

  // Query schemas
  expenseQuery: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    categoryId: Joi.string().uuid(),
    minAmount: Joi.number().positive(),
    maxAmount: Joi.number().positive().min(Joi.ref('minAmount')),
    currency: Joi.string().valid('USD', 'EUR', 'RUB'),
    paymentMethod: Joi.string().valid('cash', 'card', 'transfer'),
    merchant: Joi.string().max(100),
    tags: Joi.array().items(Joi.string().max(50)),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),

  // File upload schemas
  fileUpload: Joi.object({
    file: Joi.object({
      mimetype: Joi.string().valid('image/jpeg', 'image/png', 'application/pdf').required(),
      size: Joi.number().max(5 * 1024 * 1024).required() // 5MB max
    }).required()
  })
};

// Create validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate request body
      if (req.body && Object.keys(req.body).length > 0) {
        const { error: bodyError } = schema.validate(req.body, { abortEarly: false });
        if (bodyError) {
          throw new InputValidationError('Invalid request body', bodyError.details);
        }
      }

      // Validate query parameters
      if (req.query && Object.keys(req.query).length > 0) {
        const { error: queryError } = schema.validate(req.query, { abortEarly: false });
        if (queryError) {
          throw new InputValidationError('Invalid query parameters', queryError.details);
        }
      }

      // Validate URL parameters
      if (req.params && Object.keys(req.params).length > 0) {
        const { error: paramsError } = schema.validate(req.params, { abortEarly: false });
        if (paramsError) {
          throw new InputValidationError('Invalid URL parameters', paramsError.details);
        }
      }

      next();
    } catch (error) {
      logger.error('Validation error:', error);
      next(error);
    }
  };
};

// Create file validation middleware
const validateFile = (schema) => {
  return (req, res, next) => {
    try {
      if (!req.file) {
        throw new InputValidationError('No file uploaded');
      }

      const { error } = schema.validate({ file: req.file }, { abortEarly: false });
      if (error) {
        throw new InputValidationError('Invalid file', error.details);
      }

      next();
    } catch (error) {
      logger.error('File validation error:', error);
      next(error);
    }
  };
};

module.exports = {
  schemas,
  validate,
  validateFile
}; 