var mongoose = require('mongoose');

var shortUrlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
    trim: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  customAlias: {
    type: String,
    default: null,
    trim: true
  },
  clickCount: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  directRedirect: {
    type: Boolean,
    default: false
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster lookups
// Note: shortCode already has unique index, createdAt has index via timestamps
shortUrlSchema.index({ createdAt: -1 });
shortUrlSchema.index({ isActive: 1 });

// Method to increment click count
shortUrlSchema.methods.incrementClick = function() {
  this.clickCount += 1;
  return this.save();
};

// Static method to find by short code
shortUrlSchema.statics.findByShortCode = function(shortCode) {
  return this.findOne({ shortCode: shortCode, isActive: true });
};

// Static method to check if short code exists
shortUrlSchema.statics.isShortCodeTaken = async function(shortCode) {
  const result = await this.exists({ shortCode: shortCode });
  return result !== null;
};

var ShortUrl = mongoose.model('ShortUrl', shortUrlSchema);

module.exports = ShortUrl;

