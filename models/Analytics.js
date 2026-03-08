var mongoose = require('mongoose');

var analyticsSchema = new mongoose.Schema({
  pageType: {
    type: String,
    required: true,
    enum: ['tool', 'blog', 'shorturl', 'other'],
    index: true
  },
  pageId: {
    type: String,
    required: true,
    index: true
  },
  pagePath: {
    type: String,
    required: true,
    index: true
  },
  pageTitle: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  views: {
    type: Number,
    default: 0,
    min: 0
  },
  uniqueViews: {
    type: Number,
    default: 0,
    min: 0
  },
  // Store daily aggregated data
  year: {
    type: Number,
    index: true
  },
  month: {
    type: Number,
    index: true
  },
  day: {
    type: Number,
    index: true
  },
  week: {
    type: Number,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
analyticsSchema.index({ pageType: 1, pageId: 1, date: -1 });
analyticsSchema.index({ date: -1, pageType: 1 });
analyticsSchema.index({ year: 1, month: 1, day: 1 });
analyticsSchema.index({ pagePath: 1, date: -1 });

// Static method to get or create daily analytics record
analyticsSchema.statics.getOrCreateDaily = async function(pageType, pageId, pagePath, pageTitle) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  // Calculate week number (ISO week)
  const week = getWeekNumber(today);
  
  let record = await this.findOne({
    pageType,
    pageId,
    date: today
  });
  
  if (!record) {
    record = new this({
      pageType,
      pageId,
      pagePath,
      pageTitle,
      date: today,
      year,
      month,
      day,
      week,
      views: 0,
      uniqueViews: 0
    });
    await record.save();
  }
  
  return record;
};

// Helper function to calculate ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Static method to increment view count
analyticsSchema.statics.incrementView = async function(pageType, pageId, pagePath, pageTitle, isUnique = false) {
  const record = await this.getOrCreateDaily(pageType, pageId, pagePath, pageTitle);
  record.views += 1;
  if (isUnique) {
    record.uniqueViews += 1;
  }
  await record.save();
  return record;
};

// Static method to get analytics for date range
analyticsSchema.statics.getAnalytics = async function(startDate, endDate, pageType = null, pageId = null) {
  const query = {
    date: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (pageType) {
    query.pageType = pageType;
  }
  
  if (pageId) {
    query.pageId = pageId;
  }
  
  return await this.find(query).sort({ date: 1 });
};

// Static method to get aggregated daily stats
analyticsSchema.statics.getDailyStats = async function(startDate, endDate, pageType = null) {
  const matchQuery = {
    date: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (pageType) {
    matchQuery.pageType = pageType;
  }
  
  return await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          year: '$year',
          month: '$month',
          day: '$day'
        },
        date: { $first: '$date' },
        totalViews: { $sum: '$views' },
        totalUniqueViews: { $sum: '$uniqueViews' },
        pageCount: { $sum: 1 }
      }
    },
    { $sort: { date: 1 } }
  ]);
};

// Static method to get top pages
analyticsSchema.statics.getTopPages = async function(startDate, endDate, limit = 10, pageType = null) {
  const matchQuery = {
    date: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (pageType) {
    matchQuery.pageType = pageType;
  }
  
  return await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          pageType: '$pageType',
          pageId: '$pageId',
          pagePath: '$pagePath',
          pageTitle: '$pageTitle'
        },
        totalViews: { $sum: '$views' },
        totalUniqueViews: { $sum: '$uniqueViews' },
        daysActive: { $sum: 1 }
      }
    },
    { $sort: { totalViews: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        pageType: '$_id.pageType',
        pageId: '$_id.pageId',
        pagePath: '$_id.pagePath',
        pageTitle: '$_id.pageTitle',
        totalViews: 1,
        totalUniqueViews: 1,
        daysActive: 1
      }
    }
  ]);
};

// Static method to get trending pages (comparing two periods)
analyticsSchema.statics.getTrendingPages = async function(currentStart, currentEnd, previousStart, previousEnd, limit = 10) {
  // Get current period stats
  const currentStats = await this.aggregate([
    {
      $match: {
        date: { $gte: currentStart, $lte: currentEnd }
      }
    },
    {
      $group: {
        _id: {
          pageType: '$pageType',
          pageId: '$pageId',
          pagePath: '$pagePath',
          pageTitle: '$pageTitle'
        },
        currentViews: { $sum: '$views' }
      }
    }
  ]);
  
  // Get previous period stats
  const previousStats = await this.aggregate([
    {
      $match: {
        date: { $gte: previousStart, $lte: previousEnd }
      }
    },
    {
      $group: {
        _id: {
          pageType: '$pageType',
          pageId: '$pageId',
          pagePath: '$pagePath',
          pageTitle: '$pageTitle'
        },
        previousViews: { $sum: '$views' }
      }
    }
  ]);
  
  // Create maps for easy lookup
  const currentMap = new Map();
  currentStats.forEach(stat => {
    const key = `${stat._id.pageType}:${stat._id.pageId}`;
    currentMap.set(key, {
      pageType: stat._id.pageType,
      pageId: stat._id.pageId,
      pagePath: stat._id.pagePath,
      pageTitle: stat._id.pageTitle,
      currentViews: stat.currentViews
    });
  });
  
  const previousMap = new Map();
  previousStats.forEach(stat => {
    const key = `${stat._id.pageType}:${stat._id.pageId}`;
    previousMap.set(key, stat.previousViews);
  });
  
  // Calculate trends
  const trends = [];
  currentMap.forEach((current, key) => {
    const previousViews = previousMap.get(key) || 0;
    const change = current.currentViews - previousViews;
    const changePercent = previousViews > 0 
      ? ((change / previousViews) * 100).toFixed(1)
      : current.currentViews > 0 ? 100 : 0;
    
    trends.push({
      ...current,
      previousViews,
      change,
      changePercent: parseFloat(changePercent),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    });
  });
  
  // Sort by absolute change
  trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  return trends.slice(0, limit);
};

module.exports = mongoose.model('Analytics', analyticsSchema);
