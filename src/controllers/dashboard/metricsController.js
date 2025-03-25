const metricsService = require('../../services/dashboard/metricsService');
const { AppError } = require('../../utils/errors');

const getMetrics = async (req, res, next) => {
  try {
    const { timeframe, days } = req.query;
    const metrics = await metricsService.getMetrics(timeframe, days);
    res.json({
      success: true,
      data: metrics,
      message: 'Metrics retrieved successfully'
    });
  } catch (error) {
    next(new AppError('Failed to retrieve metrics', 500, error));
  }
};

const getSystemMetrics = async (req, res, next) => {
  try {
    const metrics = await metricsService.getSystemMetrics();
    res.json({
      success: true,
      data: metrics,
      message: 'System metrics retrieved successfully'
    });
  } catch (error) {
    next(new AppError('Failed to retrieve system metrics', 500, error));
  }
};

const getPerformanceMetrics = async (req, res, next) => {
  try {
    const { timeframe, days } = req.query;
    const metrics = await metricsService.getPerformanceMetrics(timeframe, days);
    res.json({
      success: true,
      data: metrics,
      message: 'Performance metrics retrieved successfully'
    });
  } catch (error) {
    next(new AppError('Failed to retrieve performance metrics', 500, error));
  }
};

const getUserMetrics = async (req, res, next) => {
  try {
    const { timeframe, days } = req.query;
    const metrics = await metricsService.getUserMetrics(timeframe, days);
    res.json({
      success: true,
      data: metrics,
      message: 'User metrics retrieved successfully'
    });
  } catch (error) {
    next(new AppError('Failed to retrieve user metrics', 500, error));
  }
};

module.exports = {
  getMetrics,
  getSystemMetrics,
  getPerformanceMetrics,
  getUserMetrics
}; 