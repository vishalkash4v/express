var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Notes = require('../models/Notes');
var User = require('../models/User');
var { connectDB } = require('../utils/db');
const getClientIp = require('../utils/getClientIp');

// Save notes (create or update)
router.post('/save', async function(req, res) {
  try {
    await connectDB();
    const { userId, notes } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!Array.isArray(notes)) {
      return res.status(400).json({
        success: false,
        error: 'Notes must be an array'
      });
    }

    // Find or create notes for this user
    let notesDoc = await Notes.findOne({ userId: userId });

    if (notesDoc) {
      // Update existing
      notesDoc.notes = notes;
      notesDoc.updatedAt = new Date();
      await notesDoc.save();
    } else {
      // Create new
      notesDoc = new Notes({
        userId: userId,
        notes: notes
      });
      await notesDoc.save();
    }

    res.json({
      success: true,
      message: 'Notes saved successfully',
      data: {
        userId: userId,
        notesCount: notes.length
      }
    });
  } catch (error) {
    console.error('Save notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save notes. Please try again.'
    });
  }
});

// Load notes by user ID
router.get('/load/:userId', async function(req, res) {
  try {
    await connectDB();
    const { userId } = req.params;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid user ID is required'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const notesDoc = await Notes.findOne({ userId: userId });

    if (!notesDoc) {
      // Return empty notes if no notes document exists
      return res.json({
        success: true,
        data: {
          userId: userId,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          notes: [],
          updatedAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      data: {
        userId: userId,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
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

module.exports = router;
