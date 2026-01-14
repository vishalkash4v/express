var mongoose = require('mongoose');

var notesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  notes: {
    type: Array,
    default: []
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

// Index for faster lookups
notesSchema.index({ userId: 1 }, { unique: true });

var Notes;
try {
  Notes = mongoose.model('Notes');
} catch (error) {
  Notes = mongoose.model('Notes', notesSchema);
}

module.exports = Notes;
