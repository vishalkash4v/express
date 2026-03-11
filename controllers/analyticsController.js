const crypto = require('crypto');
const Analytics = require('../models/Analytics');
const PageViewSession = require('../models/PageViewSession');
const Blog = require('../models/Blog');
const Tool = require('../models/Tool');
const { connectDB } = require('../utils/db');

// Generate data-driven positive highlights for admin notifications
function generatePositiveHighlights(data) {
  const highlights = [];
  if (!data) return highlights;

  const { overview, topPages, trendingPages, blogAnalytics } = data;

  if (overview?.totalUniqueViews > 0) {
    highlights.push({
      id: 'unique',
      type: 'success',
      message: `${overview.totalUniqueViews.toLocaleString()} unique visitors this period — real people discovering your tools!`,
      icon: 'users'
    });
  }
  if (overview?.changePercent > 0 && overview.changePercent >= 10) {
    highlights.push({
      id: 'growth',
      type: 'trending',
      message: `Traffic up ${overview.changePercent}% vs last period — your content is resonating!`,
      icon: 'trending-up'
    });
  }
  if (topPages?.[0]) {
    const top = topPages[0];
    highlights.push({
      id: 'top-page',
      type: 'star',
      message: `Top performer: "${top.pageTitle}" with ${top.totalUniqueViews?.toLocaleString() || top.totalViews?.toLocaleString()} unique views`,
      icon: 'award'
    });
  }
  const trendingUp = trendingPages?.filter(p => p.trend === 'up' && p.changePercent > 15);
  if (trendingUp?.length > 0) {
    const best = trendingUp[0];
    highlights.push({
      id: 'trending',
      type: 'fire',
      message: `Trending: "${best.pageTitle}" +${best.changePercent}% — gaining momentum!`,
      icon: 'fire'
    });
  }
  const topBlog = blogAnalytics?.[0];
  if (topBlog?.totalUniqueViews > 0) {
    highlights.push({
      id: 'blog',
      type: 'blog',
      message: `Your blog "${topBlog.title}" has ${topBlog.totalUniqueViews.toLocaleString()} unique readers`,
      icon: 'file-text'
    });
  }
  if (overview?.toolCount > 0 && overview.toolCount >= 10) {
    highlights.push({
      id: 'tools',
      type: 'tools',
      message: `${overview.toolCount} active tools helping users every day`,
      icon: 'wrench'
    });
  }
  if (overview?.totalViews > 0 && overview.totalUniqueViews > 0) {
    const engagement = ((overview.totalUniqueViews / overview.totalViews) * 100).toFixed(0);
    if (parseInt(engagement) >= 60) {
      highlights.push({
        id: 'engagement',
        type: 'engagement',
        message: `${engagement}% of views are unique visitors — great content stickiness!`,
        icon: 'heart'
      });
    }
  }
  if (highlights.length === 0) {
    highlights.push({
      id: 'welcome',
      type: 'welcome',
      message: 'Your dashboard is ready. Keep creating — every new tool and blog brings value!',
      icon: 'sparkles'
    });
  }
  return highlights.slice(0, 6);
}

// Lightweight dashboard - top 5 pages, minimal data, ETag caching
exports.getDashboardSimple = async (req, res) => {
  try {
    await connectDB();
    const { period = '1d' } = req.query; // 1d (today), 7d (weekly), 30d (monthly)

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    let startDate = new Date();
    let previousStartDate = new Date();
    let previousEndDate = new Date();

    switch (period) {
      case '1d':
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(startDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setDate(startDate.getDate() - 1);
        previousEndDate.setHours(23, 59, 59, 999);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 8);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setHours(23, 59, 59, 999);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        previousStartDate.setDate(endDate.getDate() - 60);
        previousEndDate.setDate(endDate.getDate() - 31);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
        previousStartDate.setDate(endDate.getDate() - 14);
        previousEndDate.setDate(endDate.getDate() - 8);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setHours(0, 0, 0, 0);
        previousEndDate.setHours(23, 59, 59, 999);
    }

    const [dailyStats, topPages, previousStats, counts] = await Promise.all([
      Analytics.getDailyStats(startDate, endDate),
      Analytics.getTopPages(startDate, endDate, 5),
      Analytics.aggregate([
        { $match: { date: { $gte: previousStartDate, $lte: previousEndDate } } },
        { $group: { _id: null, totalViews: { $sum: '$views' }, totalUniqueViews: { $sum: '$uniqueViews' } } }
      ]),
      Promise.all([
        Blog.countDocuments({ status: 'published' }),
        Tool.countDocuments({ isActive: true })
      ])
    ]);
    const [blogCount, toolCount] = counts;

    const currentTotal = dailyStats.reduce((sum, d) => sum + d.totalViews, 0);
    const previousTotal = previousStats[0]?.totalViews || 0;
    const changePercent = previousTotal > 0 ? (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1) : currentTotal > 0 ? 100 : 0;

    const responseData = {
      period,
      overview: {
        totalViews: currentTotal,
        totalUniqueViews: dailyStats.reduce((s, d) => s + d.totalUniqueViews, 0),
        changePercent: parseFloat(changePercent)
      },
      topPages,
      dailyStats: dailyStats.map(d => ({ date: d.date, views: d.totalViews, uniqueViews: d.totalUniqueViews })),
      positiveHighlights: generatePositiveHighlights({
        overview: { totalViews: currentTotal, totalUniqueViews: dailyStats.reduce((s, d) => s + d.totalUniqueViews, 0), changePercent: parseFloat(changePercent), toolCount, blogCount },
        topPages,
        trendingPages: [],
        blogAnalytics: topPages.filter(p => p.pageType === 'blog').slice(0, 1).map(p => ({ title: p.pageTitle, totalUniqueViews: p.totalUniqueViews }))
      })
    };

    const body = JSON.stringify({ success: true, data: responseData });
    const etag = crypto.createHash('md5').update(body).digest('hex');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', `"${etag}"`);
    if (req.headers['if-none-match'] === `"${etag}"`) {
      return res.status(304).end();
    }
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('getDashboardSimple error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
};

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

    // Latest page visits - pages ordered by most recent visit date
    const latestPageVisitsRaw = await Analytics.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
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
          totalViews: { $sum: '$views' },
          totalUniqueViews: { $sum: '$uniqueViews' },
          lastVisitDate: { $max: '$date' },
          daysActive: { $sum: 1 }
        }
      },
      { $sort: { lastVisitDate: -1, totalViews: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 0,
          pageType: '$_id.pageType',
          pageId: '$_id.pageId',
          pagePath: '$_id.pagePath',
          pageTitle: '$_id.pageTitle',
          totalViews: 1,
          totalUniqueViews: 1,
          lastVisitDate: 1,
          daysActive: 1
        }
      }
    ]);
    const latestPageVisits = latestPageVisitsRaw;
    
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
    
    const responseData = {
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
      latestPageVisits,
      statsByType: statsByType.map(stat => ({
        pageType: stat._id,
        views: stat.totalViews,
        uniqueViews: stat.totalUniqueViews,
        pageCount: stat.pageCount
      }))
    };

    responseData.positiveHighlights = generatePositiveHighlights(responseData);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
};

// Track page view (session-based unique view detection)
exports.trackPageView = async (req, res) => {
  try {
    await connectDB();
    
    const { pageType, pageId, pagePath, pageTitle, sessionId } = req.body;
    
    if (!pageType || !pageId || !pagePath) {
      return res.status(400).json({
        success: false,
        error: 'pageType, pageId, and pagePath are required'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isUnique = true;
    if (sessionId && typeof sessionId === 'string') {
      try {
        const insertResult = await PageViewSession.create({
          pageType,
          pageId,
          date: today,
          sessionId: sessionId.substring(0, 128)
        });
        isUnique = !!insertResult;
      } catch (err) {
        if (err.code === 11000) {
          isUnique = false;
        } else {
          throw err;
        }
      }
    }

    await Analytics.incrementView(pageType, pageId, pagePath, pageTitle || '', isUnique);
    
    res.status(200).json({
      success: true,
      message: 'Page view tracked'
    });
  } catch (error) {
    console.error('Track page view error:', error);
    res.status(200).json({
      success: false,
      error: 'Failed to track page view'
    });
  }
};

// Get positive highlights for admin notifications (data-driven, real-time)
exports.getPositiveHighlights = async (req, res) => {
  try {
    await connectDB();
    const { period = '7d' } = req.query;

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    const previousStartDate = new Date();
    const previousEndDate = new Date();

    switch (period) {
      case '7d': startDate.setDate(endDate.getDate() - 7); previousStartDate.setDate(endDate.getDate() - 14); previousEndDate.setDate(endDate.getDate() - 8); break;
      case '30d': startDate.setDate(endDate.getDate() - 30); previousStartDate.setDate(endDate.getDate() - 60); previousEndDate.setDate(endDate.getDate() - 31); break;
      case '90d': startDate.setDate(endDate.getDate() - 90); previousStartDate.setDate(endDate.getDate() - 180); previousEndDate.setDate(endDate.getDate() - 91); break;
      case '1y': startDate.setFullYear(endDate.getFullYear() - 1); previousStartDate.setFullYear(endDate.getFullYear() - 2); previousEndDate.setFullYear(endDate.getFullYear() - 1); previousEndDate.setDate(previousEndDate.getDate() - 1); break;
      default: startDate.setDate(endDate.getDate() - 7); previousStartDate.setDate(endDate.getDate() - 14); previousEndDate.setDate(endDate.getDate() - 8);
    }
    startDate.setHours(0, 0, 0, 0);
    previousStartDate.setHours(0, 0, 0, 0);
    previousEndDate.setHours(23, 59, 59, 999);

    const [dailyStats, topPages, trendingPages, statsByType, blogStats] = await Promise.all([
      Analytics.getDailyStats(startDate, endDate),
      Analytics.getTopPages(startDate, endDate, 5),
      Analytics.getTrendingPages(startDate, endDate, previousStartDate, previousEndDate, 5),
      Analytics.aggregate([{ $match: { date: { $gte: startDate, $lte: endDate } } }, { $group: { _id: null, totalViews: { $sum: '$views' }, totalUniqueViews: { $sum: '$uniqueViews' } } }]),
      getBlogAnalytics(startDate, endDate)
    ]);

    const currentTotal = dailyStats.reduce((sum, d) => sum + d.totalViews, 0);
    const totalUnique = dailyStats.reduce((sum, d) => sum + d.totalUniqueViews, 0);
    const blogCount = await Blog.countDocuments({ status: 'published' });
    const toolCount = await Tool.countDocuments({ isActive: true });

    const previousStats = await Analytics.aggregate([{ $match: { date: { $gte: previousStartDate, $lte: previousEndDate } } }, { $group: { _id: null, totalViews: { $sum: '$views' }, totalUniqueViews: { $sum: '$uniqueViews' } } }]);
    const previousTotal = previousStats[0]?.totalViews || 0;
    const changePercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1) : currentTotal > 0 ? 100 : 0;

    const data = {
      overview: { totalViews: currentTotal, totalUniqueViews: totalUnique, changePercent: parseFloat(changePercent), blogCount, toolCount },
      topPages,
      trendingPages,
      blogAnalytics: blogStats
    };
    const highlights = generatePositiveHighlights(data);

    res.json({ success: true, data: { highlights } });
  } catch (error) {
    console.error('Get highlights error:', error);
    res.json({ success: true, data: { highlights: [{ id: 'welcome', type: 'welcome', message: 'Your dashboard is ready. Keep creating!', icon: 'sparkles' }] } });
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
