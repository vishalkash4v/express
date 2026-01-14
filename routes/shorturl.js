var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var ShortUrl = require('../models/ShortUrl');
var crypto = require('crypto');
const getClientIp = require('../utils/getClientIp');
const { connectDB } = require('../utils/db');

// Generate a random short code
function generateShortCode(length = 6) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Validate URL
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

// Validate short code/alias
function isValidAlias(alias) {
  const aliasRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return aliasRegex.test(alias);
}

// Normalize URL - add https if no protocol, but preserve the URL exactly as entered (don't add www)
function normalizeUrl(url) {
  url = url.trim();
  // Only add protocol if missing - do NOT add www
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }
  // Ensure we don't modify the hostname (preserve www if present, don't add if not present)
  return url;
}

// Helper function to ensure database connection with retry
const ensureConnection = async (maxRetries = 3) => {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await connectDB();
      if (mongoose.connection.readyState === 1) {
        return true;
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed to connect to database after retries');
};

// Create short URL
router.post('/create', async function (req, res) {
  try {
    // Ensure MongoDB connection with retry
    await ensureConnection();

    let { originalUrl, customAlias, expiresAt, directRedirect } = req.body;

    if (!originalUrl || !originalUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Original URL is required'
      });
    }

    const normalizedUrl = normalizeUrl(originalUrl);

    if (!isValidUrl(normalizedUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid URL'
      });
    }

    let shortCode;
    
    if (customAlias) {
      customAlias = customAlias.trim().toLowerCase();

      if (!isValidAlias(customAlias)) {
        return res.status(400).json({
          success: false,
          error: 'Custom alias must be 3–20 characters and contain only letters, numbers, hyphens, and underscores'
        });
      }

      // Check if alias is already taken (with race condition protection)
      const isTaken = await ShortUrl.isShortCodeTaken(customAlias);
      if (isTaken) {
        return res.status(409).json({
          success: false,
          error: 'This custom alias is already taken. Please choose another one.'
        });
      }

      shortCode = customAlias;
    } else {
      // Generate random short code
      let attempts = 0;
      do {
        shortCode = generateShortCode();
        attempts++;
        if (attempts > 10) {
          return res.status(500).json({
            success: false,
            error: 'Failed to generate unique short code. Please try again.'
          });
        }
      } while (await ShortUrl.isShortCodeTaken(shortCode));
    }

    // Validate and process expiration date
    let expirationDate = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid expiration date format'
        });
      }
      // Ensure expiration is in the future
      if (expirationDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Expiration date must be in the future'
        });
      }
    }

    // Validate directRedirect flag
    const isDirectRedirect = directRedirect === true || directRedirect === 'true';

    // Create short URL - use try-catch to handle duplicate key errors (race conditions)
    let shortUrl;
    try {
      shortUrl = await ShortUrl.create({
        originalUrl: normalizedUrl,
        shortCode,
        customAlias: customAlias || null,
        expiresAt: expirationDate,
        directRedirect: isDirectRedirect,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null
      });
    } catch (createError) {
      // Handle duplicate key error (E11000) - race condition where alias was taken between check and create
      if (createError.code === 11000 || createError.name === 'MongoServerError') {
        return res.status(409).json({
          success: false,
          error: 'This custom alias is already taken. Please choose another one.'
        });
      }
      throw createError; // Re-throw if it's a different error
    }

    res.json({
      success: true,
      data: {
        originalUrl: shortUrl.originalUrl,
        shortCode: shortUrl.shortCode,
        shortUrl: `${req.protocol}://${req.get('host')}/s/${shortUrl.shortCode}`,
        createdAt: shortUrl.createdAt,
        clickCount: shortUrl.clickCount,
        expiresAt: shortUrl.expiresAt,
        directRedirect: shortUrl.directRedirect
      }
    });

  } catch (error) {
    console.error('Error creating short URL:', error);

    // Handle duplicate key error (E11000) - race condition where alias was taken between check and create
    if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) {
      return res.status(409).json({
        success: false,
        error: 'This custom alias is already taken. Please choose another one.'
      });
    }

    // Handle MongoDB connection errors
    if (error.message && (error.message.includes('uri') && error.message.includes('undefined') || error.message.includes('MongoDB') || error.message.includes('connection'))) {
      return res.status(503).json({
        success: false,
        error: 'Database connection error. Please try again in a moment.'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message || 'Invalid input data'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
});


// Check if short code is available (must come before /:shortCode route)
router.get('/check/:shortCode', async function(req, res, next) {
  try {
    // Ensure MongoDB connection with retry
    await ensureConnection();

    const { shortCode } = req.params;

    if (!isValidAlias(shortCode)) {
      return res.status(400).json({
        success: false,
        available: false,
        error: 'Invalid short code format'
      });
    }

    const isTaken = await ShortUrl.isShortCodeTaken(shortCode);

    res.json({
      success: true,
      available: !isTaken,
      shortCode: shortCode
    });

  } catch (error) {
    console.error('Error checking short code:', error);
    
    // Handle connection errors
    if (error.message && (error.message.includes('MongoDB') || error.message.includes('connection'))) {
      return res.status(503).json({
        success: false,
        available: false,
        error: 'Database connection error. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      available: false,
      error: 'Internal server error'
    });
  }
});

// Get URL stats (must come before /:shortCode route)
router.get('/:shortCode/stats', async function(req, res, next) {
  try {
    // Ensure MongoDB connection with retry
    await ensureConnection();
    
    const { shortCode } = req.params;

    const shortUrl = await ShortUrl.findByShortCode(shortCode);

    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'Short URL not found'
      });
    }

    res.json({
      success: true,
      data: {
        originalUrl: shortUrl.originalUrl,
        shortCode: shortUrl.shortCode,
        clickCount: shortUrl.clickCount,
        createdAt: shortUrl.createdAt,
        expiresAt: shortUrl.expiresAt,
        isActive: shortUrl.isActive
      }
    });

  } catch (error) {
    console.error('Error getting URL stats:', error);
    
    // Handle connection errors
    if (error.message && (error.message.includes('MongoDB') || error.message.includes('connection'))) {
      return res.status(503).json({
        success: false,
        error: 'Database connection error. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get short URL by code (returns JSON with originalUrl for frontend redirect OR 301 redirect)
// This must be last as it's a catch-all route
router.get('/:shortCode', async function(req, res, next) {
  try {
    // Ensure MongoDB connection with retry
    await ensureConnection();
    
    const { shortCode } = req.params;

    const shortUrl = await ShortUrl.findByShortCode(shortCode);

    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'Short URL not found'
      });
    }

    // Check if expired
    if (shortUrl.expiresAt && new Date() > shortUrl.expiresAt) {
      return res.status(410).json({
        success: false,
        error: 'Short URL has expired'
      });
    }

    // Increment click count (non-blocking)
    shortUrl.incrementClick().catch(err => {
      console.error('Error incrementing click count:', err);
    });

    // If directRedirect is enabled, do 301 redirect immediately
    if (shortUrl.directRedirect) {
      return res.redirect(301, shortUrl.originalUrl);
    }

    // Otherwise, return JSON with originalUrl for frontend to handle redirect
    res.json({
      success: true,
      data: {
        originalUrl: shortUrl.originalUrl,
        shortCode: shortUrl.shortCode,
        clickCount: shortUrl.clickCount
      }
    });

  } catch (error) {
    console.error('Error getting short URL:', error);
    
    // Handle connection errors
    if (error.message && (error.message.includes('MongoDB') || error.message.includes('connection'))) {
      return res.status(503).json({
        success: false,
        error: 'Database connection error. Please try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

