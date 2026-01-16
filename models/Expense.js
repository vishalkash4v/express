var mongoose = require('mongoose');

var expenseSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: null,
    trim: true
  },
  location: {
    type: String,
    default: null,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  splitType: {
    type: String,
    enum: ['EQUAL', 'CUSTOM', 'PERCENTAGE', 'EXCLUDE'],
    default: 'EQUAL'
  },
  splitDetails: {
    // For CUSTOM: { participantId: amount }
    // For PERCENTAGE: { participantId: percentage }
    // For EXCLUDE: [participantId] (array of excluded IDs)
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  receipt: {
    type: String,
    default: null // URL or base64
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  timestamps: true
});

// Indexes
expenseSchema.index({ tripId: 1, createdAt: -1 });
expenseSchema.index({ paidBy: 1 });
expenseSchema.index({ category: 1 });

var Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
