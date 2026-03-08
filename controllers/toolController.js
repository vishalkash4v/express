const Tool = require('../models/Tool');
const { connectDB } = require('../utils/db');
const fs = require('fs');
const path = require('path');

// Read toolsData.json file and extract tools
function extractToolsFromFile() {
  try {
    // Read from backend's data directory (works in both local and Vercel)
    const filePath = path.join(__dirname, '../data/toolsData.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`toolsData.json not found at ${filePath}. Please run: node scripts/extractToolsData.js`);
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const tools = JSON.parse(fileContent);
    
    // Validate that we have tools
    if (!Array.isArray(tools) || tools.length === 0) {
      throw new Error('toolsData.json is empty or invalid');
    }
    
    return tools;
  } catch (error) {
    console.error('Error reading tools from JSON file:', error);
    throw error;
  }
}

// Sync tools from toolsData.ts to database
exports.syncTools = async (req, res) => {
  try {
    await connectDB();
    
    console.log('Starting tools sync from toolsData.json...');
    
    // Extract tools from file
    const toolsFromFile = extractToolsFromFile();
    
    if (!toolsFromFile || toolsFromFile.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tools found in toolsData.json file'
      });
    }
    
    let created = 0;
    let updated = 0;
    let errors = [];
    
    // Process each tool
    for (const toolData of toolsFromFile) {
      try {
        // Check if tool exists
        const existingTool = await Tool.findOne({ id: toolData.id });
        
        if (existingTool) {
          // Update existing tool
          existingTool.name = toolData.name;
          existingTool.category = toolData.category;
          existingTool.description = toolData.description;
          existingTool.keywords = toolData.keywords;
          existingTool.path = toolData.path;
          existingTool.href = toolData.href;
          existingTool.url = toolData.url;
          existingTool.features = toolData.features;
          existingTool.isActive = true;
          existingTool.lastSyncedAt = new Date();
          
          await existingTool.save();
          updated++;
        } else {
          // Create new tool
          const newTool = new Tool({
            id: toolData.id,
            name: toolData.name,
            category: toolData.category,
            description: toolData.description,
            keywords: toolData.keywords,
            path: toolData.path,
            href: toolData.href,
            url: toolData.url,
            features: toolData.features,
            isActive: true,
            lastSyncedAt: new Date()
          });
          
          await newTool.save();
          created++;
        }
      } catch (error) {
        console.error(`Error processing tool ${toolData.id}:`, error);
        errors.push({ id: toolData.id, error: error.message });
      }
    }
    
    // Deactivate tools that are no longer in the file
    const fileToolIds = toolsFromFile.map(t => t.id);
    const deactivated = await Tool.updateMany(
      { id: { $nin: fileToolIds } },
      { isActive: false }
    );
    
    console.log(`Tools sync completed: ${created} created, ${updated} updated, ${deactivated.modifiedCount} deactivated`);
    
    res.json({
      success: true,
      message: 'Tools synced successfully',
      data: {
        total: toolsFromFile.length,
        created,
        updated,
        deactivated: deactivated.modifiedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Sync tools error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync tools: ' + error.message
    });
  }
};

// Get all tools (for admin panel)
exports.getAllTools = async (req, res) => {
  try {
    await connectDB();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const category = req.query.category;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'name'; // Default sort by name
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1; // Default ascending
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    if (category && category !== 'all') {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { keywords: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort object
    let sortObj = {};
    switch (sortBy) {
      case 'views':
        sortObj = { viewCount: sortOrder };
        break;
      case 'name':
        sortObj = { name: sortOrder };
        break;
      case 'category':
        sortObj = { category: sortOrder, name: 1 };
        break;
      case 'created':
        sortObj = { createdAt: sortOrder };
        break;
      case 'updated':
        sortObj = { updatedAt: sortOrder };
        break;
      default:
        sortObj = { name: sortOrder };
    }
    
    const total = await Tool.countDocuments(query);
    const tools = await Tool.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .select('-__v');
    
    // Get unique categories
    const categories = await Tool.distinct('category');
    
    res.json({
      success: true,
      data: {
        tools,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        categories
      }
    });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tools'
    });
  }
};

// Increment view count for a tool
exports.incrementViewCount = async (req, res) => {
  try {
    await connectDB();
    
    const { toolId } = req.body;
    
    if (!toolId) {
      return res.status(400).json({
        success: false,
        error: 'Tool ID is required'
      });
    }
    
    const tool = await Tool.findOneAndUpdate(
      { id: toolId },
      { $inc: { viewCount: 1 } },
      { new: true }
    );
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }
    
    // Track analytics (non-blocking)
    const Analytics = require('../models/Analytics');
    Analytics.incrementView(
      'tool',
      toolId,
      tool.path || tool.href || `/${toolId}`,
      tool.name
    ).catch(err => {
      console.error('Error tracking analytics:', err);
    });
    
    res.json({
      success: true,
      data: {
        viewCount: tool.viewCount
      }
    });
  } catch (error) {
    console.error('Increment view count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment view count'
    });
  }
};

// Get tool by ID
exports.getToolById = async (req, res) => {
  try {
    await connectDB();
    
    const tool = await Tool.findOne({ id: req.params.id });
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: 'Tool not found'
      });
    }
    
    res.json({
      success: true,
      data: tool
    });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tool'
    });
  }
};
