var mongoose = require('mongoose');

var productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    default: '',
    trim: true
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  image: {
    type: String,
    default: null
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
productSchema.index({ createdBy: 1 });
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ name: 1, createdBy: 1 });

// Update updatedAt before saving
productSchema.pre('save', function() {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = Date.now();
  }
});

var Product;
try {
  Product = mongoose.model('DummyApiProduct');
} catch (error) {
  Product = mongoose.model('DummyApiProduct', productSchema, 'dummyapis_products');
}

module.exports = Product;
