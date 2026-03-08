const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Public route for tracking page views
router.post('/track', analyticsController.trackPageView);

// Admin routes (protected)
router.get('/dashboard', authenticateAdmin, analyticsController.getDashboardAnalytics);
router.get('/page', authenticateAdmin, analyticsController.getPageAnalytics);

module.exports = router;
