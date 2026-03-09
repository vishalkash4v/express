/**
 * PageViewSession - Session-based unique view deduplication
 * Tracks which sessions (browser visitors) have viewed each page each day.
 * Used to calculate true unique views instead of counting every view.
 */
var mongoose = require('mongoose');

var pageViewSessionSchema = new mongoose.Schema({
  pageType: {
    type: String,
    required: true,
    enum: ['tool', 'blog', 'shorturl', 'other'],
    index: true
  },
  pageId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Unique compound index - one record per (page, date, session)
// Prevents same visitor from being counted as "unique" multiple times per day
pageViewSessionSchema.index(
  { pageType: 1, pageId: 1, date: 1, sessionId: 1 },
  { unique: true }
);

// TTL index - auto-delete session records after 60 days (privacy & storage)
pageViewSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('PageViewSession', pageViewSessionSchema);
