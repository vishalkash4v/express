const Analytics = require('../models/Analytics');
const Blog = require('../models/Blog');
const Tool = require('../models/Tool');
const { connectDB } = require('../utils/db');

// Helper to get blog analytics
async function getBlogAnalytics(startDate, endDate) {
  const blogStats = await Analytics.aggregate([
    {
      $match: {
        pageType: 'blog',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$pageId',
        totalViews: { $sum: '$views' },
        totalUniqueViews: { $sum: '$uniqueViews' },
        daysActive: { $sum: 1 },
        pageTitle: { $first: '$pageTitle' },
        pagePath: { $first: '$pagePath' }
      }
    },
    { $sort: { totalViews: -1 } },
    { $limit: 10 }
  ]);
  
  // Get blog details from Blog model
  const blogIds = blogStats.map(stat => stat._id);
  const blogs = await Blog.find({ _id: { $in: blogIds } }).select('_id title slug category publishDate viewCount').lean();
  
  const blogMap = new Map();
  blogs.forEach(blog => {
    blogMap.set(blog._id.toString(), blog);
  });
  
  return blogStats.map(stat => {
    const blog = blogMap.get(stat._id);
    return {
      blogId: stat._id,
      title: blog?.title || stat.pageTitle,
      slug: blog?.slug || '',
      category: blog?.category || '',
      publishDate: blog?.publishDate || null,
      totalViews: stat.totalViews,
      totalUniqueViews: stat.totalUniqueViews,
      daysActive: stat.daysActive,
      dbViewCount: blog?.viewCount || 0
    };
  });
}

// Get dashboard analytics overview
exports.getDashboardAnalytics = async (req, res) => {
  try {
    await connectDB();
    
    const { period = '7d' } = req.query; // 7d, 30d, 90d, 1y
    
    // Calculate date ranges
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    let previousStartDate = new Date();
    let previousEndDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 8);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        previousStartDate.setDate(endDate.getDate() - 60);
        previousEndDate.setDate(endDate.getDate() - 31);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        previousStartDate.setDate(endDate.getDate() - 180);
        previousEndDate.setDate(endDate.getDate() - 91);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        previousStartDate.setFullYear(endDate.getFullYear() - 2);
        previousEndDate.setFullYear(endDate.getFullYear() - 1);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 8);
    }
    
    startDate.setHours(0, 0, 0, 0);
    previousStartDate.setHours(0, 0, 0, 0);
    previousEndDate.setHours(23, 59, 59, 999);
    
    // Get daily stats
    const dailyStats = await Analytics.getDailyStats(startDate, endDate);
    
    // Get top pages
    const topPages = await Analytics.getTopPages(startDate, endDate, 10);
    
    // Get trending pages
    const trendingPages = await Analytics.getTrendingPages(
      startDate, endDate,
      previousStartDate, previousEndDate,
      10
    );
    
    // Get stats by page type
    const statsByType = await Analytics.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$pageType',
          totalViews: { $sum: '$views' },
          totalUniqueViews: { $sum: '$uniqueViews' },
          pageCount: { $sum: 1 }
        }
      }
    ]);
    
    // Get previous period totals for comparison
    const previousStats = await Analytics.aggregate([
      {
        $match: {
          date: { $gte: previousStartDate, $lte: previousEndDate }
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalUniqueViews: { $sum: '$uniqueViews' }
        }
      }
    ]);
    
    const currentTotal = dailyStats.reduce((sum, day) => sum + day.totalViews, 0);
    const previousTotal = previousStats[0]?.totalViews || 0;
    const change = currentTotal - previousTotal;
    const changePercent = previousTotal > 0 
      ? ((change / previousTotal) * 100).toFixed(1)
      : currentTotal > 0 ? 100 : 0;
    
    // Get blog and tool counts
    const blogCount = await Blog.countDocuments({ status: 'published' });
    const toolCount = await Tool.countDocuments({ isActive: true });
    
    // Get blog performance analytics
    const blogAnalytics = await getBlogAnalytics(startDate, endDate);
    
    // Get previous period blog analytics for comparison
    const previousBlogAnalytics = await getBlogAnalytics(previousStartDate, previousEndDate);
    
    // Calculate blog trends
    const blogTrends = blogAnalytics.map(current => {
      const previous = previousBlogAnalytics.find(p => p.blogId === current.blogId);
      const previousViews = previous?.totalViews || 0;
      const change = current.totalViews - previousViews;
      const changePercent = previousViews > 0 
        ? ((change / previousViews) * 100).toFixed(1)
        : current.totalViews > 0 ? 100 : 0;
      
      return {
        ...current,
        previousViews,
        change,
        changePercent: parseFloat(changePercent),
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    });
    
    res.json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate,
          end: endDate
        },
        overview: {
          totalViews: currentTotal,
          totalUniqueViews: dailyStats.reduce((sum, day) => sum + day.totalUniqueViews, 0),
          previousTotalViews: previousTotal,
          change,
          changePercent: parseFloat(changePercent),
          blogCount,
          toolCount
        },
        blogAnalytics: blogTrends,
        dailyStats: dailyStats.map(stat => ({
          date: stat.date,
          views: stat.totalViews,
          uniqueViews: stat.totalUniqueViews,
          pageCount: stat.pageCount
        })),
        topPages,
        trendingPages,
        statsByType: statsByType.map(stat => ({
          pageType: stat._id,
          views: stat.totalViews,
          uniqueViews: stat.totalUniqueViews,
          pageCount: stat.pageCount
        }))
      }
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
};

// Track page view
exports.trackPageView = async (req, res) => {
  try {
    await connectDB();
    
    // Get client IP for unique view detection (optional)
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    const { pageType, pageId, pagePath, pageTitle } = req.body;
    
    if (!pageType || !pageId || !pagePath) {
      return res.status(400).json({
        success: false,
        error: 'pageType, pageId, and pagePath are required'
      });
    }
    
    // For now, treat all views as unique (can be enhanced with session/IP tracking)
    const isUnique = true;
    
    await Analytics.incrementView(pageType, pageId, pagePath, pageTitle || '', isUnique);
    
    // Return success immediately (don't wait for response)
    res.status(200).json({
      success: true,
      message: 'Page view tracked'
    });
  } catch (error) {
    console.error('Track page view error:', error);
    // Still return success to not break user experience
    res.status(200).json({
      success: false,
      error: 'Failed to track page view'
    });
  }
};

// Get blog analytics (dedicated endpoint)
exports.getBlogAnalytics = async (req, res) => {
  try {
    await connectDB();
    
    const { period = '30d' } = req.query;
    
    // Calculate date ranges
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    let previousStartDate = new Date();
    let previousEndDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 8);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        previousStartDate.setDate(endDate.getDate() - 60);
        previousEndDate.setDate(endDate.getDate() - 31);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        previousStartDate.setDate(endDate.getDate() - 180);
        previousEndDate.setDate(endDate.getDate() - 91);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        previousStartDate.setFullYear(endDate.getFullYear() - 2);
        previousEndDate.setFullYear(endDate.getFullYear() - 1);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
        previousStartDate.setDate(endDate.getDate() - 60);
        previousEndDate.setDate(endDate.getDate() - 31);
    }
    
    startDate.setHours(0, 0, 0, 0);
    previousStartDate.setHours(0, 0, 0, 0);
    previousEndDate.setHours(23, 59, 59, 999);
    
    // Get blog analytics
    const blogAnalytics = await getBlogAnalytics(startDate, endDate);
    const previousBlogAnalytics = await getBlogAnalytics(previousStartDate, previousEndDate);
    
    // Calculate trends
    const blogTrends = blogAnalytics.map(current => {
      const previous = previousBlogAnalytics.find(p => p.blogId === current.blogId);
      const previousViews = previous?.totalViews || 0;
      const change = current.totalViews - previousViews;
      const changePercent = previousViews > 0 
        ? ((change / previousViews) * 100).toFixed(1)
        : current.totalViews > 0 ? 100 : 0;
      
      return {
        ...current,
        previousViews,
        change,
        changePercent: parseFloat(changePercent),
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    });
    
    // Get daily stats for blogs
    const dailyStats = await Analytics.getDailyStats(startDate, endDate, 'blog');
    
    // Get category stats
    const categoryStats = await Analytics.aggregate([
      {
        $match: {
          pageType: 'blog',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'blogs',
          localField: 'pageId',
          foreignField: '_id',
          as: 'blog'
        }
      },
      {
        $unwind: {
          path: '$blog',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$blog.category',
          views: { $sum: '$views' },
          uniqueViews: { $sum: '$uniqueViews' },
          blogCount: { $addToSet: '$pageId' }
        }
      },
      {
        $project: {
          category: { $ifNull: ['$_id', 'Uncategorized'] },
          views: 1,
          uniqueViews: 1,
          blogCount: { $size: '$blogCount' }
        }
      },
      { $sort: { views: -1 } }
    ]);
    
    // Calculate overview
    const totalBlogViews = blogTrends.reduce((sum, blog) => sum + blog.totalViews, 0);
    const totalUniqueViews = blogTrends.reduce((sum, blog) => sum + blog.totalUniqueViews, 0);
    const previousTotalViews = previousBlogAnalytics.reduce((sum, blog) => sum + blog.totalViews, 0);
    const change = totalBlogViews - previousTotalViews;
    const changePercent = previousTotalViews > 0 
      ? ((change / previousTotalViews) * 100).toFixed(1)
      : totalBlogViews > 0 ? 100 : 0;
    
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: 'published' });
    const averageViewsPerBlog = publishedBlogs > 0 ? Math.round(totalBlogViews / publishedBlogs) : 0;
    
    res.json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate,
          end: endDate
        },
        overview: {
          totalBlogViews,
          totalUniqueViews,
          previousTotalViews,
          change,
          changePercent: parseFloat(changePercent),
          totalBlogs,
          publishedBlogs,
          averageViewsPerBlog
        },
        blogAnalytics: blogTrends,
        categoryStats: categoryStats.map(stat => ({
          category: stat.category,
          views: stat.views,
          uniqueViews: stat.uniqueViews,
          blogCount: stat.blogCount
        })),
        dailyStats: dailyStats.map(stat => ({
          date: stat.date,
          views: stat.totalViews,
          uniqueViews: stat.totalUniqueViews,
          blogCount: stat.pageCount
        }))
      }
    });
  } catch (error) {
    console.error('Get blog analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog analytics'
    });
  }
};

// Get page analytics
exports.getPageAnalytics = async (req, res) => {
  try {
    await connectDB();
    
    const { pageType, pageId, period = '30d' } = req.query;
    
    if (!pageType || !pageId) {
      return res.status(400).json({
        success: false,
        error: 'pageType and pageId are required'
      });
    }
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);
    
    const analytics = await Analytics.getAnalytics(startDate, endDate, pageType, pageId);
    
    const totalViews = analytics.reduce((sum, record) => sum + record.views, 0);
    const totalUniqueViews = analytics.reduce((sum, record) => sum + record.uniqueViews, 0);
    
    res.json({
      success: true,
      data: {
        pageType,
        pageId,
        period,
        totalViews,
        totalUniqueViews,
        dailyData: analytics.map(record => ({
          date: record.date,
          views: record.views,
          uniqueViews: record.uniqueViews
        }))
      }
    });
  } catch (error) {
    console.error('Get page analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch page analytics'
    });
  }
};
