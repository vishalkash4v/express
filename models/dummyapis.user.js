var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var userSchema = new mongoose.Schema({
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
    default: null,
    trim: true,
    lowercase: true,
    sparse: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    default: null,
    trim: true,
    sparse: true
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 6
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DummyApiAccount',
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
  timestamps: false
});

// Indexes
userSchema.index({ username: 1, createdBy: 1 }, { unique: true });
userSchema.index({ email: 1, createdBy: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1, createdBy: 1 }, { unique: true, sparse: true });
userSchema.index({ createdBy: 1 });
userSchema.index({ status: 1 });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) {
    this.updatedAt = Date.now();
    return;
  }
  
  try {
    if (!this.passwordHash) {
      throw new Error('Password is required');
    }
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    this.updatedAt = Date.now();
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

var User;
try {
  User = mongoose.model('DummyApiUser');
} catch (error) {
  User = mongoose.model('DummyApiUser', userSchema, 'dummyapis_users');
}

module.exports = User;
