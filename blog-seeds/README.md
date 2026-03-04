# Blog Seed Usage

This folder contains ready-to-publish blog payloads for the backend blog API.

## Publish this blog

1. Get an admin JWT token from your admin login flow.
2. Use the payload file:
   - `best-ai-rewriter-tool-fyntools.json`
3. POST it to:
   - `POST /api/blog`

Example with your backend:

```bash
curl -X POST "https://express-two-umber.vercel.app/api/blog" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  --data-binary @Backend/blog-seeds/best-ai-rewriter-tool-fyntools.json
```

API base used: `https://express-two-umber.vercel.app/api`
