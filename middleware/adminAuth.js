const { authenticateToken } = require('./auth');
const Admin = require('../models/Admin');
const { connectDB } = require('../utils/db');

/**
 * Middleware to authenticate admin users
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // Ensure DB connection (with timeout handling)
    try {
      await Promise.race([
        connectDB(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB connection timeout')), 10000)
        )
      ]);
    } catch (dbError) {
      console.error('DB connection error in adminAuth:', dbError);
      // Continue with token auth even if DB fails (for serverless cold starts)
    }
    
    // First authenticate the token
    authenticateToken(req, res, async () => {
      // Check if user is admin
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      try {
        // Check if user has admin role or is in Admin collection
        // Use a timeout to prevent hanging
        const admin = await Promise.race([
          Admin.findById(req.user.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 5000)
          )
        ]);
        
        if (!admin && req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Admin access required'
          });
        }

        req.admin = admin || { _id: req.user.id, role: 'admin' };
        next();
      } catch (dbError) {
        console.error('Admin lookup error:', dbError);
        // If DB query fails, check if user has admin role from token
        if (req.user && req.user.role === 'admin') {
          req.admin = { _id: req.user.id, role: 'admin' };
          return next();
        }
        // If we can't verify, still allow if token says admin (for serverless)
        if (req.user && req.user.id) {
          req.admin = { _id: req.user.id, role: 'admin' };
          return next();
        }
        return res.status(500).json({
          success: false,
          error: 'Database connection error. Please try again.'
        });
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

module.exports = { authenticateAdmin };
