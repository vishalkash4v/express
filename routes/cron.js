const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');

/**
 * Vercel Cron Job: Publish scheduled blogs
 * This endpoint is called by Vercel Cron every 5 minutes
 * Path: /api/cron/publish-scheduled
 */
router.get('/publish-scheduled', async (req, res) => {
  try {
    // Verify this is a Vercel cron request (optional security check)
    const authHeader = req.headers['authorization'];
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const now = new Date();
    
    // Find blogs scheduled to be published
    const scheduledBlogs = await Blog.find({
      status: 'scheduled',
      scheduledDate: { $lte: now }
    }).select('_id title scheduledDate');

    if (scheduledBlogs.length === 0) {
      return res.json({
        success: true,
        message: 'No scheduled blogs to publish',
        count: 0
      });
    }

    console.log(`Publishing ${scheduledBlogs.length} scheduled blog(s)...`);

    // Update blogs to published status
    const updatePromises = scheduledBlogs.map(blog => {
      return Blog.findByIdAndUpdate(
        blog._id,
        {
          status: 'published',
          publishDate: blog.scheduledDate || new Date(),
          scheduledDate: null
        },
        { new: true }
      );
    });

    const updatedBlogs = await Promise.all(updatePromises);

    console.log(`Successfully published ${updatedBlogs.length} blog(s)`);

    res.json({
      success: true,
      message: `Published ${updatedBlogs.length} blog(s)`,
      count: updatedBlogs.length,
      blogs: updatedBlogs.map(b => ({ id: b._id, title: b.title }))
    });
  } catch (error) {
    console.error('Error publishing scheduled blogs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to publish scheduled blogs'
    });
  }
});

module.exports = router;
