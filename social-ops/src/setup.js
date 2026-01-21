import { mkdirSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildConfig, getDirectoryPaths, getSharedRulesPath } from './config.js';

/**
 * Ensure all required directories exist, creating them if necessary
 * @param {string} baseDir - Base directory path
 * @returns {Object} Directory paths
 */
export function ensureDirectories(baseDir) {
  const dirs = getDirectoryPaths(baseDir);

  // Create base directory if it doesn't exist
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
    console.log(`Created base directory: ${baseDir}`);
  }

  // Create all subdirectories
  for (const [name, path] of Object.entries(dirs)) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      console.log(`Created directory: ${name}/ at ${path}`);
    }
  }

  return dirs;
}

/**
 * Copy shared rules files to the working directory's rules folder if they don't exist
 * @param {Object} dirs - Directory paths object
 */
export function initializeRules(dirs) {
  const sharedRulesPath = getSharedRulesPath();
  const workingRulesPath = dirs.rules;

  if (!existsSync(sharedRulesPath)) {
    console.warn('Shared rules directory not found. Skipping rules initialization.');
    return;
  }

  const ruleFiles = readdirSync(sharedRulesPath).filter(f => f.endsWith('.txt'));

  for (const file of ruleFiles) {
    const sourcePath = join(sharedRulesPath, file);
    const destPath = join(workingRulesPath, file);

    if (!existsSync(destPath)) {
      copyFileSync(sourcePath, destPath);
      console.log(`Initialized rules file: ${file}`);
    }
  }
}

/**
 * Run full setup - ensure directories and initialize rules
 * @param {string} baseDir - Base directory path
 * @returns {Object} Object with config and directory paths
 */
export function runSetup(baseDir) {
  const config = buildConfig(baseDir);
  const dirs = ensureDirectories(config.baseDir);
  initializeRules(dirs);

  return { config, dirs };
}
