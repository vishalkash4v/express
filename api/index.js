// Vercel serverless entry point
const app = require('../app');

// For Vercel, we need to export the app directly
// Vercel's @vercel/node automatically handles Express apps
module.exports = app;
