/**
 * Utility functions for generating and validating post slugs
 */

/**
 * Convert text to URL-friendly slug
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .slice(0, 50); // Limit to 50 chars
}

/**
 * Generate a unique slug from content
 * Extracts first meaningful line or words from content
 */
export function generateSlugFromContent(content: string): string {
  // Remove markdown headers and extra whitespace
  const cleanContent = content
    .replace(/^#+\s+/gm, '') // Remove markdown headers
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  // Get first 50 characters or first word if shorter
  const firstWords = cleanContent
    .split(/\s+/)
    .slice(0, 8) // Take first 8 words
    .join(' ');

  return createSlug(firstWords || 'post');
}

/**
 * Handle slug collision by appending a number
 * e.g., if "my-post" exists, return "my-post-2"
 */
export function handleSlugCollision(
  baseSlug: string,
  existingSlugs: string[],
  maxAttempts: number = 10
): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  for (let i = 2; i <= maxAttempts; i++) {
    const newSlug = `${baseSlug}-${i}`;
    if (!existingSlugs.includes(newSlug)) {
      return newSlug;
    }
  }

  // Fallback: append timestamp if all numbered versions exist
  return `${baseSlug}-${Date.now()}`;
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  // Slug should be lowercase, alphanumeric, and hyphens only
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length > 0 && slug.length <= 255;
}
