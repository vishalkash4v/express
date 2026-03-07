const fs = require('fs');
const path = require('path');

// Read the TypeScript file
const tsFilePath = path.join(__dirname, '../../Frontend/src/data/toolsData.ts');
const fileContent = fs.readFileSync(tsFilePath, 'utf8');

// Extract the allTools array content
const arrayMatch = fileContent.match(/export const allTools: Tool\[\] = \[([\s\S]*?)\];/);
if (!arrayMatch) {
  throw new Error('Could not find allTools array in toolsData.ts');
}

const toolsArrayContent = arrayMatch[1];

// Parse each tool object
const tools = [];
let braceCount = 0;
let currentTool = '';
let inString = false;
let stringChar = '';
let inComment = false;

for (let i = 0; i < toolsArrayContent.length; i++) {
  const char = toolsArrayContent[i];
  const nextChar = toolsArrayContent[i + 1];
  
  // Handle comments
  if (!inString && char === '/' && nextChar === '/') {
    inComment = true;
    continue;
  }
  if (inComment && char === '\n') {
    inComment = false;
    continue;
  }
  if (inComment) continue;
  
  // Handle strings
  if (!inString && (char === '"' || char === "'")) {
    inString = true;
    stringChar = char;
    currentTool += char;
    continue;
  }
  if (inString && char === stringChar && toolsArrayContent[i - 1] !== '\\') {
    inString = false;
    stringChar = '';
    currentTool += char;
    continue;
  }
  
  if (inString) {
    currentTool += char;
    continue;
  }
  
  // Track braces
  if (char === '{') {
    if (braceCount === 0) {
      currentTool = '{';
    } else {
      currentTool += char;
    }
    braceCount++;
  } else if (char === '}') {
    currentTool += char;
    braceCount--;
    
    // Complete tool object found
    if (braceCount === 0) {
      // Extract fields using regex
      const idMatch = currentTool.match(/id:\s*['"]([^'"]+)['"]/);
      const nameMatch = currentTool.match(/name:\s*['"]([^'"]+)['"]/);
      const categoryMatch = currentTool.match(/category:\s*['"]([^'"]+)['"]/);
      const descMatch = currentTool.match(/description:\s*['"]([^'"]+)['"]/);
      const keywordsMatch = currentTool.match(/keywords:\s*['"]([^'"]+)['"]/);
      const pathMatch = currentTool.match(/path:\s*['"]([^'"]+)['"]/);
      const hrefMatch = currentTool.match(/href:\s*['"]([^'"]*)['"]/);
      const urlMatch = currentTool.match(/url:\s*['"]([^'"]+)['"]/);
      const featuresMatch = currentTool.match(/features:\s*['"]([^'"]+)['"]/);
      
      if (idMatch && nameMatch && categoryMatch && descMatch && keywordsMatch && pathMatch && urlMatch && featuresMatch) {
        tools.push({
          id: idMatch[1],
          name: nameMatch[1],
          category: categoryMatch[1],
          description: descMatch[1],
          keywords: keywordsMatch[1],
          path: pathMatch[1],
          href: hrefMatch && hrefMatch[1] ? hrefMatch[1] : pathMatch[1],
          url: urlMatch[1],
          features: featuresMatch[1]
        });
      }
      currentTool = '';
    }
  } else {
    currentTool += char;
  }
}

// Write to JSON file
const outputPath = path.join(__dirname, '../data/toolsData.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(tools, null, 2), 'utf8');

console.log(`✅ Successfully extracted ${tools.length} tools to ${outputPath}`);
