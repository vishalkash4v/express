var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var ToolReview = require('../models/ToolReview');
var { connectDB } = require('../utils/db');
var { authenticateToken } = require('../middleware/auth');
const sendMail = require('../utils/sendMail');
const getClientIp = require('../utils/getClientIp');

// Submit like/dislike
router.post('/submit', async function (req, res) {
    try {
        // Ensure MongoDB connection
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://cqlsysvishal:Lukethedog1234@cluster0.gcqrn8m.mongodb.net/fyntools?retryWrites=true&w=majority&appName=Cluster0';

        if (mongoose.connection.readyState !== 1) {
            try {
                await mongoose.connect(MONGODB_URI, {
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                });
            } catch (connectError) {
                console.error('Failed to connect to MongoDB:', connectError);
                return res.status(503).json({
                    success: false,
                    error: 'Database connection not available'
                });
            }
        }

        const { toolName, toolUrl, rating, feedback } = req.body;
        const ipAddress = getClientIp(req);
        const userAgent = req.headers['user-agent'] || null;

        // Validation
        if (!toolName || !toolUrl || rating === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Tool name, URL, and rating are required'
            });
        }

        if (rating !== 0 && rating !== 1) {
            return res.status(400).json({
                success: false,
                error: 'Rating must be 0 (dislike) or 1 (like)'
            });
        }

        // Create review
        const review = new ToolReview({
            toolName: toolName.trim(),
            toolUrl: toolUrl.trim(),
            rating: rating,
            ipAddress: ipAddress,
            userAgent: userAgent,
            feedback: feedback ? feedback.trim() : null
        });

        await review.save();

        // Send response immediately (don't wait for email)
        res.json({
            success: true,
            message: rating === 1 ? 'Thank you for your feedback! ❤️' : 'We appreciate your feedback',
            data: {
                id: review._id,
                toolName: review.toolName,
                rating: review.rating
            }
        });

        // Send email in background (non-blocking - don't await)
        sendMail({
            subject: `New Tool Feedback: ${toolName}`,
            html: `
      <h3>New Feedback Received</h3>
      <p><strong>Tool:</strong> ${toolName}</p>
      <p><strong>URL:</strong> ${toolUrl}</p>
      <p><strong>Rating:</strong> ${rating === 1 ? '👍 Like' : '👎 Dislike'}</p>
      <p><strong>Feedback:</strong> ${feedback || 'N/A'}</p>
      <p><strong>IP:</strong> ${ipAddress}</p>
    `
        }).catch((mailError) => {
            console.error('Email sending failed (background):', mailError);
        });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit review. Please try again.'
        });
    }
});

// Get tool stats (public)
router.get('/stats/:toolName', async function (req, res) {
    try {
        await connectDB();
        const { toolName } = req.params;
        const toolUrl = req.query.url;

        const stats = await ToolReview.getToolStats(toolName, toolUrl);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get stats'
        });
    }
});

// Admin: Get all tools with stats
router.get('/admin/tools', authenticateToken, async function (req, res) {
    try {
        await connectDB();

        const stats = await ToolReview.getAllToolsStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get all tools stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tools stats'
        });
    }
});

// Admin: Get reviews for a specific tool
router.get('/admin/reviews', authenticateToken, async function (req, res) {
    try {
        await connectDB();

        const { toolName, toolUrl, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let query = {};
        if (toolName) {
            query.toolName = toolName;
        }
        if (toolUrl) {
            query.toolUrl = toolUrl;
        }

        const reviews = await ToolReview.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await ToolReview.countDocuments(query);

        res.json({
            success: true,
            data: {
                reviews,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get reviews'
        });
    }
});

module.exports = router;
