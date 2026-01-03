var express = require('express');
var router = express.Router();
var ShortUrl = require('../models/ShortUrl');
var crypto = require('crypto');

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

// Normalize URL - add https if no protocol
function normalizeUrl(url) {
  url = url.trim();
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }
  return url;
}

// Create short URL
router.post('/create', async function(req, res, next) {
  try {
    const { originalUrl, customAlias } = req.body;

    // Validate original URL
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

    // Validate custom alias if provided
    if (customAlias) {
      if (!isValidAlias(customAlias)) {
        return res.status(400).json({
          success: false,
          error: 'Custom alias must be 3-20 characters and contain only letters, numbers, hyphens, and underscores'
        });
      }

      // Check if alias is already taken
      const existing = await ShortUrl.isShortCodeTaken(customAlias);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'This custom alias is already taken. Please choose another one.'
        });
      }
    }

    // Generate short code
    let shortCode = customAlias || generateShortCode();
    
    // If not custom, ensure uniqueness (retry if collision)
    if (!customAlias) {
      let isTaken = await ShortUrl.isShortCodeTaken(shortCode);
      let attempts = 0;
      while (isTaken && attempts < 5) {
        shortCode = generateShortCode();
        isTaken = await ShortUrl.isShortCodeTaken(shortCode);
        attempts++;
      }
      if (isTaken) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate unique short code. Please try again.'
        });
      }
    }

    // Get client IP and User-Agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'] || null;

    // Create short URL
    const shortUrlData = {
      originalUrl: normalizedUrl,
      shortCode: shortCode,
      customAlias: customAlias || null,
      ipAddress: ipAddress,
      userAgent: userAgent
    };

    const shortUrl = new ShortUrl(shortUrlData);
    await shortUrl.save();

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
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'This short code is already taken. Please try again or use a custom alias.'
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

