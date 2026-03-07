const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Public routes (only published blogs)
router.get('/public', blogController.getPublishedBlogs); // Get published blogs only
router.get('/public/:slug', blogController.getBlogBySlug); // Get published blog by slug
router.get('/categories', blogController.getCategories);
router.get('/tags', blogController.getTags);
router.get('/:slug/related', blogController.getRelatedBlogs);

// Admin routes (protected)
router.get('/', authenticateAdmin, blogController.getAllBlogs);
router.get('/admin/:id', authenticateAdmin, blogController.getBlogById);
router.post('/', authenticateAdmin, blogController.createBlog);
router.post('/generate-ai', authenticateAdmin, blogController.generateAIBlog);
router.put('/:id', authenticateAdmin, blogController.updateBlog);
router.delete('/:id', authenticateAdmin, blogController.deleteBlog);
router.post('/upload-image', authenticateAdmin, blogController.uploadFeaturedImage);

module.exports = router;
