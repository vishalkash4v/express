var Trip = require('../models/Trip');
var Participant = require('../models/Participant');
var { connectDB } = require('../utils/db');

// Check if user is trip owner
async function isTripOwner(req, res, next) {
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

    if (trip.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only trip owner can perform this action'
      });
    }

    req.trip = trip;
    next();
  } catch (error) {
    console.error('isTripOwner error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
}

// Check if user is trip member
async function isTripMember(req, res, next) {
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

    // Check if user is trip owner
    if (trip.createdBy.toString() === userId) {
      req.participantRole = 'ADMIN'; // Owner has admin role
      req.trip = trip;
      return next();
    }

    // Check if user is a participant
    const participant = await Participant.findOne({
      tripId: trip._id,
      userId: userId
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this trip'
      });
    }

    req.participant = participant;
    req.participantRole = participant.role;
    req.trip = trip;
    next();
  } catch (error) {
    console.error('isTripMember error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
}

// Check if user has required permission
function hasPermission(requiredRoles) {
  return (req, res, next) => {
    const role = req.participantRole || 'VIEW_ONLY';

    if (!requiredRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

module.exports = {
  isTripOwner,
  isTripMember,
  hasPermission
};
