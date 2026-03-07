const Tool = require('../models/Tool');
const { connectDB } = require('../utils/db');
const fs = require('fs');
const path = require('path');

// Read toolsData.ts file and extract tools
function extractToolsFromFile() {
  try {
    const filePath = path.join(__dirname, '../../Frontend/src/data/toolsData.ts');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Extract the allTools array content
    const arrayMatch = fileContent.match(/export const allTools: Tool\[\] = \[([\s\S]*?)\];/);
    if (!arrayMatch) {
      throw new Error('Could not find allTools array in toolsData.ts');
    }
    
    const toolsArrayContent = arrayMatch[1];
    
    // Parse each tool object - more robust parsing
    const tools = [];
    
    // Find all tool objects (non-commented)
    // Match pattern: { ... } where ... doesn't contain unescaped closing braces
    let braceCount = 0;
    let currentTool = '';
    let inString = false;
    let stringChar = '';
    let inComment = false;
    
    for (let i = 0; i < toolsArrayContent.length; i++) {
      const char = toolsArrayContent[i];
      const nextChar = toolsArrayContent[i + 1];
      
      // Handle comments
      if (!inString && char === '/' && nextChar === '/') {
        inComment = true;
        continue;
      }
      if (inComment && char === '\n') {
        inComment = false;
        continue;
      }
      if (inComment) continue;
      
      // Handle strings (both single and double quotes)
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        currentTool += char;
        continue;
      }
      if (inString && char === stringChar && toolsArrayContent[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
        currentTool += char;
        continue;
      }
      
      if (inString) {
        currentTool += char;
        continue;
      }
      
      // Track braces
      if (char === '{') {
        if (braceCount === 0) {
          currentTool = '{';
        } else {
          currentTool += char;
        }
        braceCount++;
      } else if (char === '}') {
        currentTool += char;
        braceCount--;
        
        // Complete tool object found
        if (braceCount === 0) {
          // Extract fields using regex (handle multiline)
          const idMatch = currentTool.match(/id:\s*['"]([^'"]+)['"]/);
          const nameMatch = currentTool.match(/name:\s*['"]([^'"]+)['"]/);
          const categoryMatch = currentTool.match(/category:\s*['"]([^'"]+)['"]/);
          const descMatch = currentTool.match(/description:\s*['"]([^'"]+)['"]/);
          const keywordsMatch = currentTool.match(/keywords:\s*['"]([^'"]+)['"]/);
          const pathMatch = currentTool.match(/path:\s*['"]([^'"]+)['"]/);
          const hrefMatch = currentTool.match(/href:\s*['"]([^'"]*)['"]/);
          const urlMatch = currentTool.match(/url:\s*['"]([^'"]+)['"]/);
          const featuresMatch = currentTool.match(/features:\s*['"]([^'"]+)['"]/);
          
          if (idMatch && nameMatch && categoryMatch && descMatch && keywordsMatch && pathMatch && urlMatch && featuresMatch) {
            tools.push({
              id: idMatch[1],
              name: nameMatch[1],
              category: categoryMatch[1],
              description: descMatch[1],
              keywords: keywordsMatch[1],
              path: pathMatch[1],
              href: hrefMatch && hrefMatch[1] ? hrefMatch[1] : pathMatch[1],
              url: urlMatch[1],
              features: featuresMatch[1]
            });
          }
          
          currentTool = '';
        }
      } else {
        if (braceCount > 0) {
          currentTool += char;
        }
      }
    }
    
    return tools;
  } catch (error) {
    console.error('Error extracting tools from file:', error);
    throw error;
  }
}

// Sync tools from toolsData.ts to database
exports.syncTools = async (req, res) => {
  try {
    await connectDB();
    
    console.log('Starting tools sync from toolsData.ts...');
    
    // Extract tools from file
    const toolsFromFile = extractToolsFromFile();
    
    if (!toolsFromFile || toolsFromFile.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tools found in toolsData.ts file'
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
    
    const total = await Tool.countDocuments(query);
    const tools = await Tool.find(query)
      .sort({ category: 1, name: 1 })
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
