var express = require('express');
var router = express.Router();
var ActivityLog = require('../models/ActivityLog');
var { authenticateToken } = require('../middleware/auth');
var { isTripMember } = require('../middleware/tripAuth');
var { connectDB } = require('../utils/db');

// All routes require authentication
router.use(authenticateToken);

// Get activity log for a trip
router.get('/:tripId/activity', isTripMember, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    const activities = await ActivityLog.find({ tripId })
      .populate('performedBy', 'username')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await ActivityLog.countDocuments({ tripId });

    res.json({
      success: true,
      data: {
        activities,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity log'
    });
  }
});

module.exports = router;
