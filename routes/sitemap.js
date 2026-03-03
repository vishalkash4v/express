const express = require('express');
const router = express.Router();
const { generateSitemap, generateRobotsTxt } = require('../utils/sitemapGenerator');

// Sitemap route
router.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await generateSitemap();
    res.set('Content-Type', 'text/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Robots.txt route
router.get('/robots.txt', (req, res) => {
  try {
    const robots = generateRobotsTxt();
    res.set('Content-Type', 'text/plain');
    res.send(robots);
  } catch (error) {
    console.error('Robots.txt error:', error);
    res.status(500).send('Error generating robots.txt');
  }
});

module.exports = router;
