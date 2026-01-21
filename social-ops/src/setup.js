import { mkdirSync, existsSync, copyFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { loadConfig, getDirectoryPaths, getRulesTemplatesPath } from './config.js';

/**
 * Ensure all required directories exist, creating them if necessary
 * @param {Object} config - Configuration object
 * @returns {Object} Directory paths
 */
export function ensureDirectories(config) {
  const dirs = getDirectoryPaths(config.baseDir);

  // Create base directory if it doesn't exist
  if (!existsSync(config.baseDir)) {
    mkdirSync(config.baseDir, { recursive: true });
    console.log(`Created base directory: ${config.baseDir}`);
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
 * Copy rules template files to the rules directory if they don't exist
 * @param {Object} dirs - Directory paths object
 */
export function initializeRules(dirs) {
  const templatesPath = getRulesTemplatesPath();
  const rulesPath = dirs.rules;

  if (!existsSync(templatesPath)) {
    console.warn('Rules templates directory not found. Skipping rules initialization.');
    return;
  }

  const templateFiles = readdirSync(templatesPath).filter(f => f.endsWith('.txt'));

  for (const file of templateFiles) {
    const sourcePath = join(templatesPath, file);
    const destPath = join(rulesPath, file);

    if (!existsSync(destPath)) {
      copyFileSync(sourcePath, destPath);
      console.log(`Initialized rules file: ${file}`);
    }
  }
}

/**
 * Run full setup - ensure directories and initialize rules
 * @returns {Object} Object with config and directory paths
 */
export function runSetup() {
  const config = loadConfig();
  const dirs = ensureDirectories(config);
  initializeRules(dirs);

  return { config, dirs };
}
