var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Admin = require('../models/Admin');
var { connectDB } = require('../app');

// One-time admin registration route - /kuthera
// This route can only be used once to create the first admin
router.post('/', async function(req, res) {
  try {
    await connectDB();

    // Check if any admin already exists
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      return res.status(403).json({
        success: false,
        error: 'Admin registration is disabled. An admin already exists.'
      });
    }

    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if username or email already exists
    const existingAdmin = await Admin.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Create admin
    const admin = new Admin({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: password, // Will be hashed by pre-save hook
      role: 'superadmin'
    });

    await admin.save();

    res.json({
      success: true,
      message: 'Admin registered successfully',
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});

module.exports = router;
