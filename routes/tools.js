const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Admin routes (protected)
router.post('/sync', authenticateAdmin, toolController.syncTools);
router.get('/', authenticateAdmin, toolController.getAllTools);
router.get('/:id', authenticateAdmin, toolController.getToolById);

module.exports = router;
