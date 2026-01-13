var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var ShortUrl = require('../models/ShortUrl');
var crypto = require('crypto');
const getClientIp = require('../utils/getClientIp');

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

// Create short URL
router.post('/create', async function (req, res) {
  try {
    // Ensure MongoDB connection
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cqlsysvishal:Lukethedog1234@cluster0.gcqrn8m.mongodb.net/fyntools?retryWrites=true&w=majority&appName=Cluster0';
    
    if (!MONGODB_URI) {
      return res.status(500).json({
        success: false,
        error: 'Database configuration error. Please contact support.'
      });
    }

    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
      } catch (connectError) {
        console.error('Failed to connect to MongoDB in route:', connectError);
        return res.status(503).json({
          success: false,
          error: 'Database connection not available. Please try again later.'
        });
      }
    }

    let { originalUrl, customAlias } = req.body;

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

    // Create short URL - use try-catch to handle duplicate key errors (race conditions)
    let shortUrl;
    try {
      shortUrl = await ShortUrl.create({
        originalUrl: normalizedUrl,
        shortCode,
        customAlias: customAlias || null,
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
        clickCount: shortUrl.clickCount
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
    if (error.message && (error.message.includes('uri') && error.message.includes('undefined') || error.message.includes('MongoDB'))) {
      return res.status(500).json({
        success: false,
        error: 'Database configuration error. Please contact support.'
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
    // Ensure MongoDB connection
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cqlsysvishal:Lukethedog1234@cluster0.gcqrn8m.mongodb.net/fyntools?retryWrites=true&w=majority&appName=Cluster0';
    
    if (mongoose.connection.readyState !== 1 && MONGODB_URI) {
      try {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
      } catch (connectError) {
        console.error('Failed to connect to MongoDB in check route:', connectError);
        return res.status(503).json({
          success: false,
          available: false,
          error: 'Database connection not available'
        });
      }
    }

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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get short URL by code (returns JSON with originalUrl for frontend redirect)
// This must be last as it's a catch-all route
router.get('/:shortCode', async function(req, res, next) {
  try {
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

    // Increment click count
    await shortUrl.incrementClick();

    // Return JSON with originalUrl for frontend to handle redirect
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
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

