import { readdirSync, renameSync, existsSync, appendFileSync, writeFileSync } from 'fs';
import { join, extname, basename, parse } from 'path';

// Supported media extensions (lowercase)
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.mp4', '.mov'];

/**
 * Check if a filename is filesystem-safe (no special characters that cause issues)
 * Works on both macOS and Windows
 * @param {string} filename - Filename to check
 * @returns {boolean} True if safe
 */
export function isFilenameSafe(filename) {
  // Reject characters that are problematic on Windows or macOS:
  // < > : " / \ | ? * and control characters
  const unsafePattern = /[<>:"/\\|?*\x00-\x1f]/;
  return !unsafePattern.test(filename);
}

/**
 * Sanitize a filename to be filesystem-safe on both macOS and Windows
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
 * Escape a value for CSV (handle commas and quotes)
 * @param {string} value - Value to escape
 * @returns {string} CSV-safe value
 */
function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Log a file rename operation to the scheduled directory as CSV
 * @param {string} scheduledDir - Path to scheduled directory
 * @param {string} original - Original filename
 * @param {string} renamed - New filename
 */
export function logRename(scheduledDir, original, renamed) {
  const logPath = join(scheduledDir, 'rename_log.csv');
  const timestamp = new Date().toISOString();

  // Create file with header if it doesn't exist
  if (!existsSync(logPath)) {
    writeFileSync(logPath, 'timestamp,original_filename,new_filename\n', 'utf-8');
  }

  const row = [
    escapeCSV(timestamp),
    escapeCSV(original),
    escapeCSV(renamed)
  ].join(',');

  appendFileSync(logPath, row + '\n', 'utf-8');
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
    // Skip hidden files
    if (file.startsWith('.')) {
      continue;
    }

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
 * @param {string} fileBasename - Base name of media file
 * @param {Object} dirs - Directory paths
 * @returns {boolean} True if already processed
 */
export function isAlreadyProcessed(fileBasename, dirs) {
  const finalPath = join(dirs.captions, `${fileBasename}.final.txt`);
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
  if (lower.includes('process')) {
    return 'process_tip';
  }

  return 'general';
}
