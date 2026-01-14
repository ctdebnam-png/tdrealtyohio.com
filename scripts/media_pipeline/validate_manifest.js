#!/usr/bin/env node

/**
 * Validate manifest.json against schema
 */

const fs = require('fs').promises;
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const MANIFEST_FILE = 'assets/media/manifest.json';
const SCHEMA_FILE = 'assets/media/manifest-schema.json';

async function main() {
  console.log('🔍 Validating manifest.json...\n');

  try {
    // Load files
    const manifestData = await fs.readFile(MANIFEST_FILE, 'utf8');
    const manifest = JSON.parse(manifestData);

    const schemaData = await fs.readFile(SCHEMA_FILE, 'utf8');
    const schema = JSON.parse(schemaData);

    // Validate
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    const valid = validate(manifest);

    if (!valid) {
      console.error('❌ Manifest validation failed:\n');
      for (const error of validate.errors) {
        console.error(`  ${error.instancePath || 'root'}: ${error.message}`);
        if (error.params) {
          console.error(`    ${JSON.stringify(error.params)}`);
        }
      }
      process.exit(1);
    }

    console.log('✅ Manifest is valid!');
    console.log(`   Pages: ${Object.keys(manifest.pages).length}`);
    console.log(`   Version: ${manifest.version}`);
    console.log(`   Generated: ${manifest.generated}`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
