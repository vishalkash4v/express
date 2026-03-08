var mongoose = require('mongoose');

var toolSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  keywords: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true,
    trim: true
  },
  href: {
    type: String,
    default: null,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  features: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
// Note: id index is automatically created by unique: true in field definition
toolSchema.index({ category: 1 });
toolSchema.index({ isActive: 1 });
toolSchema.index({ viewCount: -1 }); // For sorting by views
toolSchema.index({ name: 'text', description: 'text', keywords: 'text' });

module.exports = mongoose.model('Tool', toolSchema);
