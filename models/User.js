var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var userSchema = new mongoose.Schema({
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
    unique: true,
    sparse: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phoneNumber: {
    type: String,
    default: null,
    trim: true,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
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
// Note: email and phoneNumber indexes are automatically created by unique: true in field definitions
userSchema.index({ username: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function() {
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
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

var User;
try {
  User = mongoose.model('User');
} catch (error) {
  User = mongoose.model('User', userSchema);
}

module.exports = User;
