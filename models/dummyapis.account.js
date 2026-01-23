var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var accountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 6
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Indexes
accountSchema.index({ username: 1 }, { unique: true });
accountSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
accountSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) {
    return;
  }
  
  try {
    if (!this.passwordHash) {
      throw new Error('Password is required');
    }
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
});

// Method to compare password
accountSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

var Account;
try {
  Account = mongoose.model('DummyApiAccount');
} catch (error) {
  Account = mongoose.model('DummyApiAccount', accountSchema, 'dummyapis_accounts');
}

module.exports = Account;
