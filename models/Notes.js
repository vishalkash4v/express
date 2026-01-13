var mongoose = require('mongoose');

var notesSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, index: true },
  phoneNumber: { type: String, default: null, trim: true },
  notes: { type: Array, default: [] }, // Array of note objects
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster lookups
notesSchema.index({ username: 1 }, { unique: true });
notesSchema.index({ phoneNumber: 1 }, { sparse: true }); // Sparse index for optional phone

var Notes = mongoose.model('Notes', notesSchema);
module.exports = Notes;
