/**
 * blog-discovery.mjs
 *
 * Detects the blog system format and enumerates all existing blog posts.
 * Returns structured metadata for each post without modifying any files.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as cheerioLoad } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BLOG_DIR = join(ROOT, 'blog');

/**
 * Discover all blog posts and their metadata.
 *
 * @returns {{ type: string, posts: Array<{ slug: string, path: string, filePath: string, title: string, description: string, date: string, tags: string[], dataTopic: string }> }}
 */
export function discoverBlog() {
  try {
    const entries = readdirSync(BLOG_DIR, { withFileTypes: true });
    const posts = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'index.html') continue; // skip blog index itself

      const slug = entry.name;
      const filePath = join(BLOG_DIR, slug, 'index.html');

      try {
        statSync(filePath);
      } catch {
        // No index.html in this directory — skip
        continue;
      }

      const html = readFileSync(filePath, 'utf-8');
      const meta = extractPostMeta(html, slug);
      posts.push(meta);
    }

    // Sort by date descending (newest first)
    posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return { type: 'html', posts };
  } catch (err) {
    console.log(`[blog-discovery] blog discovery skipped: ${err.message}`);
    return { type: 'unknown', posts: [] };
  }
}

/**
 * Extract metadata from a blog post HTML file.
 */
function extractPostMeta(html, slug) {
  const $ = cheerioLoad(html);
  const path = `/blog/${slug}/`;
  const filePath = join(BLOG_DIR, slug, 'index.html');

  // Title from <title> tag, strip " | TD Realty Ohio" suffix
  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*\|\s*TD Realty Ohio$/, '');

  // Meta description
  const description = $('meta[name="description"]').attr('content') || '';

  // Date: prefer article:modified_time, then datePublished from JSON-LD
  let date = $('meta[property="article:modified_time"]').attr('content') || '';

  if (!date) {
    // Try JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const ld = JSON.parse($(el).html());
        if (ld['@type'] === 'Article' && ld.datePublished) {
          date = ld.datePublished;
        }
      } catch { /* skip invalid JSON-LD */ }
    });
  }

  // Keywords from <meta name="keywords">
  const keywordsRaw = $('meta[name="keywords"]').attr('content') || '';
  const tags = keywordsRaw
    ? keywordsRaw.split(',').map(k => k.trim()).filter(Boolean)
    : [];

  // data-topic from the blog card reference (blog index) — not available here,
  // but we can infer from the post content or keywords
  const dataTopic = inferTopic(tags, title, description);

  // Word count estimate
  const articleContent = $('.article-content').text() || '';
  const wordCount = articleContent.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    path,
    filePath,
    title,
    description,
    date,
    tags,
    dataTopic,
    wordCount,
  };
}

/**
 * Infer the blog topic category from tags, title, and description.
 */
function inferTopic(tags, title, description) {
  const text = [
    ...tags,
    title,
    description,
  ].join(' ').toLowerCase();

  if (text.includes('buyer') || text.includes('buying') || text.includes('homebuyer') || text.includes('cash back')) {
    return 'buyer';
  }
  if (text.includes('agent') || text.includes('brokerage') || text.includes('commission split')) {
    return 'agent';
  }
  // Default to seller since most content is seller-focused
  return 'seller';
}
