# Analytics System Documentation

## Overview
The analytics system tracks page views for tools, blogs, and other pages to provide comprehensive analytics in the admin dashboard.

## Issues Fixed

### 1. Tracking Not Working (showing 0 views)
**Problem:** Analytics was showing 0 views because:
- `sendBeacon` API doesn't properly handle JSON strings
- Tracking calls might be failing silently

**Solution:**
- Changed from `sendBeacon` to `fetch` with `keepalive: true` for better reliability
- Added proper error handling (non-blocking)
- Fixed Content-Type headers

### 2. Migration of Old Tool View Data
**Problem:** Existing tool `viewCount` data in the database wasn't being used for analytics.

**Solution:**
- Created migration script: `Backend/scripts/migrateToolViewsToAnalytics.js`
- Run this script once to backfill analytics data from existing tool views

**To run migration:**
```bash
cd Backend
node scripts/migrateToolViewsToAnalytics.js
```

## How Tracking Works

### Frontend Tracking
1. **Tool Pages:** Automatically tracked when tool page loads via `ToolPageLayout` and `EnhancedToolPageLayout`
2. **Blog Pages:** Automatically tracked when blog page loads via `BlogPostPage`
3. **Tracking Function:** `Frontend/src/utils/analytics.ts`
   - `trackPageView()` - Generic tracking
   - `trackToolView()` - Tool-specific
   - `trackBlogView()` - Blog-specific

### Backend Tracking
1. **Endpoint:** `POST /api/analytics/track`
2. **Model:** `Backend/models/Analytics.js`
   - Stores daily aggregated views
   - Tracks by pageType, pageId, pagePath
   - Includes unique views (currently all views are treated as unique)

### Analytics Dashboard
- **Endpoint:** `GET /api/analytics/dashboard?period=7d|30d|90d|1y`
- **Features:**
  - Daily/weekly/monthly views
  - Top pages ranking
  - Trending pages (up/down)
  - Blog performance analytics
  - Views by page type

## Testing Tracking

### Test if tracking is working:
1. Visit a tool page (e.g., `/ai-text-rewriter`)
2. Check browser console for any errors
3. Check admin dashboard - views should increment
4. Check database: `Analytics` collection should have records

### Debug tracking:
1. Open browser DevTools → Network tab
2. Filter by "analytics/track"
3. Visit a page
4. Check if POST request is sent
5. Check response status (should be 200)

## Blog Analytics

Blog performance analytics are now included in the dashboard:
- Top performing blogs
- Views comparison (analytics vs DB viewCount)
- Trend indicators (up/down)
- Category and publish date info

## Unique Views (Session-Based Tracking)

**Implemented:** Session-based unique view detection.
1. **Frontend:** Generates a persistent `sessionId` (stored in localStorage, 30-day TTL)
2. **Backend:** `PageViewSession` model stores (pageType, pageId, date, sessionId) with unique index
3. **Logic:** Same session visiting same page on same day = 1 unique view; different sessions or days = counted separately
4. **Privacy:** Session records auto-delete after 60 days (TTL index)

## Future Enhancements

1. **Unique View Detection:**
   - Implement session-based tracking
   - Use cookies/localStorage
   - Track by IP (with privacy considerations)

2. **Real-time Analytics:**
   - WebSocket updates
   - Live view counts

3. **Advanced Metrics:**
   - Bounce rate
   - Time on page
   - Referrer tracking
   - Device/browser analytics
