var mongoose = require('mongoose');

var toolReviewSchema = new mongoose.Schema({
  toolName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  toolUrl: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    enum: [0, 1], // 0 = dislike, 1 = like
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  userAgent: {
    type: String,
    default: null
  },
  feedback: {
    type: String,
    default: null,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster lookups
toolReviewSchema.index({ toolName: 1, rating: 1 });
toolReviewSchema.index({ toolUrl: 1 });
toolReviewSchema.index({ createdAt: -1 });

// Static method to get tool stats
toolReviewSchema.statics.getToolStats = async function(toolName, toolUrl) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { toolName: toolName },
          { toolUrl: toolUrl }
        ]
      }
    },
    {
      $group: {
        _id: null,
        likes: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        dislikes: { $sum: { $cond: [{ $eq: ['$rating', 0] }, 1, 0] } },
        total: { $sum: 1 }
      }
    }
  ]);
  
  return stats[0] || { likes: 0, dislikes: 0, total: 0 };
};

// Static method to get all tools with stats
toolReviewSchema.statics.getAllToolsStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: {
          toolName: '$toolName',
          toolUrl: '$toolUrl'
        },
        likes: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        dislikes: { $sum: { $cond: [{ $eq: ['$rating', 0] }, 1, 0] } },
        total: { $sum: 1 },
        reviews: { $sum: { $cond: [{ $ne: ['$feedback', null] }, 1, 0] } }
      }
    },
    {
      $project: {
        toolName: '$_id.toolName',
        toolUrl: '$_id.toolUrl',
        likes: 1,
        dislikes: 1,
        total: 1,
        reviews: 1,
        _id: 0
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
  
  return stats;
};

var ToolReview = mongoose.model('ToolReview', toolReviewSchema);

module.exports = ToolReview;
