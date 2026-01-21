import { readdirSync, renameSync, existsSync, appendFileSync } from 'fs';
import { join, extname, basename, parse } from 'path';

// Supported media extensions (lowercase)
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.mp4', '.mov'];

/**
 * Check if a filename is filesystem-safe (no special characters that cause issues)
 * @param {string} filename - Filename to check
 * @returns {boolean} True if safe
 */
export function isFilenameSafe(filename) {
  // Allow alphanumeric, hyphens, underscores, dots, and spaces
  // Reject: slashes, colons, quotes, pipes, asterisks, angle brackets, question marks
  const unsafePattern = /[<>:"/\\|?*\x00-\x1f]/;
  return !unsafePattern.test(filename);
}

/**
 * Sanitize a filename to be filesystem-safe
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  const parsed = parse(filename);
  let safeName = parsed.name
    // Replace unsafe characters with underscores
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    // Replace multiple spaces/underscores with single underscore
    .replace(/[\s_]+/g, '_')
    // Trim underscores from start/end
    .replace(/^_+|_+$/g, '')
    // Ensure it's not empty
    || 'unnamed';

  return safeName + parsed.ext.toLowerCase();
}

/**
 * Get the base name for a media file (without extension)
 * @param {string} filename - Filename
 * @returns {string} Base name
 */
export function getBasename(filename) {
  return parse(filename).name;
}

/**
 * Log a file rename operation to the scheduled directory
 * @param {string} scheduledDir - Path to scheduled directory
 * @param {string} original - Original filename
 * @param {string} renamed - New filename
 */
export function logRename(scheduledDir, original, renamed) {
  const logPath = join(scheduledDir, 'rename_log.txt');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp}\t${original}\t->\t${renamed}\n`;
  appendFileSync(logPath, logEntry, 'utf-8');
}

/**
 * Scan inbox directory for media files
 * @param {Object} dirs - Directory paths object
 * @returns {Array} Array of media file info objects
 */
export function scanInbox(dirs) {
  const inboxPath = dirs.inbox;
  const mediaFiles = [];

  if (!existsSync(inboxPath)) {
    console.warn(`Inbox directory does not exist: ${inboxPath}`);
    return mediaFiles;
  }

  const files = readdirSync(inboxPath);

  for (const file of files) {
    const ext = extname(file).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      continue;
    }

    let currentFilename = file;
    let wasRenamed = false;

    // Check if filename needs sanitization
    if (!isFilenameSafe(file)) {
      const safeFilename = sanitizeFilename(file);
      const originalPath = join(inboxPath, file);
      const safePath = join(inboxPath, safeFilename);

      // Handle collision
      let finalSafePath = safePath;
      let counter = 1;
      while (existsSync(finalSafePath)) {
        const parsed = parse(safeFilename);
        finalSafePath = join(inboxPath, `${parsed.name}_${counter}${parsed.ext}`);
        counter++;
      }

      const finalSafeFilename = basename(finalSafePath);
      renameSync(originalPath, finalSafePath);
      logRename(dirs.scheduled, file, finalSafeFilename);
      console.log(`Renamed: "${file}" -> "${finalSafeFilename}"`);

      currentFilename = finalSafeFilename;
      wasRenamed = true;
    }

    mediaFiles.push({
      filename: currentFilename,
      basename: getBasename(currentFilename),
      extension: extname(currentFilename).toLowerCase(),
      path: join(inboxPath, currentFilename),
      wasRenamed
    });
  }

  return mediaFiles;
}

/**
 * Check if a media file has already been processed (has final.txt)
 * @param {string} basename - Base name of media file
 * @param {Object} dirs - Directory paths
 * @returns {boolean} True if already processed
 */
export function isAlreadyProcessed(basename, dirs) {
  const finalPath = join(dirs.captions, `${basename}.final.txt`);
  return existsSync(finalPath);
}

/**
 * Guess post type from filename keywords
 * @param {string} filename - Filename to analyze
 * @returns {string} Guessed post type
 */
export function guessPostType(filename) {
  const lower = filename.toLowerCase();

  if (lower.includes('listing') || lower.includes('property') || lower.includes('home') || lower.includes('house')) {
    return 'listing';
  }
  if (lower.includes('sold') || lower.includes('closing')) {
    return 'sold';
  }
  if (lower.includes('market') || lower.includes('stats') || lower.includes('update')) {
    return 'market_update';
  }
  if (lower.includes('tip') || lower.includes('advice')) {
    return 'tip';
  }
  if (lower.includes('buyer')) {
    return 'buyer_tip';
  }
  if (lower.includes('seller')) {
    return 'seller_tip';
  }
  if (lower.includes('neighborhood') || lower.includes('area') || lower.includes('community')) {
    return 'neighborhood';
  }
  if (lower.includes('team') || lower.includes('agent') || lower.includes('about')) {
    return 'brand';
  }
  if (lower.includes('open') && lower.includes('house')) {
    return 'open_house';
  }

  return 'general';
}
