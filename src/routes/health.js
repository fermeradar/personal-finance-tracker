const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoring/monitoring-service');
const healthCheckService = require('../services/monitoring/health-check-service');
const analyticsService = require('../services/monitoring/analytics-service');

// Basic health check
router.get('/', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.runHealthChecks();
    const metrics = await monitoringService.getUsageStats();
    
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      health: healthStatus,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: error.message
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const healthStatus = await healthCheckService.runHealthChecks();
    const metrics = await monitoringService.getUsageStats();
    const analytics = await analyticsService.getAnalytics('daily');
    
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      health: healthStatus,
      metrics,
      analytics: analytics[0] // Latest daily analytics
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: error.message
    });
  }
});

// Feature usage analytics
router.get('/analytics/features', async (req, res) => {
  try {
    const features = await analyticsService.getFeatureUsage();
    res.json({
      status: 'success',
      timestamp: Date.now(),
      features
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: error.message
    });
  }
});

// Specific feature analytics
router.get('/analytics/features/:feature', async (req, res) => {
  try {
    const analytics = await analyticsService.getFeatureAnalytics(req.params.feature);
    if (!analytics) {
      return res.status(404).json({
        status: 'error',
        message: 'Feature not found'
      });
    }
    res.json({
      status: 'success',
      timestamp: Date.now(),
      feature: req.params.feature,
      analytics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: error.message
    });
  }
});

// Historical analytics
router.get('/analytics/historical', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'daily';
    const analytics = await analyticsService.getAnalytics(timeframe);
    res.json({
      status: 'success',
      timestamp: Date.now(),
      timeframe,
      analytics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: Date.now(),
      error: error.message
    });
  }
});

module.exports = router; 