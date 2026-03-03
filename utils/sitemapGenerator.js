const Blog = require('../models/Blog');

/**
 * Generate XML sitemap for blogs
 * @returns {Promise<string>} - XML sitemap string
 */
const generateSitemap = async () => {
  try {
    // Get ONLY published blogs (exclude drafts and scheduled)
    const blogs = await Blog.find({
      status: 'published',
      publishDate: { $lte: new Date() },
      noIndex: false // Exclude noIndex blogs from sitemap
    })
      .select('slug updatedAt publishDate')
      .sort({ publishDate: -1 })
      .lean();

    const baseUrl = process.env.FRONTEND_URL || 'https://fyntools.com';
    const currentDate = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add blog listing page
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/blog</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';

    // Add individual blog posts (only published)
    blogs.forEach(blog => {
      const lastmod = blog.updatedAt 
        ? new Date(blog.updatedAt).toISOString().split('T')[0]
        : (blog.publishDate ? new Date(blog.publishDate).toISOString().split('T')[0] : currentDate);

      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/blog/${blog.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    });

    xml += '</urlset>';

    return xml;
  } catch (error) {
    console.error('Sitemap generation error:', error);
    throw error;
  }
};

/**
 * Generate robots.txt content
 * @returns {string} - robots.txt content
 */
const generateRobotsTxt = () => {
  const baseUrl = process.env.FRONTEND_URL || 'https://fyntools.com';
  
  let robots = 'User-agent: *\n';
  robots += 'Allow: /\n';
  robots += `Sitemap: ${baseUrl}/sitemap.xml\n`;
  
  return robots;
};

module.exports = {
  generateSitemap,
  generateRobotsTxt
};
