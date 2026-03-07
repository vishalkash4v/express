const Blog = require('../models/Blog');
const Tool = require('../models/Tool');
const { sanitizeHTML, extractText, extractMetaTags } = require('../utils/htmlSanitizer');
const { generateSlug, generateUniqueSlug } = require('../utils/slugGenerator');
const { generateSitemap } = require('../utils/sitemapGenerator');
const { connectDB } = require('../utils/db');
const sharp = require('sharp');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).single('image');

// Temporary mode: serve blog data from in-memory JSON instead of DB.
// Set to false when switching back to Mongo-backed blogs.
const USE_DUMMY_BLOGS = false; // Changed to false to use real DB

/**
 * Ensure semantic HTML structure for SEO
 */
function ensureSemanticStructure(html) {
  if (!html || typeof html !== 'string') return '<div class="blog-content"><p>No content</p></div>';
  
  // Remove empty divs and ensure proper structure
  let structured = html.trim();
  
  // If content doesn't start with a semantic tag, wrap it
  if (!structured.match(/^<(h[1-6]|p|div|article|section|ul|ol|blockquote)/i)) {
    // Check if it has any HTML tags at all
    if (!structured.includes('<')) {
      // Plain text - wrap in paragraphs
      const paragraphs = structured.split(/\n\n+/).filter(p => p.trim());
      structured = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
    }
    structured = `<div class="blog-content">${structured}</div>`;
  }
  
  // Ensure headings are properly structured (H1 should be first if present)
  // Convert multiple H1s to H2s (only one H1 per page for SEO)
  let h1Count = 0;
  structured = structured.replace(/<h1[^>]*>/gi, (match) => {
    h1Count++;
    if (h1Count > 1) {
      return '<h2>';
    }
    return match;
  });
  
  // Ensure images have alt attributes, loading="lazy", and responsive styles for SEO and performance
  structured = structured.replace(/<img([^>]*)>/gi, (match, attrs) => {
    let newAttrs = attrs;
    if (!newAttrs.includes('alt=')) {
      newAttrs += ' alt=""';
    }
    if (!newAttrs.includes('loading=')) {
      newAttrs += ' loading="lazy"';
    }
    if (!newAttrs.includes('style=') && !newAttrs.includes('width=')) {
      newAttrs += ' style="max-width: 100%; height: auto;"';
    }
    return `<img${newAttrs}>`;
  });
  
  // Ensure links have proper attributes for SEO and security
  structured = structured.replace(/<a([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('href=')) {
      return match; // Skip invalid links
    }
    let newAttrs = attrs;
    // External links
    if (attrs.includes('http') && !attrs.includes('fyntools.com')) {
      if (!attrs.includes('target=')) {
        newAttrs += ' target="_blank"';
      }
      if (!attrs.includes('rel=')) {
        newAttrs += ' rel="noopener noreferrer"';
      }
    }
    // Internal links - ensure they're crawlable
    if (attrs.includes('fyntools.com') || attrs.includes('href="/')) {
      // Remove nofollow from internal links
      newAttrs = newAttrs.replace(/rel=["'][^"']*nofollow[^"']*["']/gi, '');
    }
    return `<a${newAttrs}>`;
  });
  
  // Wrap all tables in table-wrapper for mobile responsiveness (2026 Best Practice)
  structured = structured.replace(/<table([^>]*)>([\s\S]*?)<\/table>/gi, (match, tableAttrs, tableContent) => {
    // Check if already wrapped
    if (match.includes('table-wrapper')) {
      return match;
    }
    
    // Always wrap tables for consistent mobile scrolling and styling
    return `<div class="table-wrapper"><table${tableAttrs}>${tableContent}</table></div>`;
  });
  
  return structured;
}

const nowIso = new Date().toISOString();
let dummyBlogs = [
  {
    _id: 'dummy-1',
    title: 'Setting Up a Node.js Project: A Step-by-Step Guide',
    slug: 'setting-up-nodejs-project-step-by-step-guide',
    content: '<div class="blog-content"><p>Learn how to set up a Node.js + Express project from scratch with practical steps.</p></div>',
    excerpt: 'Learn how to set up a Node.js project from scratch with Express. This practical guide covers installation, initialization, and running your first server.',
    featuredImage: '',
    category: 'Technology',
    tags: ['Node.js', 'Express', 'JavaScript', 'Backend Development'],
    metaTitle: 'Setting Up a Node.js Project: A Step-by-Step Guide | FYN Tools',
    metaDescription: 'Complete guide to setting up a Node.js project with Express.',
    focusKeyword: 'node.js setup guide',
    canonicalUrl: 'https://fyntools.com/blog/setting-up-nodejs-project-step-by-step-guide',
    ogTitle: 'Setting Up a Node.js Project: A Step-by-Step Guide',
    ogDescription: 'Step-by-step Node.js setup with Express.',
    ogImage: '',
    twitterTitle: 'Node.js Project Setup Guide',
    twitterDescription: 'Set up a Node.js project quickly with this practical guide.',
    twitterImage: '',
    noIndex: false,
    noFollow: false,
    status: 'published',
    publishDate: '2024-07-08T00:00:00.000Z',
    scheduledDate: null,
    isFeatured: true,
    viewCount: 1200,
    readingTime: 7,
    author: { name: 'FYN Tools', email: '' },
    createdAt: '2024-07-08T00:00:00.000Z',
    updatedAt: nowIso
  },
  {
    _id: 'dummy-2',
    title: 'Best Free URL Shorteners 2024: Complete Comparison & Reviews',
    slug: 'best-free-url-shorteners-2024-complete-comparison-reviews',
    content: '<div class="blog-content"><p>Compare top URL shorteners and see why FYN Tools URL Shortener is a strong free option.</p></div>',
    excerpt: 'A complete comparison of free URL shorteners including features, limits, analytics, and practical use cases for marketers and creators.',
    featuredImage: '',
    category: 'Tools',
    tags: ['URL Shortener', 'Marketing Tools', 'Comparison'],
    metaTitle: 'Best Free URL Shorteners 2024: Top Tools Compared | FYN Tools',
    metaDescription: 'Compare free URL shorteners and choose the best one for your workflow.',
    focusKeyword: 'best free url shortener',
    canonicalUrl: 'https://fyntools.com/blog/best-free-url-shorteners-2024-complete-comparison-reviews',
    ogTitle: 'Best Free URL Shorteners 2024',
    ogDescription: 'Feature comparison and reviews of popular URL shorteners.',
    ogImage: '',
    twitterTitle: 'Best Free URL Shorteners 2024',
    twitterDescription: 'Top free URL shorteners compared.',
    twitterImage: '',
    noIndex: false,
    noFollow: false,
    status: 'published',
    publishDate: '2024-12-15T00:00:00.000Z',
    scheduledDate: null,
    isFeatured: true,
    viewCount: 2100,
    readingTime: 9,
    author: { name: 'FYN Tools', email: '' },
    createdAt: '2024-12-15T00:00:00.000Z',
    updatedAt: nowIso
  },
  {
    _id: 'dummy-3',
    title: 'Best AI Rewriter Tool in 2026: Why FYN Tools Is the Smart Choice',
    slug: 'best-ai-rewriter-tool-fyntools',
    content: '<div class="blog-content"><p>Discover how FYN Tools AI Text Rewriter helps improve clarity, tone, and readability with multiple styles and creativity control.</p><p><a href="https://fyntools.com/ai-text-rewriter">Try the AI Text Rewriter</a></p></div>',
    excerpt: 'Looking for the best AI rewriter tool? See why FYN Tools AI Text Rewriter stands out with writing styles, creativity control, and practical workflow value.',
    featuredImage: '',
    category: 'Tools',
    tags: ['AI Rewriter', 'Paraphrasing Tool', 'SEO Writing', 'Text Tools'],
    metaTitle: 'Best AI Rewriter Tool in 2026 | FYN Tools AI Text Rewriter',
    metaDescription: 'Discover why FYN Tools AI Text Rewriter is a top pick for paraphrasing and content improvement.',
    focusKeyword: 'best ai rewriter tool',
    canonicalUrl: 'https://fyntools.com/blog/best-ai-rewriter-tool-fyntools',
    ogTitle: 'Best AI Rewriter Tool in 2026: Why FYN Tools Is the Smart Choice',
    ogDescription: 'A practical guide to choosing a high-quality AI rewriter.',
    ogImage: '',
    twitterTitle: 'Best AI Rewriter Tool in 2026 | FYN Tools',
    twitterDescription: 'Why FYN Tools AI Text Rewriter is a top option right now.',
    twitterImage: '',
    noIndex: false,
    noFollow: false,
    status: 'published',
    publishDate: '2026-03-04T00:00:00.000Z',
    scheduledDate: null,
    isFeatured: true,
    viewCount: 380,
    readingTime: 6,
    author: { name: 'FYN Tools', email: '' },
    createdAt: '2026-03-04T00:00:00.000Z',
    updatedAt: nowIso
  }
];

const matchesSearch = (blog, search) => {
  if (!search) return true;
  const q = String(search).toLowerCase();
  return (
    blog.title.toLowerCase().includes(q) ||
    (blog.excerpt || '').toLowerCase().includes(q) ||
    (blog.tags || []).some(tag => tag.toLowerCase().includes(q))
  );
};

const paginate = (items, page = 1, limit = 10) => {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.max(parseInt(limit, 10) || 10, 1);
  const start = (p - 1) * l;
  return {
    data: items.slice(start, start + l),
    pagination: {
      page: p,
      limit: l,
      total: items.length,
      pages: Math.ceil(items.length / l) || 1
    }
  };
};

/**
 * Get all blogs with filters (Admin only - can see all statuses)
 */
exports.getAllBlogs = async (req, res) => {
  try {
    // Ensure DB connection
    await connectDB();
    
    if (USE_DUMMY_BLOGS) {
      const { status, category, search, page = 1, limit = 10 } = req.query;
      let blogs = [...dummyBlogs];
      if (status) blogs = blogs.filter(b => b.status === status);
      if (category) blogs = blogs.filter(b => b.category === category);
      blogs = blogs.filter(b => matchesSearch(b, search));
      blogs.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
      const { data, pagination } = paginate(blogs, page, limit);
      return res.json({ success: true, data, pagination });
    }

    const {
      status,
      category,
      search,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by status (admin can see all)
    if (status) {
      query.status = status;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search in title, content, excerpt
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const blogs = await Blog.find(query)
      .select('-content') // Exclude full content for list view
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name email')
      .lean();

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      data: blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get published blogs only (Public route)
 */
exports.getPublishedBlogs = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const { category, search, page = 1, limit = 10 } = req.query;
      const now = new Date();
      let blogs = dummyBlogs.filter(b => b.status === 'published' && !b.noIndex && new Date(b.publishDate) <= now);
      if (category) blogs = blogs.filter(b => b.category === category);
      blogs = blogs.filter(b => matchesSearch(b, search));
      blogs.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
      const { data, pagination } = paginate(blogs, page, limit);
      return res.json({ success: true, data, pagination });
    }

    const {
      category,
      search,
      page = 1,
      limit = 10,
      sortBy = 'publishDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {
      status: 'published',
      publishDate: { $lte: new Date() },
      noIndex: false // Exclude noIndex blogs from public listing
    };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Search in title, content, excerpt
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const blogs = await Blog.find(query)
      .select('-content') // Exclude full content for list view
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'name email')
      .lean();

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      data: blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get published blogs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get single blog by slug (Public - only published blogs)
 */
exports.getBlogBySlug = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const { slug } = req.params;
      const now = new Date();
      const blog = dummyBlogs.find(b => b.slug === slug && b.status === 'published' && new Date(b.publishDate) <= now);
      if (!blog) {
        return res.status(404).json({ success: false, error: 'Blog not found' });
      }
      return res.json({ success: true, data: blog });
    }

    const { slug } = req.params;

    const blog = await Blog.findOne({ 
      slug, 
      status: 'published',
      publishDate: { $lte: new Date() }
    })
      .populate('author', 'name email')
      .lean();

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // Increment view count (non-blocking)
    Blog.findByIdAndUpdate(blog._id, { $inc: { viewCount: 1 } }).catch(err => {
      console.error('Error incrementing view count:', err);
    });

    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get single blog by ID (for admin)
 */
exports.getBlogById = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const { id } = req.params;
      const blog = dummyBlogs.find(b => b._id === id);
      if (!blog) {
        return res.status(404).json({ success: false, error: 'Blog not found' });
      }
      return res.json({ success: true, data: blog });
    }

    const { id } = req.params;

    const blog = await Blog.findById(id)
      .populate('author', 'name email')
      .lean();

    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Create new blog
 */
exports.createBlog = async (req, res) => {
  try {
    // Ensure DB connection
    try {
      await connectDB();
    } catch (dbError) {
      console.error('DB connection error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed. Please try again.'
      });
    }
    
    if (USE_DUMMY_BLOGS) {
      const body = req.body || {};
      const title = body.title || 'Untitled';
      const baseSlug = generateSlug(title || 'untitled');
      const slug = `${baseSlug}-${Date.now()}`;
      const created = {
        _id: `dummy-${Date.now()}`,
        title,
        slug,
        content: body.content || '<div class="blog-content"><p>Draft content.</p></div>',
        excerpt: body.excerpt || 'Draft excerpt',
        featuredImage: body.featuredImage || '',
        category: body.category || 'General',
        tags: Array.isArray(body.tags) ? body.tags : [],
        metaTitle: body.metaTitle || title,
        metaDescription: body.metaDescription || '',
        focusKeyword: body.focusKeyword || '',
        canonicalUrl: body.canonicalUrl || `https://fyntools.com/blog/${slug}`,
        ogTitle: body.ogTitle || title,
        ogDescription: body.ogDescription || '',
        ogImage: body.ogImage || '',
        twitterTitle: body.twitterTitle || title,
        twitterDescription: body.twitterDescription || '',
        twitterImage: body.twitterImage || '',
        noIndex: !!body.noIndex,
        noFollow: !!body.noFollow,
        status: body.status || 'draft',
        publishDate: body.publishDate || new Date().toISOString(),
        scheduledDate: body.scheduledDate || null,
        isFeatured: !!body.isFeatured,
        viewCount: 0,
        readingTime: Math.max(1, Math.ceil(String(body.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length / 200)),
        author: { name: 'Admin', email: '' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      dummyBlogs.unshift(created);
      return res.status(201).json({ success: true, data: created, message: 'Blog created successfully (dummy mode)' });
    }

    const {
      title,
      content,
      excerpt,
      category,
      tags,
      metaTitle,
      metaDescription,
      focusKeyword,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      twitterTitle,
      twitterDescription,
      twitterImage,
      noIndex,
      noFollow,
      status,
      publishDate,
      scheduledDate,
      isFeatured,
      creationMode // 'html' or 'builder'
    } = req.body;

    // Sanitize and structure HTML content for SEO
    let sanitizedContent = sanitizeHTML(content);
    
    // Ensure proper semantic HTML structure
    sanitizedContent = ensureSemanticStructure(sanitizedContent);

    // Extract meta tags if HTML upload mode
    let extractedMeta = {};
    if (creationMode === 'html') {
      extractedMeta = extractMetaTags(content);
    }

    // Generate slug
    const baseSlug = generateSlug(title || extractedMeta.title || 'untitled');
    const slug = await generateUniqueSlug(
      baseSlug,
      async (slug, excludeId) => {
        const exists = await Blog.findOne({ slug, _id: { $ne: excludeId } });
        return !!exists;
      }
    );

    // Generate excerpt if not provided (first 160 words)
    let finalExcerpt = excerpt;
    if (!finalExcerpt && sanitizedContent) {
      const text = extractText(sanitizedContent);
      const words = text.split(/\s+/).filter(w => w.length > 0);
      finalExcerpt = words.slice(0, 160).join(' ');
      if (finalExcerpt.length < text.length) {
        finalExcerpt += '...';
      }
      // Limit to 300 characters max
      if (finalExcerpt.length > 300) {
        finalExcerpt = finalExcerpt.substring(0, 297) + '...';
      }
    }

    // Calculate reading time
    const text = extractText(sanitizedContent);
    const wordCount = text.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    // Determine publish date
    let finalPublishDate = publishDate ? new Date(publishDate) : new Date();
    let finalStatus = status || 'draft';
    
    if (scheduledDate) {
      const scheduled = new Date(scheduledDate);
      const now = new Date();
      
      // Validate scheduled date is in the future
      if (scheduled <= now) {
        return res.status(400).json({
          success: false,
          error: 'Scheduled date must be in the future'
        });
      }
      
      finalStatus = 'scheduled';
      finalPublishDate = scheduled;
    } else if (status === 'published') {
      finalPublishDate = new Date();
    }

    const blogData = {
      title: title || extractedMeta.title || 'Untitled',
      slug,
      content: sanitizedContent,
      excerpt: finalExcerpt,
      category: category || 'General',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      metaTitle: metaTitle || extractedMeta.title || title || '',
      metaDescription: metaDescription || extractedMeta.description || finalExcerpt.substring(0, 160),
      focusKeyword: focusKeyword || '',
      canonicalUrl: canonicalUrl || '',
      ogTitle: ogTitle || metaTitle || title || '',
      ogDescription: ogDescription || metaDescription || finalExcerpt.substring(0, 160),
      ogImage: ogImage || '',
      twitterTitle: twitterTitle || ogTitle || metaTitle || title || '',
      twitterDescription: twitterDescription || ogDescription || metaDescription || finalExcerpt.substring(0, 200),
      twitterImage: twitterImage || ogImage || '',
      noIndex: noIndex === true || noIndex === 'true',
      noFollow: noFollow === true || noFollow === 'true',
      status: finalStatus,
      publishDate: finalPublishDate,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      isFeatured: isFeatured === true || isFeatured === 'true',
      readingTime,
      author: req.user?.id || null
    };

    const blog = new Blog(blogData);
    await blog.save();

    // Update sitemap asynchronously (don't wait)
    setImmediate(() => {
      generateSitemap().catch(err => {
        console.error('Error updating sitemap:', err);
      });
    });

    res.status(201).json({
      success: true,
      data: blog,
      message: 'Blog created successfully'
    });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update blog
 */
exports.updateBlog = async (req, res) => {
  try {
    // Ensure DB connection
    await connectDB();
    
    if (USE_DUMMY_BLOGS) {
      const { id } = req.params;
      const idx = dummyBlogs.findIndex(b => b._id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Blog not found' });
      }
      const patch = { ...req.body };
      if (patch.title && !patch.slug) {
        patch.slug = generateSlug(patch.title);
      }
      patch.updatedAt = new Date().toISOString();
      dummyBlogs[idx] = { ...dummyBlogs[idx], ...patch };
      return res.json({ success: true, data: dummyBlogs[idx], message: 'Blog updated successfully (dummy mode)' });
    }

    const { id } = req.params;
    const updateData = req.body;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // Sanitize content if provided
    if (updateData.content) {
      updateData.content = sanitizeHTML(updateData.content);
      updateData.content = ensureSemanticStructure(updateData.content);
      
      // Recalculate reading time
      const text = extractText(updateData.content);
      const wordCount = text.split(/\s+/).length;
      updateData.readingTime = Math.ceil(wordCount / 200);

      // Regenerate excerpt if not provided (first 160 words)
      if (!updateData.excerpt) {
        const words = text.split(/\s+/).filter(w => w.length > 0);
        updateData.excerpt = words.slice(0, 160).join(' ');
        if (updateData.excerpt.length < text.length) {
          updateData.excerpt += '...';
        }
        // Limit to 300 characters max
        if (updateData.excerpt.length > 300) {
          updateData.excerpt = updateData.excerpt.substring(0, 297) + '...';
        }
      }
    }

    // Handle slug update
    if (updateData.title && updateData.title !== blog.title) {
      const baseSlug = generateSlug(updateData.title);
      updateData.slug = await generateUniqueSlug(
        baseSlug,
        async (slug, excludeId) => {
          const exists = await Blog.findOne({ slug, _id: { $ne: excludeId } });
          return !!exists;
        },
        id
      );
    }

    // Handle status and publish date
    if (updateData.status === 'published' && blog.status !== 'published') {
      updateData.publishDate = new Date();
      updateData.scheduledDate = null;
    }

    if (updateData.scheduledDate) {
      const scheduledDate = new Date(updateData.scheduledDate);
      const now = new Date();
      
      // Validate scheduled date is in the future
      if (scheduledDate <= now) {
        return res.status(400).json({
          success: false,
          error: 'Scheduled date must be in the future'
        });
      }
      
      updateData.status = 'scheduled';
      updateData.scheduledDate = scheduledDate;
    }

    // Convert boolean strings
    if (updateData.noIndex !== undefined) {
      updateData.noIndex = updateData.noIndex === true || updateData.noIndex === 'true';
    }
    if (updateData.noFollow !== undefined) {
      updateData.noFollow = updateData.noFollow === true || updateData.noFollow === 'true';
    }
    if (updateData.isFeatured !== undefined) {
      updateData.isFeatured = updateData.isFeatured === true || updateData.isFeatured === 'true';
    }

    // Handle tags
    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(t => t.trim());
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Update sitemap asynchronously if status changed to published (don't wait)
    if (updateData.status === 'published' || (blog.status !== 'published' && updatedBlog.status === 'published')) {
      setImmediate(() => {
        generateSitemap().catch(err => {
          console.error('Error updating sitemap:', err);
        });
      });
    }

    res.json({
      success: true,
      data: updatedBlog,
      message: 'Blog updated successfully'
    });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete blog
 */
exports.deleteBlog = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const { id } = req.params;
      const before = dummyBlogs.length;
      dummyBlogs = dummyBlogs.filter(b => b._id !== id);
      if (dummyBlogs.length === before) {
        return res.status(404).json({ success: false, error: 'Blog not found' });
      }
      return res.json({ success: true, message: 'Blog deleted successfully (dummy mode)' });
    }

    const { id } = req.params;

    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // Delete featured image if exists
    if (blog.featuredImage) {
      try {
        await fs.unlink(path.join(__dirname, '../public/uploads/blogs', blog.featuredImage));
      } catch (err) {
        console.error('Error deleting image:', err);
      }
    }

    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Upload featured image
 */
exports.uploadFeaturedImage = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    try {
      const uploadDir = path.join(__dirname, '../public/uploads/blogs');
      await fs.mkdir(uploadDir, { recursive: true });

      const filename = `blog-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
      const filepath = path.join(uploadDir, filename);

      // Optimize and convert to WebP
      await sharp(req.file.buffer)
        .resize(1200, 630, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filepath);

      const imageUrl = `/uploads/blogs/${filename}`;

      res.json({
        success: true,
        data: { url: imageUrl, filename },
        message: 'Image uploaded successfully'
      });
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
};

/**
 * Get categories
 */
exports.getCategories = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const categories = [...new Set(dummyBlogs.filter(b => b.status === 'published').map(b => b.category))];
      return res.json({ success: true, data: categories });
    }

    const categories = await Blog.distinct('category', { status: 'published' });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get tags
 */
exports.getTags = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const tags = [...new Set(dummyBlogs.filter(b => b.status === 'published').flatMap(b => b.tags || []))];
      return res.json({ success: true, data: tags });
    }

    const blogs = await Blog.find({ status: 'published' }).select('tags');
    const allTags = blogs.flatMap(blog => blog.tags);
    const uniqueTags = [...new Set(allTags)];
    res.json({ success: true, data: uniqueTags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get related blogs
 */
exports.getRelatedBlogs = async (req, res) => {
  try {
    if (USE_DUMMY_BLOGS) {
      const { slug } = req.params;
      const limit = parseInt(req.query.limit, 10) || 5;
      const blog = dummyBlogs.find(b => b.slug === slug && b.status === 'published');
      if (!blog) {
        return res.status(404).json({ success: false, error: 'Blog not found' });
      }
      const related = dummyBlogs
        .filter(b => b._id !== blog._id && b.status === 'published' && (b.category === blog.category || (b.tags || []).some(t => (blog.tags || []).includes(t))))
        .slice(0, limit)
        .map(b => ({
          _id: b._id,
          title: b.title,
          slug: b.slug,
          excerpt: b.excerpt,
          featuredImage: b.featuredImage,
          publishDate: b.publishDate,
          readingTime: b.readingTime
        }));
      return res.json({ success: true, data: related });
    }

    const { slug } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const blog = await Blog.findOne({ 
      slug,
      status: 'published',
      publishDate: { $lte: new Date() }
    });
    
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    const relatedBlogs = await Blog.find({
      _id: { $ne: blog._id },
      status: 'published',
      publishDate: { $lte: new Date() },
      noIndex: false,
      $or: [
        { category: blog.category },
        { tags: { $in: blog.tags } }
      ]
    })
      .select('title slug excerpt featuredImage publishDate readingTime category tags')
      .limit(limit)
      .sort({ publishDate: -1 })
      .lean();

    res.json({ success: true, data: relatedBlogs });
  } catch (error) {
    console.error('Get related blogs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Generate blog using AI (Gemini)
 */
exports.generateAIBlog = async (req, res) => {
  try {
    // Ensure DB connection first
    try {
      await connectDB();
    } catch (dbError) {
      console.error('DB connection error in generateAIBlog:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed. Please try again.'
      });
    }

    const {
      topic,
      blogType,
      category,
      targetKeywords,
      includeInternalLinks = true,
      includeExternalLinks = true,
      wordCount = 1500
    } = req.body;

    if (!topic || !blogType) {
      return res.status(400).json({
        success: false,
        error: 'Topic and blog type are required'
      });
    }

    // Get Gemini API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key not configured'
      });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    // Check if topic is about a specific tool
    let toolInfo = null;
    const topicLower = topic.toLowerCase().trim();
    
    // Fetch tools from database
    await connectDB();
    const toolsFromDB = await Tool.find({ isActive: true }).select('id name category description keywords url features');
    
    // Convert to format expected by blog generation
    const toolsDatabase = toolsFromDB.map(tool => ({
      name: tool.name,
      id: tool.id,
      url: tool.url,
      description: tool.description,
      category: tool.category,
      keywords: tool.keywords,
      features: tool.features
    }));

    // Enhanced matching - check name, id, keywords, and description
    for (const tool of toolsDatabase) {
      const nameMatch = topicLower.includes(tool.name.toLowerCase());
      const idMatch = topicLower.includes(tool.id.replace(/-/g, ' '));
      const keywordMatch = tool.keywords.split(', ').some(kw => topicLower.includes(kw.toLowerCase()));
      const descMatch = tool.description.toLowerCase().split(' ').some(word => topicLower.includes(word));
      
      if (nameMatch || idMatch || keywordMatch || descMatch) {
        toolInfo = tool;
        break;
      }
    }

    // Get tools for internal linking
    const toolsForLinking = toolsDatabase;

    // Build tool-specific context if tool is found
    let toolContext = '';
    if (toolInfo) {
      toolContext = `\n\nCRITICAL - TOOL-SPECIFIC BLOG REQUIREMENTS:
You are writing about "${toolInfo.name}" - a REAL, ACTIVE tool available at ${toolInfo.url}

Tool Information (USE THIS EXACT DATA):
- Tool Name: ${toolInfo.name}
- Category: ${toolInfo.category}
- Description: ${toolInfo.description}
- Key Features: ${toolInfo.features}
- Tool URL: ${toolInfo.url}

REQUIREMENTS FOR TOOL BLOG:
1. Analyze the tool's features thoroughly - mention specific features from the list above
2. Explain HOW the tool works - step-by-step usage instructions
3. Describe WHAT problems it solves - real-world scenarios
4. Explain WHO benefits from it - target audience
5. Include practical examples - show actual use cases
6. Compare with alternatives if relevant - but highlight why this tool is better
7. Include screenshots/features descriptions - be specific about what the tool does
8. Write as if you've personally tested and used the tool
9. Be honest about limitations if any
10. Include a call-to-action to try the tool at ${toolInfo.url}

Make the blog comprehensive, practical, and feature-focused. Readers should understand exactly what the tool does and how to use it.`;

      // Update topic to be more specific
      topic = toolInfo.name;
    }

    // Blog type templates with human-readable, simple writing style
    const blogTypePrompts = {
      'how-to': `Write a simple, easy-to-understand "How to" guide about ${topic}. Use everyday language that anyone can understand. Write like a helpful friend explaining something, not like a formal manual.`,
      'best': `Write a friendly article about "Best ${topic}" - compare options in a conversational way, like you're recommending to a friend. Be honest about pros and cons.`,
      'top': `Write a "Top ${topic}" article - create a ranked list but explain each item in simple terms. Use casual language and real examples.`,
      'guide': `Write a complete guide about ${topic} - explain everything from basics to advanced, but keep it simple and easy to follow. Use plain English.`,
      'tutorial': `Write a tutorial about ${topic} - step-by-step instructions in simple language. Make it feel like you're teaching a friend, not writing documentation.`,
      'comparison': `Write a comparison article about ${topic} - compare different options in a friendly, conversational way. Help readers understand which one fits their needs.`,
      'review': `Write a review article about ${topic} - share honest thoughts about features, benefits, and drawbacks. Write like you're telling a friend about your experience.`,
      'tips': `Write a tips and tricks article about ${topic} - share practical advice in a friendly, helpful way. Use simple language and real examples.`,
      'what-is': `Write a "What is ${topic}" article - explain the concept in the simplest way possible. Use everyday examples and avoid jargon.`,
      'why': `Write a "Why ${topic}" article - explain reasons and benefits in a clear, simple way. Help readers understand why it matters.`
    };

    const typePrompt = blogTypePrompts[blogType] || blogTypePrompts['guide'];

    // Build the prompt with human-readable writing style (like AI rewriter with creativity 10/10)
    let prompt = `${typePrompt}${toolContext}

WRITING STYLE REQUIREMENTS (CRITICAL - Follow these exactly):
- Write in SIMPLE, HUMAN-READABLE language - like a real person talking, not AI
- Use everyday words - avoid complex jargon unless necessary
- Write with CREATIVITY LEVEL 10/10 - make it engaging and natural
- Vary sentence length - mix short and long sentences naturally
- Use contractions (don't, can't, it's) to sound more human
- Add personality - be friendly, helpful, and conversational
- Use "you" and "your" to connect with readers
- Include natural transitions between ideas
- Write like you're explaining to a friend, not writing a formal document
- Make it feel authentic and genuine - avoid robotic or overly formal language
- Use examples from real life
- Add a bit of personality and warmth

Content Requirements:
- Write approximately ${wordCount} words
- Use clear headings (H2, H3) for structure
- Include practical examples and use cases
- Make it SEO-friendly with natural keyword usage (don't stuff keywords)
- Use proper HTML formatting (h2, h3, p, ul, ol, strong, em tags)
- Do NOT include title tags or meta tags in the content
- Write in paragraphs - each paragraph should be 3-5 sentences
- Use bullet points and lists where helpful
- Make it scannable with good headings`;

    if (includeInternalLinks) {
      prompt += `\n\nInternal Linking Requirements:
- Naturally include 3-5 internal links to relevant FYN Tools (use these exact URLs):
${toolsForLinking.map(t => `  - ${t.name}: ${t.url} - ${t.description}`).join('\n')}
- Links should be natural and contextually relevant
- Use descriptive anchor text (e.g., "Try our Word Counter tool" instead of "click here")
- Format links as: <a href="${toolsForLinking[0].url}">${toolsForLinking[0].name}</a>`;

      prompt += `\n\nExample internal link format: <a href="https://fyntools.com/word-counter" target="_blank" rel="noopener">Word Counter tool</a>`;
    }

    if (includeExternalLinks) {
      prompt += `\n\nExternal Linking Requirements (MANDATORY - You MUST include these):
- Include EXACTLY 2-3 relevant external links to authoritative sources
- Use reputable websites like:
  * Wikipedia (https://en.wikipedia.org/wiki/[topic])
  * Official documentation sites
  * Industry blogs and resources
  * Educational websites
- Format EXACTLY as: <a href="https://example.com" target="_blank" rel="noopener noreferrer">Descriptive Link Text</a>
- Make external links contextually relevant - place them naturally in the content where they add value
- Use descriptive anchor text (e.g., "According to Wikipedia" or "Learn more about this on [site name]")
- DO NOT skip external links - they are required and must appear in the final content
- Place at least one external link in the introduction or first section
- Place another external link in a middle section
- Make sure the links are actually clickable HTML, not just text`;
    }

    if (targetKeywords) {
      const keywords = targetKeywords.split(',').map(k => k.trim());
      const primaryKeyword = keywords[0];
      const secondaryKeywords = keywords.slice(1).join(', ');
      
      prompt += `\n\nSEO Keyword Strategy (2026 Google Requirements):
Primary Keyword: "${primaryKeyword}"
${secondaryKeywords ? `Secondary Keywords: ${secondaryKeywords}` : ''}

Keyword Placement Requirements:
1. Use primary keyword 4-6 times naturally throughout content (0.8-1.5% density)
2. Use primary keyword in:
   - First 100 words (introduction)
   - At least one H2 heading
   - At least one image alt text
   - Conclusion paragraph
3. Use secondary keywords 5-10 times naturally
4. Include LSI (semantic) keywords - related terms and synonyms
5. Use keyword variations - don't repeat exact same phrase
6. Natural keyword usage - avoid keyword stuffing
7. Keyword density should be 0.8% - 1.5% for primary keyword
8. Use keywords in context - they should make sense in sentences`;
    }

    // Determine word count based on blog type (2026 Google recommendations)
    const recommendedWordCounts = {
      'informational': Math.max(1200, wordCount),
      'comparison': Math.max(1500, wordCount),
      'guide': Math.max(2500, wordCount),
      'how-to': Math.max(1200, wordCount),
      'best': Math.max(1500, wordCount),
      'top': Math.max(1500, wordCount),
      'tutorial': Math.max(1200, wordCount),
      'review': Math.max(1500, wordCount),
      'tips': Math.max(1200, wordCount),
      'what-is': Math.max(1200, wordCount),
      'why': Math.max(1200, wordCount)
    };
    
    const finalWordCount = recommendedWordCounts[blogType] || wordCount;
    const needsTOC = finalWordCount > 1200;
    
    prompt += `\n\nOutput Format (2026 SEO Best Practices - CRITICAL):
- Return ONLY the HTML content (no title, no meta tags)
- Use proper HTML structure with semantic tags
- Word count: Approximately ${finalWordCount} words (this is CRITICAL for SEO ranking)
${needsTOC ? '- MUST Include a Table of Contents (TOC) at the beginning with jump links to all H2 and H3 sections\n  Format: <div class="table-of-contents"><h2>Table of Contents</h2><ul><li><a href="#section-slug">Section Name</a></li></ul></div>' : ''}
- Start with an engaging introduction paragraph (80-120 words)
- Include at least 4-6 main sections with H2 headings
- Use H3 for subsections under each H2
- Add unique IDs to all H2 and H3 headings: <h2 id="section-name">Heading</h2>
- Include at least one comparison table if relevant (use proper <table>, <thead>, <tbody>, <tr>, <th>, <td> tags)
- For tables: Add data-label attributes to ALL table cells for mobile: <td data-label="Column Name">content</td>
- Wrap complex tables (>4 columns) in: <div class="table-wrapper"><table>...</table></div>
- Include 3-5 FAQ questions with answers at the end (format as: <h2 id="faq">Frequently Asked Questions</h2><div class="faq-item"><h3>Question?</h3><p>Answer...</p></div>)
- End with a conclusion paragraph
- Ensure all HTML is properly formatted and valid
- Use proper heading hierarchy: H1 (title - not in content), H2 (main sections), H3 (subsections), H4 (if needed)
- Include images with proper alt text: <img src="url" alt="descriptive alt text" loading="lazy" style="max-width: 100%; height: auto;" />
- Use semantic HTML: <article>, <section>, <aside> where appropriate
- Paragraphs should be 2-3 lines (15-20 words per sentence)
- Use bullet lists and tables for scannability`;

    // Try to get a model with high creativity settings (like AI rewriter)
    const models = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-pro'
    ];

    let model = null;
    let lastError = null;

    for (const modelName of models) {
      try {
        // Use high creativity settings (10/10 = 1.0 temperature) like AI rewriter
        model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 1.0, // Maximum creativity (10/10)
            topP: 0.95,
            topK: 40,
          }
        });
        await model.generateContent('test'); // Test if model works
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!model) {
      throw new Error(`No working Gemini model found. Last error: ${lastError?.message || 'Unknown'}`);
    }

    // Generate content with high creativity
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let generatedContent = response.text();
    
    // Verify external links are present if required
    if (includeExternalLinks) {
      const externalLinkPattern = /<a\s+href=["']https?:\/\/(?!fyntools\.com)[^"']+["'][^>]*>/gi;
      const externalLinksFound = (generatedContent.match(externalLinkPattern) || []).length;
      
      if (externalLinksFound < 2) {
        // Regenerate with stronger emphasis on external links
        const enhancedPrompt = prompt + `\n\nCRITICAL: You did not include enough external links. You MUST add at least 2-3 external links (links to websites other than fyntools.com) in the content. Make sure they are proper HTML anchor tags with href attributes.`;
        const retryResult = await model.generateContent(enhancedPrompt);
        const retryResponse = await retryResult.response;
        generatedContent = retryResponse.text();
      }
    }

    // Clean up the content
    generatedContent = generatedContent
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();

    // Ensure proper HTML structure
    if (!generatedContent.startsWith('<')) {
      generatedContent = `<div class="blog-content">\n${generatedContent}\n</div>`;
    }

    // Generate SEO-optimized title (50-60 characters, includes primary keyword)
    const primaryKeyword = targetKeywords ? targetKeywords.split(',')[0].trim() : topic.split(' ')[0];
    const titlePrompt = `Generate a compelling, SEO-friendly blog title (50-60 characters, max 600px width) for this topic: ${topic}, blog type: ${blogType}. 
Requirements:
- Include primary keyword: "${primaryKeyword}"
- Add year "2026" if relevant
- Make it readable and click-worthy
- 50-60 characters maximum
- Return ONLY the title, no quotes, no extra text.`;
    const titleResult = await model.generateContent(titlePrompt);
    const titleResponse = await titleResult.response;
    let generatedTitle = titleResponse.text().trim().replace(/["']/g, '');
    // Ensure it's within limit
    if (generatedTitle.length > 60) {
      generatedTitle = generatedTitle.substring(0, 57) + '...';
    }

    // Generate excerpt (150-200 characters)
    const excerptPrompt = `Generate a compelling blog excerpt (150-200 characters) for a blog about: ${topic}. 
Requirements:
- Include primary keyword naturally
- Explain what user will learn
- Make it engaging
- Return ONLY the excerpt, no quotes, no extra text.`;
    const excerptResult = await model.generateContent(excerptPrompt);
    const excerptResponse = await excerptResult.response;
    let generatedExcerpt = excerptResponse.text().trim().replace(/["']/g, '');
    if (generatedExcerpt.length > 200) {
      generatedExcerpt = generatedExcerpt.substring(0, 197) + '...';
    }

    // Generate meta description (150-160 characters, includes primary keyword + CTA)
    const metaPrompt = `Generate an SEO meta description (150-160 characters, max 920px) for a blog about: ${topic}. 
Requirements:
- Include primary keyword: "${primaryKeyword}"
- Add a call-to-action (CTA)
- Make it readable and compelling
- 150-160 characters maximum
- Return ONLY the meta description, no quotes, no extra text.`;
    const metaResult = await model.generateContent(metaPrompt);
    const metaResponse = await metaResult.response;
    let generatedMeta = metaResponse.text().trim().replace(/["']/g, '');
    if (generatedMeta.length > 160) {
      generatedMeta = generatedMeta.substring(0, 157) + '...';
    }
    
    // Generate comprehensive keywords list (20-40 keywords)
    const keywordsPrompt = `Generate a comprehensive keyword list (20-40 keywords) for a blog about: ${topic}, blog type: ${blogType}.
Include:
- Primary keyword: "${primaryKeyword}"
- Secondary keywords (5-10)
- Long-tail keywords (5-10)
- LSI (semantic) keywords (10-20)
Return as comma-separated list, no quotes, no extra text.`;
    const keywordsResult = await model.generateContent(keywordsPrompt);
    const keywordsResponse = await keywordsResult.response;
    let generatedKeywords = keywordsResponse.text().trim().replace(/["']/g, '');

    // Add table of contents if needed (for blogs > 1200 words)
    let finalContent = generatedContent;
    if (needsTOC && !finalContent.toLowerCase().includes('table of contents') && !finalContent.toLowerCase().includes('table-of-contents')) {
      // Extract headings for TOC
      const headingMatches = finalContent.match(/<h[2-3][^>]*>(.*?)<\/h[2-3]>/gi);
      if (headingMatches && headingMatches.length > 2) {
        let toc = '<div class="table-of-contents"><h2>Table of Contents</h2><ul>';
        const usedSlugs = new Set();
        
        headingMatches.forEach((heading) => {
          const text = heading.replace(/<[^>]*>/g, '').trim();
          if (!text) return;
          
          const level = heading.match(/<h([2-3])/)?.[1] || '2';
          let slug = text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);
          
          // Ensure unique slugs
          let uniqueSlug = slug;
          let counter = 1;
          while (usedSlugs.has(uniqueSlug)) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }
          usedSlugs.add(uniqueSlug);
          
          const indent = level === '3' ? '<li style="margin-left: 1.5rem;">' : '<li>';
          toc += `${indent}<a href="#${uniqueSlug}">${text}</a></li>`;
          
          // Add ID to heading if not already present
          if (!heading.includes('id=')) {
            finalContent = finalContent.replace(
              heading,
              heading.replace(/<h([2-3])([^>]*)>/, `<h$1$2 id="${uniqueSlug}">`)
            );
          }
        });
        toc += '</ul></div>';
        
        // Insert TOC after first paragraph or after intro
        const firstP = finalContent.indexOf('</p>');
        if (firstP > -1) {
          finalContent = finalContent.slice(0, firstP + 4) + '\n' + toc + '\n' + finalContent.slice(firstP + 4);
        } else {
          finalContent = toc + '\n' + finalContent;
        }
      }
    }
    
    // Ensure FAQ section has proper structure
    if (finalContent.includes('FAQ') || finalContent.includes('Frequently Asked Questions')) {
      // Wrap FAQ items properly
      finalContent = finalContent.replace(
        /<h2[^>]*>.*?FAQ.*?<\/h2>/gi,
        '<h2 id="faq">Frequently Asked Questions</h2>'
      );
    } else {
      // Add FAQ section if missing
      const faqPrompt = `Generate 3-5 FAQ questions and answers about: ${topic}. 
Format as HTML:
<h2 id="faq">Frequently Asked Questions</h2>
<div class="faq-item"><h3>Question?</h3><p>Answer...</p></div>
Return ONLY the FAQ HTML, no extra text.`;
      try {
        const faqResult = await model.generateContent(faqPrompt);
        const faqResponse = await faqResult.response;
        const faqContent = faqResponse.text().trim().replace(/["']/g, '');
        finalContent += '\n\n' + faqContent;
      } catch (err) {
        console.error('Error generating FAQ:', err);
      }
    }
    
    // Sanitize generated content and ensure semantic structure
    const sanitizedContent = ensureSemanticStructure(sanitizeHTML(finalContent));

    // Generate slug
    const baseSlug = generateSlug(generatedTitle);
    const slug = await generateUniqueSlug(
      baseSlug,
      async (slug, excludeId) => {
        const exists = await Blog.findOne({ slug, _id: { $ne: excludeId } });
        return !!exists;
      }
    );

    // Calculate reading time
    const text = extractText(sanitizedContent);
    const wordCountActual = text.split(/\s+/).length;
    const readingTime = Math.ceil(wordCountActual / 200);

    // Prepare comprehensive keywords list
    const allKeywords = targetKeywords 
      ? [...targetKeywords.split(',').map(t => t.trim()), ...generatedKeywords.split(',').map(k => k.trim())]
      : generatedKeywords.split(',').map(k => k.trim());
    const uniqueKeywords = [...new Set(allKeywords.filter(k => k.length > 0))].slice(0, 40);
    
    // Prepare blog data with full SEO optimization
    const blogData = {
      title: generatedTitle,
      slug,
      content: sanitizedContent,
      excerpt: generatedExcerpt.substring(0, 300),
      category: category || 'General',
      tags: uniqueKeywords.slice(0, 10), // Top 10 tags
      metaTitle: generatedTitle.substring(0, 60), // 50-60 chars
      metaDescription: generatedMeta.substring(0, 160), // 150-160 chars
      focusKeyword: targetKeywords ? targetKeywords.split(',')[0].trim() : primaryKeyword,
      keywords: uniqueKeywords.join(', '), // Full keyword list for meta
      canonicalUrl: `https://fyntools.com/blog/${slug}`,
      ogTitle: generatedTitle.substring(0, 60),
      ogDescription: generatedExcerpt.substring(0, 160),
      ogImage: toolInfo ? `${toolInfo.url}/og-image.jpg` : '',
      twitterTitle: generatedTitle.substring(0, 70),
      twitterDescription: generatedExcerpt.substring(0, 200),
      status: 'draft', // Save as draft so admin can review
      publishDate: new Date(),
      readingTime,
      author: req.user?.id || null,
      isFeatured: false,
      noIndex: false,
      noFollow: false
    };

    // Save to database
    try {
      const blog = new Blog(blogData);
      await blog.save();

      // Update sitemap (async, don't wait)
      setImmediate(() => {
        generateSitemap().catch(err => {
          console.error('Error updating sitemap:', err);
        });
      });

      res.json({
        success: true,
        data: blog,
        message: 'Blog generated successfully. Review and publish when ready.'
      });
    } catch (saveError) {
      console.error('Error saving blog:', saveError);
      // If it's a duplicate slug error, try with timestamp
      if (saveError.code === 11000 || saveError.message.includes('duplicate')) {
        blogData.slug = `${blogData.slug}-${Date.now()}`;
        const blog = new Blog(blogData);
        await blog.save();
        return res.json({
          success: true,
          data: blog,
          message: 'Blog generated successfully. Review and publish when ready.'
        });
      }
      throw saveError;
    }
  } catch (error) {
    console.error('AI blog generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate blog'
    });
  }
};
