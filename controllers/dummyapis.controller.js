var Account = require('../models/dummyapis.account');
var User = require('../models/dummyapis.user');
var Product = require('../models/dummyapis.product');
var Cart = require('../models/dummyapis.cart');
var { connectDB } = require('../utils/db');
var { generateToken, authenticateToken } = require('../middleware/auth');
var jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Register new account
exports.register = async function(req, res) {
  try {
    await connectDB();
    const { name, username, email, password } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username is required and must be at least 3 characters'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be at least 6 characters'
      });
    }

    // Check if username already exists
    const normalizedUsername = username.trim().toLowerCase();
    const existingUsername = await Account.findOne({ username: normalizedUsername });
    
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Check if email already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existingEmail = await Account.findOne({ email: normalizedEmail });
    
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Create new account (password will be hashed by pre-save hook)
    const newAccount = new Account({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash: password
    });

    await newAccount.save();

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        id: newAccount._id,
        name: newAccount.name,
        username: newAccount.username,
        email: newAccount.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(function(e) { return e.message; });
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Login - supports username/email/phone
exports.login = async function(req, res) {
  try {
    await connectDB();
    const { username, email, phone, password, expiresIn } = req.body;

    // Validate input
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // At least one identifier must be provided
    if (!username && !email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, or phone is required'
      });
    }

    // Validate expiresIn if provided
    const allowedExpires = ['15m', '1h', '12h', '1d', '7d'];
    const tokenExpiresIn = expiresIn && allowedExpires.includes(expiresIn) ? expiresIn : '15m';

    // Find account by username, email, or phone
    let account = null;
    if (username) {
      account = await Account.findOne({ username: username.trim().toLowerCase() });
    } else if (email) {
      account = await Account.findOne({ email: email.trim().toLowerCase() });
    } else if (phone) {
      // For accounts, we might need to search by phone if it exists
      // Since account schema doesn't have phone, we'll search by username/email only
      return res.status(400).json({
        success: false,
        error: 'Phone login not supported for accounts. Use username or email.'
      });
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await account.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate token with custom expiration
    const token = jwt.sign(
      {
        id: account._id,
        username: account.username,
        type: 'account'
      },
      JWT_SECRET,
      { expiresIn: tokenExpiresIn }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        account: {
          id: account._id,
          name: account.name,
          username: account.username,
          email: account.email
        },
        expiresIn: tokenExpiresIn
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Create user
exports.createUser = async function(req, res) {
  try {
    await connectDB();
    const { name, username, email, phone, password, customFields } = req.body;

    // Get account ID from token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    const accountId = decoded.id;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username is required and must be at least 3 characters'
      });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be at least 6 characters'
      });
    }

    // Check if username already exists for this account
    const normalizedUsername = username.trim().toLowerCase();
    const existingUser = await User.findOne({ 
      username: normalizedUsername, 
      createdBy: accountId 
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingEmail = await User.findOne({ 
        email: normalizedEmail, 
        createdBy: accountId 
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const normalizedPhone = phone.trim();
      const existingPhone = await User.findOne({ 
        phone: normalizedPhone, 
        createdBy: accountId 
      });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          error: 'Phone already exists'
        });
      }
    }

    // Create new user
    const newUser = new User({
      name: name.trim(),
      username: normalizedUsername,
      email: email ? email.trim().toLowerCase() : null,
      phone: phone ? phone.trim() : null,
      passwordHash: password,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        status: newUser.status,
        customFields: newUser.customFields,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(function(e) { return e.message; });
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get all users (for the account)
exports.getUsers = async function(req, res) {
  try {
    await connectDB();
    
    // Get account ID from token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    const accountId = decoded.id;

    const users = await User.find({ createdBy: accountId })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get current user (my profile)
exports.getMyUser = async function(req, res) {
  try {
    await connectDB();
    
    // Get account ID from token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    const accountId = decoded.id;

    // Get account info
    const account = await Account.findById(accountId).select('-passwordHash');
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: account._id,
        name: account.name,
        username: account.username,
        email: account.email,
        createdAt: account.createdAt
      }
    });
  } catch (error) {
    console.error('Get my user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update user
exports.updateUser = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, username, email, phone, customFields } = req.body;

    // Get account ID from token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    const accountId = decoded.id;

    // Find user and verify ownership
    const user = await User.findOne({ _id: id, createdBy: accountId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update fields
    if (name) user.name = name.trim();
    if (username) {
      const normalizedUsername = username.trim().toLowerCase();
      // Check if username already exists for this account (excluding current user)
      const existingUser = await User.findOne({ 
        username: normalizedUsername, 
        createdBy: accountId,
        _id: { $ne: id }
      });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists'
        });
      }
      user.username = normalizedUsername;
    }
    if (email !== undefined) {
      if (email) {
        const normalizedEmail = email.trim().toLowerCase();
        // Check if email already exists (excluding current user)
        const existingUser = await User.findOne({ 
          email: normalizedEmail, 
          createdBy: accountId,
          _id: { $ne: id }
        });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'Email already exists'
          });
        }
        user.email = normalizedEmail;
      } else {
        user.email = null;
      }
    }
    if (phone !== undefined) {
      if (phone) {
        const normalizedPhone = phone.trim();
        // Check if phone already exists (excluding current user)
        const existingUser = await User.findOne({ 
          phone: normalizedPhone, 
          createdBy: accountId,
          _id: { $ne: id }
        });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'Phone already exists'
          });
        }
        user.phone = normalizedPhone;
      } else {
        user.phone = null;
      }
    }
    if (customFields) {
      user.customFields = { ...user.customFields, ...customFields };
    }

    user.updatedAt = Date.now();
    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        status: user.status,
        customFields: user.customFields,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(function(e) { return e.message; });
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Delete user
exports.deleteUser = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;

    // Get account ID from token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    const accountId = decoded.id;

    // Find user and verify ownership
    const user = await User.findOne({ _id: id, createdBy: accountId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await User.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update user status
exports.updateUserStatus = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "active" or "inactive"'
      });
    }

    // Get account ID from token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    const accountId = decoded.id;

    // Find user and verify ownership
    const user = await User.findOne({ _id: id, createdBy: accountId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.status = status;
    user.updatedAt = Date.now();
    await user.save();

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        id: user._id,
        status: user.status,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
