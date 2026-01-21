import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { guessPostType } from './scanner.js';

/**
 * Generate brief file content template
 * @param {Object} mediaInfo - Media file info object
 * @param {Object} config - Configuration object
 * @returns {string} Brief file content
 */
export function generateBriefTemplate(mediaInfo, config) {
  const postType = guessPostType(mediaInfo.filename);

  return `# Brief for: ${mediaInfo.filename}
# Edit this file to provide context for caption generation.
# Lines starting with # are comments and will be ignored.

# Location (neighborhood, city, or area)
location: ${config.defaultLocation}

# Post type: listing, sold, market_update, buyer_tip, seller_tip, neighborhood, brand, open_house, general
postType: ${postType}

# One local detail to highlight (optional)
# Example: "Near Scioto River walking trails" or "Historic German Village architecture"
localDetail:

# Do NOT mention (optional, comma-separated)
# Example: "price, square footage, specific address"
doNotMention:

# Additional notes for the caption writer (optional)
notes:
`;
}

/**
 * Parse a brief file into a structured object
 * @param {string} content - Brief file content
 * @returns {Object} Parsed brief data
 */
export function parseBrief(content) {
  const brief = {
    location: '',
    postType: 'general',
    localDetail: '',
    doNotMention: [],
    notes: ''
  };

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || !trimmed) {
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    switch (key) {
      case 'location':
        brief.location = value || brief.location;
        break;
      case 'posttype':
        brief.postType = value || brief.postType;
        break;
      case 'localdetail':
        brief.localDetail = value;
        break;
      case 'donotmention':
        brief.doNotMention = value
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        break;
      case 'notes':
        brief.notes = value;
        break;
    }
  }

  return brief;
}

/**
 * Get or create brief file for a media item
 * @param {Object} mediaInfo - Media file info
 * @param {Object} dirs - Directory paths
 * @param {Object} config - Configuration
 * @returns {Object} Object with path and parsed brief data
 */
export function getOrCreateBrief(mediaInfo, dirs, config) {
  const briefPath = join(dirs.captions, `${mediaInfo.basename}.brief.txt`);

  if (!existsSync(briefPath)) {
    const content = generateBriefTemplate(mediaInfo, config);
    writeFileSync(briefPath, content, 'utf-8');
    console.log(`Created brief: ${mediaInfo.basename}.brief.txt`);
  }

  const content = readFileSync(briefPath, 'utf-8');
  const parsed = parseBrief(content);

  return {
    path: briefPath,
    data: parsed
  };
}

/**
 * Check if brief file exists for a media item
 * @param {string} basename - Media file basename
 * @param {Object} dirs - Directory paths
 * @returns {boolean} True if brief exists
 */
export function briefExists(basename, dirs) {
  const briefPath = join(dirs.captions, `${basename}.brief.txt`);
  return existsSync(briefPath);
}
