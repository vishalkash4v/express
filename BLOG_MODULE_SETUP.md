# Blog Module Setup Guide

## 📦 Required Dependencies

Add these to `Backend/package.json`:

```json
{
  "dependencies": {
    "dompurify": "^3.0.6",
    "jsdom": "^23.0.1",
    "node-cron": "^3.0.11"
  }
}
```

Install:
```bash
cd Backend
npm install dompurify jsdom node-cron
```

## 🔧 Backend Setup

### Files Created:
1. ✅ `models/Blog.js` - Mongoose schema
2. ✅ `controllers/blogController.js` - CRUD operations
3. ✅ `routes/blog.js` - API routes
4. ✅ `routes/sitemap.js` - Sitemap generation
5. ✅ `utils/htmlSanitizer.js` - HTML sanitization
6. ✅ `utils/slugGenerator.js` - Slug generation
7. ✅ `utils/sitemapGenerator.js` - Sitemap XML generation
8. ✅ `utils/blogScheduler.js` - Auto-publish scheduler
9. ✅ `middleware/adminAuth.js` - Admin authentication

### Routes Added:
- `GET /api/blog/public` - Get published blogs
- `GET /api/blog/public/:slug` - Get blog by slug
- `GET /api/blog` - Admin: Get all blogs
- `GET /api/blog/admin/:id` - Admin: Get blog by ID
- `POST /api/blog` - Admin: Create blog
- `PUT /api/blog/:id` - Admin: Update blog
- `DELETE /api/blog/:id` - Admin: Delete blog
- `POST /api/blog/upload-image` - Admin: Upload featured image
- `GET /sitemap.xml` - Dynamic sitemap
- `GET /robots.txt` - Robots.txt

### Environment Variables:
Add to `.env`:
```
FRONTEND_URL=https://fyntools.com
```

### Database:
The Blog model will be automatically created when first blog is saved.

## 📝 API Usage Examples

### Create Blog (Admin):
```javascript
POST /api/blog
Headers: { Authorization: "Bearer <admin_token>" }
Body: {
  title: "Blog Title",
  content: "<p>Blog content HTML</p>",
  category: "SEO",
  tags: ["seo", "marketing"],
  status: "published", // or "draft" or "scheduled"
  scheduledDate: "2024-12-25T10:00:00Z", // if scheduled
  metaTitle: "SEO Meta Title",
  metaDescription: "Meta description...",
  // ... other SEO fields
}
```

### Upload Featured Image:
```javascript
POST /api/blog/upload-image
Headers: { Authorization: "Bearer <admin_token>" }
Content-Type: multipart/form-data
Body: { image: <file> }
```

## 🚀 Next Steps

1. Install dependencies
2. Create admin frontend pages
3. Create public blog pages
4. Set up cron job (Vercel Cron, AWS EventBridge, etc.)

## 📋 Features Implemented

✅ Blog CRUD operations
✅ HTML sanitization
✅ Slug generation
✅ SEO meta controls
✅ Scheduling system
✅ Sitemap generation
✅ Image upload & optimization
✅ Admin authentication
✅ Related blogs
✅ Categories & tags
