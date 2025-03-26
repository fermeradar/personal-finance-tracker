const { _body, query, validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

const validateMetricsRequest = [
  query('timeframe')
    .optional()
    .isIn(['hourly', 'daily', 'weekly', 'monthly'])
    .withMessage('Invalid timeframe. Must be one of: hourly, daily, weekly, monthly'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  validateRequest
];

const validateAnalyticsRequest = [
  query('timeframe')
    .optional()
    .isIn(['hourly', 'daily', 'weekly', 'monthly'])
    .withMessage('Invalid timeframe. Must be one of: hourly, daily, weekly, monthly'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  query('filters')
    .optional()
    .isJSON()
    .withMessage('Filters must be valid JSON'),
  validateRequest
];

const validateErrorRequest = [
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  query('timeframe')
    .optional()
    .isIn(['hourly', 'daily', 'weekly', 'monthly'])
    .withMessage('Invalid timeframe'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  validateRequest
];

const validateExportRequest = [
  query('format')
    .isIn(['csv', 'excel', 'pdf', 'json'])
    .withMessage('Invalid export format'),
  query('timeframe')
    .optional()
    .isIn(['hourly', 'daily', 'weekly', 'monthly'])
    .withMessage('Invalid timeframe'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  validateRequest
];

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation Error', 400, {
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
}

module.exports = {
  validateMetricsRequest,
  validateAnalyticsRequest,
  validateErrorRequest,
  validateExportRequest
}; 