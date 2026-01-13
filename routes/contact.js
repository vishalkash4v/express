var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Contact = require('../models/Contact');
var { connectDB } = require('../utils/db');
var { authenticateToken } = require('../middleware/auth');
const getClientIp = require('../utils/getClientIp');
const sendMail = require('../utils/sendMail');

// Submit contact form (public)
router.post('/submit', async function(req, res) {
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

    const { name, email, subject, message } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, subject, and message are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    // Create contact entry
    const contact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      ipAddress: ipAddress,
      userAgent: userAgent,
      status: 'new'
    });

    await contact.save();

    // Send response immediately (don't wait for email)
    res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        id: contact._id
      }
    });

    // Send email notification in background (non-blocking)
    sendMail({
      subject: `New Contact Form Submission: ${subject.trim()}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name.trim()}</p>
        <p><strong>Email:</strong> ${email.trim()}</p>
        <p><strong>Subject:</strong> ${subject.trim()}</p>
        <p><strong>Message:</strong></p>
        <p>${message.trim().replace(/\n/g, '<br>')}</p>
        <p><strong>IP Address:</strong> ${ipAddress}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
      `
    }).catch((mailError) => {
      console.error('Email sending failed (background):', mailError);
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit contact form. Please try again.'
    });
  }
});

// Admin: Get all contacts (with pagination and filters)
router.get('/admin/list', authenticateToken, async function(req, res) {
  try {
    await connectDB();
    
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (status && ['new', 'read', 'replied', 'archived'].includes(status)) {
      query.status = status;
    }
    
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');
    
    const total = await Contact.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        contacts,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts'
    });
  }
});

// Admin: Get contact by ID
router.get('/admin/:id', authenticateToken, async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    
    const contact = await Contact.findById(id).select('-__v');
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    // Mark as read if it's new
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }
    
    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact'
    });
  }
});

// Admin: Update contact status
router.patch('/admin/:id/status', authenticateToken, async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['new', 'read', 'replied', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: new, read, replied, or archived'
      });
    }
    
    const contact = await Contact.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).select('-__v');
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    res.json({
      success: true,
      data: contact
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact status'
    });
  }
});

// Admin: Delete contact
router.delete('/admin/:id', authenticateToken, async function(req, res) {
  try {
    await connectDB();
    const { id } = req.params;
    
    const contact = await Contact.findByIdAndDelete(id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact'
    });
  }
});

// Admin: Get contact statistics
router.get('/admin/stats', authenticateToken, async function(req, res) {
  try {
    await connectDB();
    
    const total = await Contact.countDocuments();
    const newCount = await Contact.countDocuments({ status: 'new' });
    const readCount = await Contact.countDocuments({ status: 'read' });
    const repliedCount = await Contact.countDocuments({ status: 'replied' });
    const archivedCount = await Contact.countDocuments({ status: 'archived' });
    
    res.json({
      success: true,
      data: {
        total,
        new: newCount,
        read: readCount,
        replied: repliedCount,
        archived: archivedCount
      }
    });
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact statistics'
    });
  }
});

module.exports = router;
