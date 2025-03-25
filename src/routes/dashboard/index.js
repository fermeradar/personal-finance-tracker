const express = require('express');
const router = express.Router();
const { authMiddleware, apiLimiter } = require('../../middleware/auth');
const metricsRoutes = require('./metrics');
const analyticsRoutes = require('./analytics');
const errorsRoutes = require('./errors');
const exportsRoutes = require('./exports');

// Apply authentication and rate limiting to all dashboard routes
router.use(authMiddleware);
router.use(apiLimiter);

// Mount modular routes
router.use('/api/metrics', metricsRoutes);
router.use('/api/analytics', analyticsRoutes);
router.use('/api/errors', errorsRoutes);
router.use('/api/export', exportsRoutes);

// Main dashboard view
router.get('/', (req, res) => {
  res.render('dashboard/index', {
    title: 'Dashboard',
    user: req.user
  });
});

module.exports = router; 