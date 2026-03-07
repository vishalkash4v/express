# Tools Data

This directory contains `toolsData.json` which is a JSON representation of all tools from the frontend's `toolsData.ts` file.

## Why This File Exists

Since the frontend (Vite app) and backend (Express app) are deployed separately on Vercel, the backend cannot access files from the frontend directory. This JSON file serves as a bridge.

## Updating the JSON File

When you update `Frontend/src/data/toolsData.ts`, you need to regenerate this JSON file:

```bash
cd Backend
node scripts/extractToolsData.js
```

This will:
1. Read the TypeScript file from the frontend
2. Extract all tool data
3. Generate/update `Backend/data/toolsData.json`

## Deployment

Make sure `Backend/data/toolsData.json` is included in your backend deployment. It should be committed to your repository.

## File Structure

The JSON file contains an array of tool objects with the following structure:
```json
{
  "id": "tool-id",
  "name": "Tool Name",
  "category": "Category Name",
  "description": "Tool description",
  "keywords": "keyword1, keyword2",
  "path": "/tool-path",
  "href": "/tool-path",
  "url": "https://fyntools.com/tool-path",
  "features": "Feature1, Feature2, Feature3"
}
```
