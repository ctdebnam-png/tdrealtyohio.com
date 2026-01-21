import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';

/**
 * Load all rules files from the rules directory
 * @param {Object} dirs - Directory paths
 * @returns {Object} Object containing all rules content
 */
export function loadRules(dirs) {
  const rules = {
    voice: '',
    requiredFooter: '',
    requiredOffer: ''
  };

  const voicePath = join(dirs.rules, 'voice.txt');
  const footerPath = join(dirs.rules, 'required_footer.txt');
  const offerPath = join(dirs.rules, 'required_offer.txt');

  if (existsSync(voicePath)) {
    rules.voice = readFileSync(voicePath, 'utf-8');
  } else {
    console.warn('Warning: voice.txt not found in rules directory');
  }

  if (existsSync(footerPath)) {
    rules.requiredFooter = readFileSync(footerPath, 'utf-8').trim();
  } else {
    throw new Error('required_footer.txt not found in rules directory - this is required');
  }

  if (existsSync(offerPath)) {
    rules.requiredOffer = readFileSync(offerPath, 'utf-8').trim();
  } else {
    throw new Error('required_offer.txt not found in rules directory - this is required');
  }

  return rules;
}

/**
 * Build the prompt for caption generation
 * @param {Object} brief - Parsed brief data
 * @param {Object} rules - Rules content
 * @param {Object} config - Configuration
 * @param {Object} mediaInfo - Media file info
 * @returns {string} Complete prompt
 */
export function buildPrompt(brief, rules, config, mediaInfo) {
  const doNotMentionSection = brief.doNotMention.length > 0
    ? `\n\nDO NOT MENTION: ${brief.doNotMention.join(', ')}`
    : '';

  const localDetailSection = brief.localDetail
    ? `\nLocal Detail to Include: ${brief.localDetail}`
    : '';

  const notesSection = brief.notes
    ? `\nAdditional Notes: ${brief.notes}`
    : '';

  return `You are a social media copywriter for ${config.brandName}, a real estate brokerage in ${config.defaultLocation}.

VOICE AND STYLE GUIDELINES:
${rules.voice}

REQUIRED ELEMENTS (must appear exactly once in each platform version):
1. Buyer Program Line: "${rules.requiredOffer}"
2. Footer: "${rules.requiredFooter}"

MEDIA CONTEXT:
- File: ${mediaInfo.filename}
- Post Type: ${brief.postType}
- Location: ${brief.location}${localDetailSection}${notesSection}${doNotMentionSection}

TASK:
Generate social media captions for this real estate post. Create five versions:

1. MASTER CAPTION (80-140 words)
   - This is the core message that will be adapted for each platform
   - Must include the buyer program line naturally integrated
   - Must end with the required footer on its own line

2. FACEBOOK VERSION
   - Conversational and engaging
   - Can be slightly longer
   - Must include buyer program line exactly once
   - Must end with the required footer on its own line

3. LINKEDIN VERSION
   - Professional tone
   - Focus on value and expertise
   - Must include buyer program line exactly once
   - Must end with the required footer on its own line

4. INSTAGRAM VERSION
   - Include strategic line breaks for readability
   - End with up to ${config.maxHashtagsInstagram} relevant hashtags
   - Hashtags should be real estate and location-specific
   - Must include buyer program line exactly once
   - Must end with the required footer on its own line (before hashtags)

5. GOOGLE BUSINESS PROFILE VERSION
   - Must be under 1500 characters total
   - Local SEO focused
   - Must include buyer program line exactly once
   - Must end with the required footer on its own line

CRITICAL RULES:
- Do NOT invent statistics or market data
- Do NOT make guarantees or promises
- Do NOT use steering language or protected-class references
- Do NOT use superlatives like "best," "top," "leading"
- The buyer program line must appear EXACTLY ONCE in each version (not more, not less)
- The footer must appear EXACTLY ONCE at the end of each version
- If the brief doesn't provide specific numbers, keep market references general

Format your response as:

=== MASTER CAPTION ===
[Your master caption here]

=== FACEBOOK ===
[Your Facebook caption here]

=== LINKEDIN ===
[Your LinkedIn caption here]

=== INSTAGRAM ===
[Your Instagram caption here]

=== GOOGLE BUSINESS PROFILE ===
[Your GBP caption here]`;
}

/**
 * Generate captions using Anthropic API
 * @param {Object} brief - Parsed brief data
 * @param {Object} rules - Rules content
 * @param {Object} config - Configuration
 * @param {Object} mediaInfo - Media file info
 * @returns {Promise<string>} Generated captions
 */
export async function generateCaptions(brief, rules, config, mediaInfo) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(brief, rules, config, mediaInfo);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent) {
      throw new Error('No text content in Anthropic response');
    }

    return textContent.text;
  } catch (error) {
    if (error.status === 401) {
      throw new Error('Invalid ANTHROPIC_API_KEY - authentication failed');
    }
    if (error.status === 429) {
      throw new Error('Rate limited by Anthropic API - please wait and try again');
    }
    throw error;
  }
}

/**
 * Write generated captions to final file
 * @param {string} basename - Media file basename
 * @param {string} captions - Generated captions content
 * @param {Object} dirs - Directory paths
 */
export function writeFinalCaptions(basename, captions, dirs) {
  const finalPath = join(dirs.captions, `${basename}.final.txt`);
  const timestamp = new Date().toISOString();

  const content = `# Generated Captions for: ${basename}
# Generated at: ${timestamp}
#
# Copy the relevant section for each platform.
# The footer and buyer program line are already included.

${captions}
`;

  writeFileSync(finalPath, content, 'utf-8');
  console.log(`Wrote captions: ${basename}.final.txt`);
}

/**
 * Move media file from inbox to ready
 * @param {Object} mediaInfo - Media file info
 * @param {Object} dirs - Directory paths
 */
export function moveToReady(mediaInfo, dirs) {
  const destPath = join(dirs.ready, mediaInfo.filename);

  // Handle collision in ready folder
  let finalDestPath = destPath;
  let counter = 1;
  while (existsSync(finalDestPath)) {
    const parsed = parse(mediaInfo.filename);
    finalDestPath = join(dirs.ready, `${parsed.name}_${counter}${parsed.ext}`);
    counter++;
  }

  renameSync(mediaInfo.path, finalDestPath);
  console.log(`Moved to ready: ${mediaInfo.filename}`);
}

/**
 * Process a single media file - generate captions and move to ready
 * @param {Object} mediaInfo - Media file info
 * @param {Object} brief - Parsed brief data
 * @param {Object} rules - Rules content
 * @param {Object} config - Configuration
 * @param {Object} dirs - Directory paths
 * @returns {Promise<boolean>} True if successful
 */
export async function processMediaFile(mediaInfo, brief, rules, config, dirs) {
  try {
    console.log(`\nProcessing: ${mediaInfo.filename}`);
    console.log(`  Post type: ${brief.postType}`);
    console.log(`  Location: ${brief.location}`);

    // Generate captions
    console.log('  Generating captions...');
    const captions = await generateCaptions(brief, rules, config, mediaInfo);

    // Write final captions
    writeFinalCaptions(mediaInfo.basename, captions, dirs);

    // Move media to ready
    moveToReady(mediaInfo, dirs);

    console.log(`  ✓ Complete`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed: ${error.message}`);
    // Don't move file out of inbox on failure
    return false;
  }
}

// Need to import parse for moveToReady
import { parse } from 'path';
