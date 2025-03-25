const express = require('express');
const router = express.Router();
const { validateMetricsRequest } = require('../../middleware/validation');
const metricsController = require('../../controllers/dashboard/metricsController');
const { asyncHandler } = require('../../utils/asyncHandler');

router.get('/', validateMetricsRequest, asyncHandler(metricsController.getMetrics));
router.get('/system', asyncHandler(metricsController.getSystemMetrics));
router.get('/performance', validateMetricsRequest, asyncHandler(metricsController.getPerformanceMetrics));
router.get('/users', validateMetricsRequest, asyncHandler(metricsController.getUserMetrics));

module.exports = router; 