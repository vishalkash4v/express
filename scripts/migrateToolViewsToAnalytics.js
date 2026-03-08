/**
 * Migration script to convert existing tool viewCount data to Analytics records
 * Run this once to backfill analytics data from existing tool views
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { connectDB } = require('../utils/db');
const Tool = require('../models/Tool');
const Analytics = require('../models/Analytics');

async function migrateToolViews() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    
    console.log('Fetching tools with view counts...');
    const tools = await Tool.find({ viewCount: { $gt: 0 } }).select('id name path href url viewCount');
    
    console.log(`Found ${tools.length} tools with views to migrate`);
    
    let migrated = 0;
    let errors = 0;
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const tool of tools) {
      try {
        // Create analytics record for today with the total view count
        // This distributes the views to today (we can't know the exact historical dates)
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        
        // Calculate week number
        const week = getWeekNumber(today);
        
        // Check if record exists
        let record = await Analytics.findOne({
          pageType: 'tool',
          pageId: tool.id,
          date: today
        });
        
        if (record) {
          // Update existing record
          record.views = tool.viewCount;
          record.uniqueViews = Math.floor(tool.viewCount * 0.7); // Estimate unique views
          await record.save();
        } else {
          // Create new record
          record = new Analytics({
            pageType: 'tool',
            pageId: tool.id,
            pagePath: tool.path || tool.href || `/${tool.id}`,
            pageTitle: tool.name,
            date: today,
            year,
            month,
            day,
            week,
            views: tool.viewCount,
            uniqueViews: Math.floor(tool.viewCount * 0.7) // Estimate unique views
          });
          await record.save();
        }
        
        migrated++;
        console.log(`Migrated: ${tool.name} (${tool.viewCount} views)`);
      } catch (error) {
        errors++;
        console.error(`Error migrating ${tool.name}:`, error.message);
      }
    }
    
    console.log(`\nMigration complete!`);
    console.log(`Migrated: ${migrated} tools`);
    console.log(`Errors: ${errors} tools`);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Helper function to calculate ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Run migration
if (require.main === module) {
  migrateToolViews();
}

module.exports = { migrateToolViews };
