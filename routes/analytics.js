const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Public route for tracking page views (CORS enabled)
router.post('/track', analyticsController.trackPageView);

// Test endpoint to verify tracking is working (for debugging)
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Analytics endpoint is working',
    timestamp: new Date().toISOString()
  });
});

// Admin routes (protected)
router.get('/dashboard', authenticateAdmin, analyticsController.getDashboardAnalytics);
router.get('/blog', authenticateAdmin, analyticsController.getBlogAnalytics);
router.get('/page', authenticateAdmin, analyticsController.getPageAnalytics);

module.exports = router;
