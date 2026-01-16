var express = require('express');
var router = express.Router();
var Participant = require('../models/Participant');
var Trip = require('../models/Trip');
var User = require('../models/User');
var ActivityLog = require('../models/ActivityLog');
var { authenticateToken } = require('../middleware/auth');
var { isTripMember, hasPermission } = require('../middleware/tripAuth');
var { connectDB } = require('../utils/db');

// All routes require authentication
router.use(authenticateToken);

// Helper function to log activity
async function logActivity(tripId, action, entityType, entityId, oldData, newData, performedBy) {
  try {
    await connectDB();
    await ActivityLog.create({
      tripId,
      action,
      entityType,
      entityId,
      oldData,
      newData,
      performedBy
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Add participant to trip (requires ADMIN role)
router.post('/:tripId/participants', isTripMember, hasPermission(['ADMIN']), async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;
    const { name, email, phone, userId, role } = req.body;
    const performedBy = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Participant name is required'
      });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // If userId is provided, check if user exists
    let userObj = null;
    if (userId) {
      userObj = await User.findById(userId);
      if (!userObj) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check if user is already a participant
      const existingParticipant = await Participant.findOne({
        tripId: trip._id,
        userId: userId
      });

      if (existingParticipant) {
        return res.status(409).json({
          success: false,
          error: 'This user is already a participant in this trip'
        });
      }
    } else {
      // Check if participant with same name already exists (for participants without userId)
      const existingByName = await Participant.findOne({
        tripId: trip._id,
        userId: null,
        name: name.trim()
      });

      if (existingByName) {
        return res.status(409).json({
          success: false,
          error: `A participant named "${name.trim()}" already exists in this trip`
        });
      }
    }

    const participant = await Participant.create({
      tripId: trip._id,
      userId: userId || null,
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : null,
      phone: phone ? phone.trim() : null,
      role: role || 'VIEW_ONLY',
      addedBy: performedBy
    });

    // Log activity
    await logActivity(tripId, 'CREATE', 'PARTICIPANT', participant._id.toString(), null, {
      name: participant.name,
      role: participant.role
    }, performedBy);

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.toTrip(tripId, 'participant-added', participant);
    }

    res.status(201).json({
      success: true,
      data: participant
    });
  } catch (error) {
    console.error('Add participant error:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'participant';
      if (field === 'userId' || error.keyPattern?.userId) {
        return res.status(409).json({
          success: false,
          error: 'This user is already a participant in this trip'
        });
      }
      return res.status(409).json({
        success: false,
        error: 'A participant with these details already exists. Please use a different name or email.'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to add participant. Please try again.'
    });
  }
});

// Get all participants for a trip
router.get('/:tripId/participants', isTripMember, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;

    const participants = await Participant.find({ tripId })
      .populate('userId', 'username email phoneNumber')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: participants
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch participants'
    });
  }
});

// Update participant (role change requires ADMIN)
router.patch('/:tripId/participants/:participantId', isTripMember, hasPermission(['ADMIN']), async function(req, res) {
  try {
    await connectDB();
    const { tripId, participantId } = req.params;
    const { name, email, phone, role } = req.body;
    const performedBy = req.user.id;

    const participant = await Participant.findOne({
      _id: participantId,
      tripId: tripId
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }

    const oldData = {
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      role: participant.role
    };

    if (name) participant.name = name.trim();
    if (email !== undefined) participant.email = email ? email.trim().toLowerCase() : null;
    if (phone !== undefined) participant.phone = phone ? phone.trim() : null;
    if (role) participant.role = role;

    await participant.save();

    // Log activity
    await logActivity(tripId, 'EDIT', 'PARTICIPANT', participantId, oldData, {
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      role: participant.role
    }, performedBy);

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.toTrip(tripId, 'participant-updated', participant);
    }

    res.json({
      success: true,
      data: participant
    });
  } catch (error) {
    console.error('Update participant error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    // Handle cast errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: `Invalid ${error.path || 'data'} provided`
      });
    }

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'A participant with these details already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update participant. Please check all fields and try again.'
    });
  }
});

// Remove participant (requires ADMIN)
router.delete('/:tripId/participants/:participantId', isTripMember, hasPermission(['ADMIN']), async function(req, res) {
  try {
    await connectDB();
    const { tripId, participantId } = req.params;
    const performedBy = req.user.id;

    const participant = await Participant.findOne({
      _id: participantId,
      tripId: tripId
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found'
      });
    }

    const oldData = {
      name: participant.name,
      role: participant.role
    };

    // Log activity before deletion
    await logActivity(tripId, 'DELETE', 'PARTICIPANT', participantId, oldData, null, performedBy);

    await Participant.findByIdAndDelete(participantId);

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.toTrip(tripId, 'participant-removed', participantId);
    }

    res.json({
      success: true,
      message: 'Participant removed successfully'
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove participant. Please try again.'
    });
  }
});

module.exports = router;
