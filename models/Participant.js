var mongoose = require('mongoose');

var participantSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    default: null,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    default: null,
    trim: true
  },
  role: {
    type: String,
    enum: ['VIEW_ONLY', 'ADD_EDIT', 'DELETE', 'ADMIN'],
    default: 'VIEW_ONLY'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
participantSchema.index({ tripId: 1, userId: 1 }, { unique: true, sparse: true });
participantSchema.index({ tripId: 1 });
participantSchema.index({ userId: 1 });

var Participant = mongoose.model('Participant', participantSchema);

module.exports = Participant;
