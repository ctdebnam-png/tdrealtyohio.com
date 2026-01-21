import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Default configuration values
const DEFAULTS = {
  defaultLocation: 'Central Ohio',
  platforms: ['Facebook', 'LinkedIn', 'Instagram', 'Google Business Profile'],
  maxHashtagsInstagram: 8
};

/**
 * Load brand configuration from shared/config/brand.json
 * @returns {Object} Brand configuration object
 */
export function loadBrandConfig() {
  const brandPath = join(projectRoot, 'shared', 'config', 'brand.json');

  if (!existsSync(brandPath)) {
    throw new Error(`Brand configuration not found: ${brandPath}`);
  }

  try {
    const content = readFileSync(brandPath, 'utf-8');
    const brand = JSON.parse(content);

    // Validate required brand fields
    const requiredFields = [
      'brandName',
      'phone',
      'email',
      'brokerageLicense',
      'brokerLicense',
      'equalHousingLine',
      'buyerProgramLine'
    ];

    for (const field of requiredFields) {
      if (!brand[field]) {
        throw new Error(`Missing required brand field: ${field}`);
      }
    }

    return brand;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in brand.json: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Build full configuration by merging brand config with defaults and CLI options
 * @param {string} baseDir - Base directory from CLI or default
 * @returns {Object} Full configuration object
 */
export function buildConfig(baseDir) {
  const brand = loadBrandConfig();

  return {
    baseDir: resolve(baseDir),
    ...brand,
    ...DEFAULTS
  };
}

/**
 * Get the path to shared rules directory
 * @returns {string} Path to shared rules
 */
export function getSharedRulesPath() {
  return join(projectRoot, 'shared', 'rules');
}

/**
 * Get paths for all subdirectories in the working folder
 * @param {string} baseDir - Base directory path
 * @returns {Object} Object with all directory paths
 */
export function getDirectoryPaths(baseDir) {
  return {
    inbox: join(baseDir, 'inbox'),
    ready: join(baseDir, 'ready'),
    captions: join(baseDir, 'captions'),
    scheduled: join(baseDir, 'scheduled'),
    archive: join(baseDir, 'archive'),
    rules: join(baseDir, 'rules')
  };
}

/**
 * Get default base directory (user's home + TD_Realty_Social)
 * @returns {string} Default base directory path
 */
export function getDefaultBaseDir() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  return join(homeDir, 'TD_Realty_Social');
}

export { projectRoot };
