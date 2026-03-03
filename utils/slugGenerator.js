/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} - Generated slug
 */
const generateSlug = (text) => {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Generate a unique slug by appending a number if slug exists
 * @param {string} baseSlug - Base slug
 * @param {Function} checkExists - Async function to check if slug exists
 * @param {string} excludeId - ID to exclude from check (for updates)
 * @returns {Promise<string>} - Unique slug
 */
const generateUniqueSlug = async (baseSlug, checkExists, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;
  let exists = await checkExists(slug, excludeId);

  while (exists) {
    slug = `${baseSlug}-${counter}`;
    exists = await checkExists(slug, excludeId);
    counter++;
  }

  return slug;
};

module.exports = {
  generateSlug,
  generateUniqueSlug
};
