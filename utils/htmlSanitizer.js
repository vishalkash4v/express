const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML
 */
const sanitizeHTML = (html) => {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img', 'table',
      'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'div', 'span', 'hr', 'iframe',
      'figure', 'figcaption', 'section', 'article', 'aside', 'nav', 'header', 'footer'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height',
      'target', 'rel', 'data-*', 'allowfullscreen', 'frameborder',
      'style', 'loading', 'itemscope', 'itemtype', 'itemprop'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false
  });
};

/**
 * Extract text content from HTML (for excerpt generation)
 * @param {string} html - HTML content
 * @returns {string} - Plain text
 */
const extractText = (html) => {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
};

/**
 * Extract meta tags from HTML
 * @param {string} html - HTML content
 * @returns {object} - Extracted meta information
 */
const extractMetaTags = (html) => {
  const meta = {
    title: '',
    description: '',
    keywords: []
  };

  if (!html) return meta;

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    meta.title = titleMatch[1].trim();
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    meta.description = descMatch[1].trim();
  }

  // Extract keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    meta.keywords = keywordsMatch[1].split(',').map(k => k.trim());
  }

  return meta;
};

module.exports = {
  sanitizeHTML,
  extractText,
  extractMetaTags
};
