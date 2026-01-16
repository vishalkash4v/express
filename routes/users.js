var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var User = require('../models/User');
var { connectDB } = require('../utils/db');
const getClientIp = require('../utils/getClientIp');

// Register new user
router.post('/register', async function(req, res) {
  try {
    await connectDB();
    const { username, email, phoneNumber, password } = req.body;

    // Validation
    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    if (username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters'
      });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be at least 6 characters'
      });
    }

    // At least one of email or phoneNumber should be provided
    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const normalizedPhone = phoneNumber ? phoneNumber.trim().replace(/\D/g, '') : null;

    if (!normalizedEmail && !normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Either email or phone number is required'
      });
    }

    // Check if username already exists
    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ username: normalizedUsername });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Check if email already exists (if provided)
    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered'
        });
      }
    }

    // Check if phone already exists (if provided)
    if (normalizedPhone) {
      const existingPhone = await User.findOne({ phoneNumber: normalizedPhone });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          error: 'Phone number already registered'
        });
      }
    }

    // Create new user (password will be hashed by pre-save hook)
    const newUser = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      password: password
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber
      }
    });
  } catch (error) {
    console.error('Register user error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        error: `${field === 'username' ? 'Username' : field === 'email' ? 'Email' : 'Phone number'} already exists`
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to register user. Please try again.'
    });
  }
});

// Login user
router.post('/login', async function(req, res) {
  try {
    await connectDB();
    const { username, email, phoneNumber, password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Find user by username, email, or phone
    let user = null;
    if (username && username.trim()) {
      const normalizedUsername = username.trim().toLowerCase();
      user = await User.findOne({ username: normalizedUsername });
    }
    
    if (!user && email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      user = await User.findOne({ email: normalizedEmail });
    }
    
    if (!user && phoneNumber && phoneNumber.trim()) {
      const normalizedPhone = phoneNumber.trim().replace(/\D/g, '');
      user = await User.findOne({ phoneNumber: normalizedPhone });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Generate JWT token
    const { generateToken } = require('../middleware/auth');
    const token = generateToken({
      _id: user._id,
      username: user.username,
      role: 'user'
    });

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber
      }
    });
  } catch (error) {
    console.error('Login user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login. Please try again.'
    });
  }
});

// Check if username is available
router.get('/check-username/:username', async function(req, res) {
  try {
    await connectDB();
    const { username } = req.params;
    
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        available: false,
        error: 'Username must be at least 3 characters'
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalizedUsername });
    
    res.json({
      success: true,
      available: !existing,
      username: normalizedUsername
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      available: false,
      error: 'Failed to check username'
    });
  }
});

module.exports = router;
