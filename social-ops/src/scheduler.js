import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

// Weekly cadence mapping: postType -> { day, time, primary platform }
// Schedule: Mon process/market, Wed buyer tip, Fri neighborhood/seller, Sun brand
const CADENCE_MAP = {
  process_tip: { day: 'Monday', time: '10:00', primary: 'Facebook' },
  market_update: { day: 'Monday', time: '10:00', primary: 'LinkedIn' },
  buyer_tip: { day: 'Wednesday', time: '12:00', primary: 'Facebook' },
  tip: { day: 'Wednesday', time: '12:00', primary: 'Facebook' },
  seller_tip: { day: 'Friday', time: '10:00', primary: 'Facebook' },
  neighborhood: { day: 'Friday', time: '14:00', primary: 'Instagram' },
  brand: { day: 'Sunday', time: '18:00', primary: 'Instagram' },
  listing: { day: 'Tuesday', time: '11:00', primary: 'Facebook' },
  sold: { day: 'Thursday', time: '15:00', primary: 'Instagram' },
  open_house: { day: 'Thursday', time: '10:00', primary: 'Facebook' },
  general: { day: 'Saturday', time: '11:00', primary: 'Facebook' }
};

// All platforms except the primary
const ALL_PLATFORMS = ['Facebook', 'LinkedIn', 'Instagram', 'Google Business Profile'];

/**
 * Get scheduling suggestion based on post type
 * @param {string} postType - Type of post
 * @returns {Object} Scheduling suggestion
 */
export function getSchedulingSuggestion(postType) {
  const cadence = CADENCE_MAP[postType] || CADENCE_MAP.general;
  const secondary = ALL_PLATFORMS.filter(p => p !== cadence.primary);

  return {
    day: cadence.day,
    time: cadence.time,
    primary: cadence.primary,
    secondary: secondary
  };
}

/**
 * Read existing queue.csv or return empty array
 * @param {Object} dirs - Directory paths
 * @returns {Array} Array of queue entries
 */
export function readQueue(dirs) {
  const queuePath = join(dirs.scheduled, 'queue.csv');

  if (!existsSync(queuePath)) {
    return [];
  }

  const content = readFileSync(queuePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header
  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map(line => {
    const parts = line.split(',');
    return {
      basename: parts[0] || '',
      mediaPath: parts[1] || '',
      suggestedPlatformPrimary: parts[2] || '',
      suggestedSecondaryPlatforms: parts[3] || '',
      suggestedPostDay: parts[4] || '',
      suggestedPostTimeLocal: parts[5] || '',
      captionFile: parts[6] || ''
    };
  });
}

/**
 * Check if a basename is already in the queue
 * @param {string} basename - Basename to check
 * @param {Array} queue - Existing queue entries
 * @returns {boolean} True if already queued
 */
export function isInQueue(basename, queue) {
  return queue.some(entry => entry.basename === basename);
}

/**
 * Add entry to queue.csv
 * @param {Object} entry - Queue entry
 * @param {Object} dirs - Directory paths
 */
export function addToQueue(entry, dirs) {
  const queuePath = join(dirs.scheduled, 'queue.csv');
  const header = 'basename,mediaPath,suggestedPlatformPrimary,suggestedSecondaryPlatforms,suggestedPostDay,suggestedPostTimeLocal,captionFile';

  // Create file with header if it doesn't exist
  if (!existsSync(queuePath)) {
    writeFileSync(queuePath, header + '\n', 'utf-8');
  }

  const line = [
    entry.basename,
    entry.mediaPath,
    entry.suggestedPlatformPrimary,
    `"${entry.suggestedSecondaryPlatforms.join(';')}"`,
    entry.suggestedPostDay,
    entry.suggestedPostTimeLocal,
    entry.captionFile
  ].join(',');

  appendFileSync(queuePath, line + '\n', 'utf-8');
}

/**
 * Create queue entry for a processed media file
 * @param {Object} mediaInfo - Media file info
 * @param {Object} brief - Parsed brief data
 * @param {Object} dirs - Directory paths
 */
export function queueMediaFile(mediaInfo, brief, dirs) {
  const suggestion = getSchedulingSuggestion(brief.postType);
  const readyPath = join(dirs.ready, mediaInfo.filename);
  const captionPath = join(dirs.captions, `${mediaInfo.basename}.final.txt`);

  const entry = {
    basename: mediaInfo.basename,
    mediaPath: readyPath,
    suggestedPlatformPrimary: suggestion.primary,
    suggestedSecondaryPlatforms: suggestion.secondary,
    suggestedPostDay: suggestion.day,
    suggestedPostTimeLocal: suggestion.time,
    captionFile: captionPath
  };

  const queue = readQueue(dirs);
  if (!isInQueue(mediaInfo.basename, queue)) {
    addToQueue(entry, dirs);
    console.log(`  Added to queue: ${suggestion.day} ${suggestion.time} -> ${suggestion.primary}`);
  }
}

/**
 * Parse the final.txt file and extract platform-specific captions
 * @param {string} finalContent - Content of final.txt file
 * @returns {Object} Object with captions for each platform
 */
export function parseFinalCaptions(finalContent) {
  const captions = {
    master: '',
    facebook: '',
    linkedin: '',
    instagram: '',
    gbp: ''
  };

  // Extract sections using the === markers
  const sections = finalContent.split(/===\s*/);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length === 0) continue;

    const header = lines[0].toLowerCase().replace(/\s*===\s*$/, '').trim();
    const content = lines.slice(1).join('\n').trim();

    if (header.includes('master')) {
      captions.master = content;
    } else if (header.includes('facebook')) {
      captions.facebook = content;
    } else if (header.includes('linkedin')) {
      captions.linkedin = content;
    } else if (header.includes('instagram')) {
      captions.instagram = content;
    } else if (header.includes('google') || header.includes('gbp')) {
      captions.gbp = content;
    }
  }

  return captions;
}

/**
 * Create a copy-paste packet file for a media item
 * @param {string} basename - Media file basename
 * @param {Object} dirs - Directory paths
 * @returns {boolean} True if successful
 */
export function createPacket(basename, dirs) {
  const finalPath = join(dirs.captions, `${basename}.final.txt`);
  const packetPath = join(dirs.scheduled, `${basename}.packet.txt`);

  if (!existsSync(finalPath)) {
    console.error(`Caption file not found: ${finalPath}`);
    return false;
  }

  const finalContent = readFileSync(finalPath, 'utf-8');
  const captions = parseFinalCaptions(finalContent);

  const packetContent = `================================================================================
COPY-PASTE PACKET: ${basename}
Generated: ${new Date().toISOString()}
================================================================================

────────────────────────────────────────────────────────────────────────────────
📘 FACEBOOK
────────────────────────────────────────────────────────────────────────────────
${captions.facebook}

────────────────────────────────────────────────────────────────────────────────
💼 LINKEDIN
────────────────────────────────────────────────────────────────────────────────
${captions.linkedin}

────────────────────────────────────────────────────────────────────────────────
📷 INSTAGRAM
────────────────────────────────────────────────────────────────────────────────
${captions.instagram}

────────────────────────────────────────────────────────────────────────────────
📍 GOOGLE BUSINESS PROFILE
────────────────────────────────────────────────────────────────────────────────
${captions.gbp}

================================================================================
END OF PACKET
================================================================================
`;

  writeFileSync(packetPath, packetContent, 'utf-8');
  console.log(`Created packet: ${basename}.packet.txt`);
  return true;
}
