var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Admin = require('../models/Admin');
var { connectDB } = require('../utils/db');

// One-time admin registration route - /kuthera
// This route can only be used once to create the first admin
router.post('/', async function(req, res) {
  try {
    // Ensure MongoDB connection
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cqlsysvishal:Lukethedog1234@cluster0.gcqrn8m.mongodb.net/fyntools?retryWrites=true&w=majority&appName=Cluster0';
    
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
        console.log('MongoDB connected in register route');
      } catch (connectError) {
        console.error('Failed to connect to MongoDB in register route:', connectError);
        return res.status(503).json({
          success: false,
          error: 'Database connection not available. Please try again later.'
        });
      }
    }
    
    // Try connectDB as well (uses caching)
    try {
      await connectDB();
    } catch (dbError) {
      // Non-fatal if already connected
      if (mongoose.connection.readyState !== 1) {
        throw dbError;
      }
    }

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
    console.log('Creating admin with:', { username: username.toLowerCase(), email: email.toLowerCase(), role: 'superadmin' });
    
    const admin = new Admin({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: password, // Will be hashed by pre-save hook
      role: 'superadmin'
    });

    console.log('Admin object created, saving...');
    await admin.save();
    console.log('Admin saved successfully:', admin._id);

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
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    // Provide more detailed error message
    let errorMessage = 'Internal server error. Please try again later.';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code === 11000) {
      errorMessage = 'Username or email already exists';
    } else if (error.name === 'ValidationError') {
      errorMessage = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { details: error.message, stack: error.stack })
    });
  }
});

module.exports = router;
