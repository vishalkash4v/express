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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// Change password
exports.changePassword = async function(req, res) {
  try {
    await connectDB();
    const { currentPassword, newPassword } = req.body;

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

    // Find account
    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Validate input
    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is required'
      });
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password is required and must be at least 6 characters'
      });
    }

    // Verify current password
    const isPasswordValid = await account.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save hook)
    account.passwordHash = newPassword;
    await account.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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

// ========== PRODUCT ENDPOINTS ==========

// Create product
exports.createProduct = async function(req, res) {
  try {
    await connectDB();
    const { name, description, price, category, stock, image, customFields } = req.body;

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
        error: 'Product name is required'
      });
    }

    if (price === undefined || price === null || price < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid price is required'
      });
    }

    // Create new product
    const newProduct = new Product({
      name: name.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category: category ? category.trim() : '',
      stock: stock !== undefined ? parseInt(stock) : 0,
      image: image || null,
      customFields: customFields || {},
      createdBy: accountId,
      status: 'active'
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: newProduct._id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        stock: newProduct.stock,
        image: newProduct.image,
        status: newProduct.status,
        customFields: newProduct.customFields,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
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

// Get all products
exports.getProducts = async function(req, res) {
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

    const products = await Product.find({ createdBy: accountId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product
exports.getProduct = async function(req, res) {
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

    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product
exports.updateProduct = async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { name, description, price, category, stock, image, customFields } = req.body;

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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description ? description.trim() : '';
    if (price !== undefined) product.price = parseFloat(price);
    if (category !== undefined) product.category = category ? category.trim() : '';
    if (stock !== undefined) product.stock = parseInt(stock);
    if (image !== undefined) product.image = image || null;
    if (customFields) {
      product.customFields = { ...product.customFields, ...customFields };
    }

    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
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

// Delete product
exports.deleteProduct = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await Product.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update product status
exports.updateProductStatus = async function(req, res) {
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

    // Find product and verify ownership
    const product = await Product.findOne({ _id: id, createdBy: accountId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    product.status = status;
    product.updatedAt = Date.now();
    await product.save();

    res.json({
      success: true,
      message: 'Product status updated successfully',
      data: {
        id: product._id,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ========== CART ENDPOINTS ==========

// Add to cart
exports.addToCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId, quantity } = req.body;

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
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify product belongs to account
    const product = await Product.findOne({ _id: productId, createdBy: accountId });
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      cart = new Cart({
        userId: userId,
        items: [],
        createdBy: accountId
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    const qty = quantity ? parseInt(quantity) : 1;

    if (existingItemIndex >= 0) {
      // Update quantity
      cart.items[existingItemIndex].quantity += qty;
    } else {
      // Add new item
      cart.items.push({
        productId: productId,
        quantity: qty,
        price: product.price
      });
    }

    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get cart
exports.getCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    // Verify user belongs to account
    const user = await User.findOne({ _id: userId, createdBy: accountId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let cart = await Cart.findOne({ userId: userId, createdBy: accountId })
      .populate('items.productId');
    
    if (!cart) {
      cart = {
        userId: userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
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

// Update cart item
exports.updateCartItem = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;
    const { quantity } = req.body;

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

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      function(item) { return item.productId.toString() === productId; }
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart item updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove from cart
exports.removeFromCart = async function(req, res) {
  try {
    await connectDB();
    const { userId, productId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      function(item) { return item.productId.toString() !== productId; }
    );
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID or product ID'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Clear cart
exports.clearCart = async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;

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

    const cart = await Cart.findOne({ userId: userId, createdBy: accountId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
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
