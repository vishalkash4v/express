var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var notesSchema = new mongoose.Schema({
  username: { type: String, default: null, trim: true, index: true },
  phoneNumber: { type: String, default: null, trim: true, index: true },
  password: { type: String, required: true, minlength: 6 },
  notes: { type: Array, default: [] }, // Array of note objects
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster lookups
notesSchema.index({ username: 1 }, { unique: true, sparse: true });
notesSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });

// Hash password before saving
notesSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    this.updatedAt = Date.now();
    return;
  }
  
  try {
    if (!this.password) {
      throw new Error('Password is required');
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
});

// Method to compare password
notesSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

var Notes;
try {
  Notes = mongoose.model('Notes');
} catch (error) {
  Notes = mongoose.model('Notes', notesSchema);
}

module.exports = Notes;
