var mongoose = require('mongoose');

var notesSchema = new mongoose.Schema({
  username: { type: String, default: null, trim: true, index: true },
  phoneNumber: { type: String, default: null, trim: true, index: true },
  notes: { type: Array, default: [] }, // Array of note objects
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster lookups
notesSchema.index({ username: 1 }, { unique: true, sparse: true });
notesSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });

var Notes = mongoose.model('Notes', notesSchema);
module.exports = Notes;
