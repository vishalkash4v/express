var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Admin = require('../models/Admin');
var { authenticateToken, generateToken } = require('../middleware/auth');
var { connectDB } = require('../app');

// Helper function to ensure DB connection
async function ensureConnection() {
  try {
    await connectDB();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

// Initialize default admin if no admin exists
async function initializeAdmin() {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const defaultAdmin = new Admin({
        username: 'admin',
        email: 'admin@fyntools.com',
        password: 'admin123', // Will be hashed by pre-save hook
        role: 'superadmin'
      });
      await defaultAdmin.save();
      console.log('Default admin created: username=admin, password=admin123');
    }
  } catch (error) {
    console.error('Error initializing admin:', error);
  }
}

// Admin Login
router.post('/login', async function(req, res) {
  try {
    await ensureConnection();
    await initializeAdmin();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find admin by username or email
    const admin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() }
      ],
      isActive: true
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Compare password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login
    admin.lastLogin = Date.now();
    await admin.save();

    // Generate JWT token
    const token = generateToken(admin);

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

// Admin Logout (client-side token removal, but we log it here)
router.post('/logout', authenticateToken, async function(req, res) {
  try {
    // Since we're using stateless JWT, logout is handled client-side
    // But we can log the logout event here
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Change Password
router.post('/change-password', authenticateToken, async function(req, res) {
  try {
    await ensureConnection();

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Find admin by ID from token
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    // Verify current password
    const isPasswordValid = await admin.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    await admin.updatePassword(newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

// Get Admin Profile (protected route)
router.get('/profile', authenticateToken, async function(req, res) {
  try {
    await ensureConnection();

    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get Dashboard Stats (protected route)
router.get('/stats', authenticateToken, async function(req, res) {
  try {
    await ensureConnection();
    const ShortUrl = require('../models/ShortUrl');

    const totalUrls = await ShortUrl.countDocuments();
    const totalClicks = await ShortUrl.aggregate([
      { $group: { _id: null, total: { $sum: '$clickCount' } } }
    ]);
    const activeUrls = await ShortUrl.countDocuments({ isActive: true });
    
    // Recent URLs (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUrls = await ShortUrl.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      data: {
        totalUrls,
        totalClicks: totalClicks[0]?.total || 0,
        activeUrls,
        recentUrls
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get All Short URLs (protected route)
router.get('/shorturls', authenticateToken, async function(req, res) {
  try {
    await ensureConnection();
    const ShortUrl = require('../models/ShortUrl');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (search) {
      query = {
        $or: [
          { shortCode: { $regex: search, $options: 'i' } },
          { originalUrl: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const total = await ShortUrl.countDocuments(query);
    const urls = await ShortUrl.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    res.json({
      success: true,
      data: {
        urls,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get short URLs error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete Short URL (protected route)
router.delete('/shorturls/:id', authenticateToken, async function(req, res) {
  try {
    await ensureConnection();
    const ShortUrl = require('../models/ShortUrl');

    const { id } = req.params;

    const shortUrl = await ShortUrl.findByIdAndDelete(id);

    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'Short URL not found'
      });
    }

    res.json({
      success: true,
      message: 'Short URL deleted successfully'
    });
  } catch (error) {
    console.error('Delete short URL error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
