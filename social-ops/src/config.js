import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Load configuration from config.json
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  const configPath = join(projectRoot, 'config.json');

  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Validate required fields
    const requiredFields = [
      'baseDir',
      'brandName',
      'phone',
      'email',
      'brokerageLicense',
      'brokerLicense',
      'buyerProgramLine',
      'defaultLocation',
      'platforms',
      'maxHashtagsInstagram'
    ];

    for (const field of requiredFields) {
      if (config[field] === undefined) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config.json: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get the path to rules templates directory
 * @returns {string} Path to rules templates
 */
export function getRulesTemplatesPath() {
  return join(projectRoot, 'rules-templates');
}

/**
 * Get paths for all subdirectories in the social ops folder
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

export { projectRoot };
