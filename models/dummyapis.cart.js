var mongoose = require('mongoose');

var cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DummyApiProduct',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
});

var cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DummyApiUser',
    required: true
  },
  items: [cartItemSchema],
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
cartSchema.index({ userId: 1, createdBy: 1 }, { unique: true });
cartSchema.index({ createdBy: 1 });

// Update updatedAt before saving
cartSchema.pre('save', function() {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = Date.now();
  }
});

var Cart;
try {
  Cart = mongoose.model('DummyApiCart');
} catch (error) {
  Cart = mongoose.model('DummyApiCart', cartSchema, 'dummyapis_carts');
}

module.exports = Cart;
