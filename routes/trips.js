var express = require('express');
var router = express.Router();
var Trip = require('../models/Trip');
var Participant = require('../models/Participant');
var Expense = require('../models/Expense');
var ActivityLog = require('../models/ActivityLog');
var { authenticateToken } = require('../middleware/auth');
var { isTripOwner, isTripMember } = require('../middleware/tripAuth');
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
    // Don't fail the request if logging fails
  }
}

// Create a new trip
router.post('/', async function(req, res) {
  try {
    await connectDB();
    const { name, currency, description } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Trip name is required'
      });
    }

    const trip = await Trip.create({
      name: name.trim(),
      currency: currency || 'INR',
      description: description ? description.trim() : null,
      createdBy: userId
    });

    // Add creator as admin participant
    await Participant.create({
      tripId: trip._id,
      userId: userId,
      name: req.user.username,
      role: 'ADMIN',
      addedBy: userId
    });

    // Log activity
    await logActivity(trip._id, 'CREATE', 'TRIP', trip._id.toString(), null, {
      name: trip.name,
      currency: trip.currency
    }, userId);

    res.status(201).json({
      success: true,
      data: trip
    });
  } catch (error) {
    console.error('Create trip error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create trip'
    });
  }
});

// Get all trips for the authenticated user
router.get('/', async function(req, res) {
  try {
    await connectDB();
    const userId = req.user.id;

    // Get trips where user is owner
    const ownedTrips = await Trip.find({ createdBy: userId }).sort({ createdAt: -1 });

    // Get trips where user is participant
    const participantTrips = await Participant.find({ userId: userId }).populate('tripId');
    const participatedTrips = participantTrips
      .filter(p => p.tripId)
      .map(p => p.tripId)
      .filter(trip => trip.createdBy.toString() !== userId); // Exclude owned trips

    res.json({
      success: true,
      data: {
        owned: ownedTrips,
        participated: participatedTrips
      }
    });
  } catch (error) {
    console.error('Get trips error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trips'
    });
  }
});

// Get a single trip with details
router.get('/:tripId', isTripMember, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;

    const trip = await Trip.findById(tripId)
      .populate('createdBy', 'username email phoneNumber');

    const participants = await Participant.find({ tripId: trip._id })
      .populate('userId', 'username email phoneNumber');

    const expenses = await Expense.find({ tripId: trip._id })
      .populate('paidBy', 'name')
      .sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      data: {
        trip,
        participants,
        expenses,
        userRole: req.participantRole
      }
    });
  } catch (error) {
    console.error('Get trip error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trip'
    });
  }
});

// Update trip
router.patch('/:tripId', isTripOwner, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;
    const { name, currency, description } = req.body;
    const userId = req.user.id;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    const oldData = {
      name: trip.name,
      currency: trip.currency,
      description: trip.description
    };

    if (name) trip.name = name.trim();
    if (currency) trip.currency = currency.toUpperCase();
    if (description !== undefined) trip.description = description ? description.trim() : null;

    await trip.save();

    // Log activity
    await logActivity(tripId, 'EDIT', 'TRIP', tripId, oldData, {
      name: trip.name,
      currency: trip.currency,
      description: trip.description
    }, userId);

    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    console.error('Update trip error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update trip'
    });
  }
});

// Delete trip
router.delete('/:tripId', isTripOwner, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found'
      });
    }

    // Delete related data
    await Participant.deleteMany({ tripId: trip._id });
    await Expense.deleteMany({ tripId: trip._id });
    await ActivityLog.deleteMany({ tripId: trip._id });

    // Log activity before deletion
    await logActivity(tripId, 'DELETE', 'TRIP', tripId, {
      name: trip.name,
      currency: trip.currency
    }, null, userId);

    await Trip.findByIdAndDelete(tripId);

    res.json({
      success: true,
      message: 'Trip deleted successfully'
    });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete trip'
    });
  }
});

module.exports = router;
