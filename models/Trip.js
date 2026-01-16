var mongoose = require('mongoose');

var tripSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  currency: {
    type: String,
    default: 'INR',
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    default: null,
    trim: true
  },
  createdBy: {
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
tripSchema.index({ createdBy: 1, createdAt: -1 });
tripSchema.index({ name: 1 });

var Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip;
