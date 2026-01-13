var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Notes = require('../models/Notes');
var { connectDB } = require('../utils/db');
const getClientIp = require('../utils/getClientIp');

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
    const existing = await Notes.findOne({ username: normalizedUsername });
    
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

// Suggest available usernames
router.get('/suggest-usernames/:base', async function(req, res) {
  try {
    await connectDB();
    const { base } = req.params;
    
    if (!base || base.trim().length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const normalizedBase = base.trim().toLowerCase();
    const suggestions = [];
    const existingUsernames = new Set();
    
    // Get existing usernames that start with the base
    const existing = await Notes.find({
      username: { $regex: `^${normalizedBase}`, $options: 'i' }
    }).select('username');
    
    existing.forEach(doc => existingUsernames.add(doc.username.toLowerCase()));

    // Generate suggestions
    for (let i = 1; i <= 10; i++) {
      const candidate = `${normalizedBase}${i}`;
      if (!existingUsernames.has(candidate)) {
        suggestions.push(candidate);
        if (suggestions.length >= 5) break;
      }
    }
    
    // If we don't have enough, try with random numbers
    if (suggestions.length < 5) {
      for (let i = 100; i <= 999; i++) {
        const candidate = `${normalizedBase}${i}`;
        if (!existingUsernames.has(candidate)) {
          suggestions.push(candidate);
          if (suggestions.length >= 5) break;
        }
      }
    }
    
    res.json({
      success: true,
      suggestions: suggestions.slice(0, 5)
    });
  } catch (error) {
    console.error('Suggest usernames error:', error);
    res.status(500).json({
      success: false,
      suggestions: [],
      error: 'Failed to suggest usernames'
    });
  }
});

// Save notes (create or update)
router.post('/save', async function(req, res) {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cqlsysvishal:Lukethedog1234@cluster0.gcqrn8m.mongodb.net/fyntools?retryWrites=true&w=majority&appName=Cluster0';
    
    if (mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
      } catch (connectError) {
        console.error('Failed to connect to MongoDB:', connectError);
        return res.status(503).json({
          success: false,
          error: 'Database connection not available'
        });
      }
    }

    const { username, phoneNumber, notes } = req.body;
    const ipAddress = getClientIp(req);

    // Validation - at least one of username or phoneNumber is required
    const normalizedUsername = username ? username.trim().toLowerCase() : null;
    const normalizedPhone = phoneNumber ? phoneNumber.trim().replace(/\D/g, '') : null;

    if (!normalizedUsername && !normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Either username or phone number is required'
      });
    }

    if (normalizedUsername && normalizedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters'
      });
    }

    if (!Array.isArray(notes)) {
      return res.status(400).json({
        success: false,
        error: 'Notes must be an array'
      });
    }

    // Find existing notes by username or phone
    let notesDoc = null;
    if (normalizedUsername) {
      notesDoc = await Notes.findOne({ username: normalizedUsername });
    }
    if (!notesDoc && normalizedPhone) {
      notesDoc = await Notes.findOne({ phoneNumber: normalizedPhone });
    }

    if (notesDoc) {
      // Update existing
      notesDoc.notes = notes;
      notesDoc.updatedAt = new Date();
      if (normalizedUsername) {
        notesDoc.username = normalizedUsername;
      }
      if (normalizedPhone) {
        notesDoc.phoneNumber = normalizedPhone;
      }
      await notesDoc.save();
    } else {
      // Create new
      notesDoc = new Notes({
        username: normalizedUsername,
        phoneNumber: normalizedPhone,
        notes: notes,
      });
      await notesDoc.save();
    }

    res.json({
      success: true,
      message: 'Notes saved successfully',
      data: {
        username: normalizedUsername,
        notesCount: notes.length
      }
    });
  } catch (error) {
    console.error('Save notes error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to save notes. Please try again.'
    });
  }
});

// Load notes by username
router.get('/load/:username', async function(req, res) {
  try {
    await connectDB();
    const { username } = req.params;
    
    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const notesDoc = await Notes.findOne({ username: normalizedUsername });

    if (!notesDoc) {
      return res.status(404).json({
        success: false,
        error: 'No notes found for this username'
      });
    }

    res.json({
      success: true,
      data: {
        username: notesDoc.username,
        phoneNumber: notesDoc.phoneNumber,
        notes: notesDoc.notes || [],
        updatedAt: notesDoc.updatedAt
      }
    });
  } catch (error) {
    console.error('Load notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load notes'
    });
  }
});

// Load notes by phone number (optional)
router.get('/load-by-phone/:phone', async function(req, res) {
  try {
    await connectDB();
    const { phone } = req.params;
    
    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const normalizedPhone = phone.trim().replace(/\D/g, ''); // Remove non-digits
    const notesDoc = await Notes.findOne({ phoneNumber: normalizedPhone });

    if (!notesDoc) {
      return res.status(404).json({
        success: false,
        error: 'No notes found for this phone number'
      });
    }

    res.json({
      success: true,
      data: {
        username: notesDoc.username,
        phoneNumber: notesDoc.phoneNumber,
        notes: notesDoc.notes || [],
        updatedAt: notesDoc.updatedAt
      }
    });
  } catch (error) {
    console.error('Load notes by phone error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load notes'
    });
  }
});

module.exports = router;
