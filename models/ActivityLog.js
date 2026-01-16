var mongoose = require('mongoose');

var activityLogSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  action: {
    type: String,
    enum: ['CREATE', 'EDIT', 'DELETE'],
    required: true
  },
  entityType: {
    type: String,
    enum: ['EXPENSE', 'PARTICIPANT', 'TRIP'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.Mixed,
    required: true // Can be ObjectId or String
  },
  oldData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
activityLogSchema.index({ tripId: 1, timestamp: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });
activityLogSchema.index({ performedBy: 1 });

var ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
