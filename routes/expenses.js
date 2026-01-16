var express = require('express');
var router = express.Router();
var Expense = require('../models/Expense');
var Participant = require('../models/Participant');
var Trip = require('../models/Trip');
var ActivityLog = require('../models/ActivityLog');
var { authenticateToken } = require('../middleware/auth');
var { isTripMember, hasPermission } = require('../middleware/tripAuth');
var { connectDB } = require('../utils/db');

// All routes require authentication
router.use(authenticateToken);

// Helper function to log activity
async function logActivity(tripId, action, entityType, entityId, oldData, newData, performedBy) {
  try {
    await connectDB();
    await ActivityLog.create({
      tripId,
      action,
      entityType,
      entityId,
      oldData,
      newData,
      performedBy
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Create expense (requires ADD_EDIT or higher)
router.post('/:tripId/expenses', isTripMember, hasPermission(['ADD_EDIT', 'DELETE', 'ADMIN']), async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;
    const { paidBy, amount, category, description, location, date, splitType, splitDetails, receipt } = req.body;
    const performedBy = req.user.id;

    if (!paidBy || !amount || !category) {
      return res.status(400).json({
        success: false,
        error: 'Paid by, amount, and category are required'
      });
    }

    // Validate participant belongs to trip
    const participant = await Participant.findOne({
      _id: paidBy,
      tripId: tripId
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found in this trip'
      });
    }

    const expense = await Expense.create({
      tripId: tripId,
      paidBy: paidBy,
      amount: parseFloat(amount),
      category: category.trim(),
      description: description ? description.trim() : null,
      location: location ? location.trim() : null,
      date: date ? new Date(date) : new Date(),
      splitType: splitType || 'EQUAL',
      splitDetails: splitDetails || null,
      receipt: receipt || null,
      createdBy: performedBy
    });

    // Log activity
    await logActivity(tripId, 'CREATE', 'EXPENSE', expense._id.toString(), null, {
      category: expense.category,
      amount: expense.amount,
      paidBy: expense.paidBy.toString()
    }, performedBy);

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name');

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.toTrip(tripId, 'expense-created', populatedExpense);
    }

    res.status(201).json({
      success: true,
      data: populatedExpense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(function(e) { return e.message; });
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    // Handle cast errors (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: `Invalid ${error.path || 'data'} provided`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create expense. Please check all fields and try again.'
    });
  }
});

// Get all expenses for a trip
router.get('/:tripId/expenses', isTripMember, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;

    const expenses = await Expense.find({ tripId })
      .populate('paidBy', 'name')
      .sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      data: expenses
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expenses'
    });
  }
});

// Update expense (requires ADD_EDIT or higher)
router.patch('/:tripId/expenses/:expenseId', isTripMember, hasPermission(['ADD_EDIT', 'DELETE', 'ADMIN']), async function(req, res) {
  try {
    await connectDB();
    const { tripId, expenseId } = req.params;
    const { paidBy, amount, category, description, location, date, splitType, splitDetails, receipt } = req.body;
    const performedBy = req.user.id;

    const expense = await Expense.findOne({
      _id: expenseId,
      tripId: tripId
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    const oldData = {
      paidBy: expense.paidBy.toString(),
      amount: expense.amount,
      category: expense.category,
      description: expense.description
    };

    if (paidBy) {
      // Validate participant belongs to trip
      const participant = await Participant.findOne({
        _id: paidBy,
        tripId: tripId
      });
      if (!participant) {
        return res.status(404).json({
          success: false,
          error: 'Participant not found in this trip'
        });
      }
      expense.paidBy = paidBy;
    }
    if (amount !== undefined) expense.amount = parseFloat(amount);
    if (category) expense.category = category.trim();
    if (description !== undefined) expense.description = description ? description.trim() : null;
    if (location !== undefined) expense.location = location ? location.trim() : null;
    if (date) expense.date = new Date(date);
    if (splitType) expense.splitType = splitType;
    if (splitDetails !== undefined) expense.splitDetails = splitDetails;
    if (receipt !== undefined) expense.receipt = receipt;

    await expense.save();

    // Log activity
    await logActivity(tripId, 'EDIT', 'EXPENSE', expenseId, oldData, {
      paidBy: expense.paidBy.toString(),
      amount: expense.amount,
      category: expense.category
    }, performedBy);

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name');

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.toTrip(tripId, 'expense-updated', populatedExpense);
    }

    res.json({
      success: true,
      data: populatedExpense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(function(e) { return e.message; });
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }

    // Handle cast errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: `Invalid ${error.path || 'data'} provided`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update expense. Please check all fields and try again.'
    });
  }
});

// Delete expense (requires DELETE or ADMIN)
router.delete('/:tripId/expenses/:expenseId', isTripMember, hasPermission(['DELETE', 'ADMIN']), async function(req, res) {
  try {
    await connectDB();
    const { tripId, expenseId } = req.params;
    const performedBy = req.user.id;

    const expense = await Expense.findOne({
      _id: expenseId,
      tripId: tripId
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found'
      });
    }

    const oldData = {
      category: expense.category,
      amount: expense.amount,
      paidBy: expense.paidBy.toString()
    };

    // Log activity before deletion
    await logActivity(tripId, 'DELETE', 'EXPENSE', expenseId, oldData, null, performedBy);

    await Expense.findByIdAndDelete(expenseId);

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.toTrip(tripId, 'expense-deleted', expenseId);
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete expense. Please try again.'
    });
  }
});

module.exports = router;
