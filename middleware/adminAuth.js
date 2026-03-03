const { authenticateToken } = require('./auth');
const Admin = require('../models/Admin');

/**
 * Middleware to authenticate admin users
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    // First authenticate the token
    authenticateToken(req, res, async () => {
      // Check if user is admin
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Check if user has admin role or is in Admin collection
      const admin = await Admin.findById(req.user.id);
      
      if (!admin && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      req.admin = admin || { _id: req.user.id, role: 'admin' };
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

module.exports = { authenticateAdmin };
