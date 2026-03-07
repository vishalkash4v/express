const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    maxlength: 300,
    default: '',
    trim: true
  },
  featuredImage: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    trim: true,
    default: 'General'
  },
  tags: [{
    type: String,
    trim: true
  }],
  // SEO Meta Fields
  metaTitle: {
    type: String,
    maxlength: 60,
    default: ''
  },
  metaDescription: {
    type: String,
    maxlength: 160,
    default: ''
  },
  focusKeyword: {
    type: String,
    trim: true,
    default: ''
  },
  keywords: {
    type: String,
    trim: true,
    default: ''
  },
  canonicalUrl: {
    type: String,
    default: ''
  },
  // Open Graph Fields
  ogTitle: {
    type: String,
    maxlength: 60,
    default: ''
  },
  ogDescription: {
    type: String,
    maxlength: 160,
    default: ''
  },
  ogImage: {
    type: String,
    default: ''
  },
  // Twitter Card Fields
  twitterTitle: {
    type: String,
    maxlength: 70,
    default: ''
  },
  twitterDescription: {
    type: String,
    maxlength: 200,
    default: ''
  },
  twitterImage: {
    type: String,
    default: ''
  },
  // SEO Controls
  noIndex: {
    type: Boolean,
    default: false
  },
  noFollow: {
    type: Boolean,
    default: false
  },
  // Status and Publishing
  status: {
    type: String,
    enum: ['draft', 'published', 'scheduled'],
    default: 'draft'
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  scheduledDate: {
    type: Date,
    default: null
  },
  // Additional Features
  isFeatured: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  readingTime: {
    type: Number, // in minutes
    default: 0
  },
  // Author Info
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  // Timestamps
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

// Indexes for performance
blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1, publishDate: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ isFeatured: 1 });
blogSchema.index({ scheduledDate: 1, status: 1 });

// Pre-save middleware to update slug if title changes
blogSchema.pre('save', function(next) {
  try {
    if (this.isModified('title') && !this.isModified('slug') && this.title) {
      // Generate slug from title
      const slug = this.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .substring(0, 100); // Limit length
      this.slug = slug;
    }
    this.updatedAt = Date.now();
    if (typeof next === 'function') {
      next();
    }
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      throw error;
    }
  }
});

// Method to generate slug from title
blogSchema.methods.generateSlug = function(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
};

// Method to calculate reading time
blogSchema.methods.calculateReadingTime = function() {
  const wordsPerMinute = 200;
  const text = this.content.replace(/<[^>]*>/g, ''); // Remove HTML tags
  const wordCount = text.split(/\s+/).length;
  this.readingTime = Math.ceil(wordCount / wordsPerMinute);
  return this.readingTime;
};

// Method to generate excerpt from content
blogSchema.methods.generateExcerpt = function() {
  const text = this.content.replace(/<[^>]*>/g, ''); // Remove HTML tags
  const words = text.split(/\s+/);
  const excerpt = words.slice(0, 30).join(' '); // First 30 words
  this.excerpt = excerpt.length < text.length ? excerpt + '...' : excerpt;
  return this.excerpt;
};

// Static method to find published blogs
blogSchema.statics.findPublished = function() {
  return this.find({ 
    status: 'published',
    publishDate: { $lte: new Date() }
  }).sort({ publishDate: -1 });
};

// Static method to find scheduled blogs ready to publish
blogSchema.statics.findScheduledReady = function() {
  return this.find({
    status: 'scheduled',
    scheduledDate: { $lte: new Date() }
  });
};

module.exports = mongoose.model('Blog', blogSchema);
