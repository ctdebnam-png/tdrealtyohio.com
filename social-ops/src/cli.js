#!/usr/bin/env node

import { watch as fsWatch } from 'chokidar';
import { join, extname, basename } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { runSetup } from './setup.js';
import { getDefaultBaseDir } from './config.js';
import { scanInbox, isAlreadyProcessed, getBasename } from './scanner.js';
import { getOrCreateBrief } from './brief.js';
import { loadRules, processMediaFile } from './generator.js';
import { queueMediaFile, createPacket } from './scheduler.js';

// Supported media extensions
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.mp4', '.mov'];

/**
 * Parse command line arguments
 * @param {Array} args - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    command: null,
    baseDir: getDefaultBaseDir(),
    force: false,
    basename: null
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--baseDir' || arg === '--base-dir') {
      i++;
      if (i < args.length) {
        options.baseDir = args[i];
      }
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      options.command = 'help';
    } else if (!arg.startsWith('-')) {
      if (!options.command) {
        options.command = arg;
      } else if (!options.basename) {
        options.basename = arg;
      }
    }
    i++;
  }

  return options;
}

/**
 * Print banner
 */
function printBanner() {
  console.log('');
  console.log('TD Realty Ohio - Social Media Caption Tool');
  console.log('==========================================');
  console.log('');
}

/**
 * Run the scan command - process all media in inbox once
 * @param {Object} options - Parsed CLI options
 */
async function runScan(options) {
  printBanner();
  console.log('Running scan...\n');

  // Setup directories and load config
  const { config, dirs } = runSetup(options.baseDir);
  console.log(`Base directory: ${config.baseDir}`);
  if (options.force) {
    console.log('Force mode: will reprocess existing files');
  }
  console.log('');

  // Load rules
  let rules;
  try {
    rules = loadRules(dirs);
    console.log('Loaded rules files');
  } catch (error) {
    console.error(`Error loading rules: ${error.message}`);
    process.exit(1);
  }

  // Scan inbox for media files
  const mediaFiles = scanInbox(dirs);

  if (mediaFiles.length === 0) {
    console.log('\nNo media files found in inbox.');
    console.log(`Add media files to: ${dirs.inbox}`);
    return;
  }

  console.log(`\nFound ${mediaFiles.length} media file(s) in inbox`);

  // Process each media file
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const mediaInfo of mediaFiles) {
    // Check if already processed (unless --force)
    if (!options.force && isAlreadyProcessed(mediaInfo.basename, dirs)) {
      console.log(`\nSkipped (already processed): ${mediaInfo.filename}`);
      skipped++;
      continue;
    }

    // If forcing, remove existing final.txt to regenerate
    if (options.force && isAlreadyProcessed(mediaInfo.basename, dirs)) {
      const finalPath = join(dirs.captions, `${mediaInfo.basename}.final.txt`);
      unlinkSync(finalPath);
      console.log(`\nForce regenerating: ${mediaInfo.filename}`);
    }

    // Get or create brief
    const { data: brief } = getOrCreateBrief(mediaInfo, dirs, config);

    // Process the file
    const success = await processMediaFile(mediaInfo, brief, rules, config, dirs);

    if (success) {
      // Add to scheduling queue
      queueMediaFile(mediaInfo, brief, dirs);
      processed++;
    } else {
      failed++;
    }
  }

  // Summary
  console.log('\n' + '-'.repeat(60));
  console.log('Summary:');
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);

  if (processed > 0) {
    console.log(`\nCaption files: ${dirs.captions}`);
    console.log(`Ready media:   ${dirs.ready}`);
    console.log(`Queue file:    ${join(dirs.scheduled, 'queue.csv')}`);
  }
}

/**
 * Run the watch command - continuously watch inbox for new files
 * @param {Object} options - Parsed CLI options
 */
async function runWatch(options) {
  printBanner();
  console.log('Starting watch mode...\n');

  // Setup directories and load config
  const { config, dirs } = runSetup(options.baseDir);
  console.log(`Base directory: ${config.baseDir}`);
  console.log(`Watching: ${dirs.inbox}`);
  if (options.force) {
    console.log('Force mode: will reprocess existing files');
  }
  console.log('');

  // Load rules
  let rules;
  try {
    rules = loadRules(dirs);
    console.log('Loaded rules files');
  } catch (error) {
    console.error(`Error loading rules: ${error.message}`);
    process.exit(1);
  }

  // Processing queue to avoid concurrent processing of same file
  const processing = new Set();

  // Process a single file
  async function processFile(filePath) {
    const filename = basename(filePath);
    const ext = extname(filename).toLowerCase();

    // Check if supported media type
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return;
    }

    const fileBasename = getBasename(filename);

    // Skip if already being processed
    if (processing.has(fileBasename)) {
      return;
    }

    // Skip if already processed (unless --force)
    if (!options.force && isAlreadyProcessed(fileBasename, dirs)) {
      console.log(`Skipped (already processed): ${filename}`);
      return;
    }

    processing.add(fileBasename);

    try {
      // If forcing, remove existing final.txt
      if (options.force && isAlreadyProcessed(fileBasename, dirs)) {
        const finalPath = join(dirs.captions, `${fileBasename}.final.txt`);
        unlinkSync(finalPath);
      }

      const mediaInfo = {
        filename,
        basename: fileBasename,
        extension: ext,
        path: filePath,
        wasRenamed: false
      };

      // Get or create brief
      const { data: brief } = getOrCreateBrief(mediaInfo, dirs, config);

      // Small delay to ensure file is fully written
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process the file
      const success = await processMediaFile(mediaInfo, brief, rules, config, dirs);

      if (success) {
        queueMediaFile(mediaInfo, brief, dirs);
      }
    } finally {
      processing.delete(fileBasename);
    }
  }

  // Setup file watcher
  const watcher = fsWatch(dirs.inbox, {
    persistent: true,
    ignoreInitial: false, // Process existing files on startup
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  watcher.on('add', (filePath) => {
    console.log(`\nDetected new file: ${basename(filePath)}`);
    processFile(filePath).catch(err => {
      console.error(`Error processing ${filePath}: ${err.message}`);
    });
  });

  watcher.on('error', (error) => {
    console.error(`Watcher error: ${error.message}`);
  });

  console.log('\nWatching for new media files. Press Ctrl+C to stop.\n');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping watch mode...');
    watcher.close();
    process.exit(0);
  });
}

/**
 * Run the package command - create copy-paste packet for a media item
 * @param {Object} options - Parsed CLI options
 */
async function runPackage(options) {
  printBanner();

  if (!options.basename) {
    console.error('Error: Please provide a basename');
    console.error('Usage: npm run package -- <basename> [--baseDir <path>]');
    process.exit(1);
  }

  // Setup directories
  const { dirs } = runSetup(options.baseDir);

  // Create the packet
  const success = createPacket(options.basename, dirs);

  if (success) {
    console.log(`\nPacket created: ${join(dirs.scheduled, `${options.basename}.packet.txt`)}`);
  } else {
    console.error('\nFailed to create packet. Ensure the media has been processed first.');
    process.exit(1);
  }
}

/**
 * Print usage information
 */
function printUsage() {
  printBanner();
  console.log('Usage:');
  console.log('  npm run scan [-- --baseDir <path>] [-- --force]');
  console.log('  npm run watch [-- --baseDir <path>] [-- --force]');
  console.log('  npm run package -- <basename> [--baseDir <path>]');
  console.log('');
  console.log('Commands:');
  console.log('  scan      Scan inbox and generate captions for new media');
  console.log('  watch     Watch inbox continuously for new files');
  console.log('  package   Create copy-paste packet for a processed item');
  console.log('');
  console.log('Options:');
  console.log('  --baseDir <path>  Working directory (default: ~/TD_Realty_Social)');
  console.log('  --force, -f       Reprocess files even if already processed');
  console.log('  --help, -h        Show this help message');
  console.log('');
  console.log('Environment:');
  console.log('  ANTHROPIC_API_KEY  Required for caption generation');
  console.log('');
  console.log('Examples:');
  console.log('  npm run scan');
  console.log('  npm run scan -- --baseDir /path/to/TD_Realty_Social');
  console.log('  npm run scan -- --force');
  console.log('  npm run watch');
  console.log('  npm run package -- my_photo_name');
  console.log('');
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  switch (options.command) {
    case 'scan':
      await runScan(options);
      break;
    case 'watch':
      await runWatch(options);
      break;
    case 'package':
      await runPackage(options);
      break;
    case 'help':
      printUsage();
      break;
    default:
      printUsage();
      if (options.command) {
        console.error(`Unknown command: ${options.command}`);
      }
      process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
