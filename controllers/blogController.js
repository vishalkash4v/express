const Blog = require('../models/Blog');
const { sanitizeHTML, extractText, extractMetaTags } = require('../utils/htmlSanitizer');
const { generateSlug, generateUniqueSlug } = require('../utils/slugGenerator');
const sharp = require('sharp');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

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
const USE_DUMMY_BLOGS = true;

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

    // Sanitize HTML content
    let sanitizedContent = sanitizeHTML(content);

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
