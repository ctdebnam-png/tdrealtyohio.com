#!/usr/bin/env node

/**
 * Build Navigation Inventory
 * Scans all HTML files and extracts navigation links from various surfaces.
 * Outputs to /audit/nav-inventory.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const inventory = {
  generated: new Date().toISOString(),
  surfaces: {
    desktopHeader: [],
    mobileHamburger: [],
    footer: [],
    htmlSitemap: [],
    xmlSitemap: []
  }
};

// Parse HTML to extract nav links
function extractLinks(html, selector, surface) {
  const links = [];

  // Extract header nav links
  if (selector === 'header') {
    const navMatch = html.match(/<nav[^>]*id="main-nav"[^>]*>([\s\S]*?)<\/nav>/i);
    if (navMatch) {
      const navHtml = navMatch[1];
      const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(navHtml)) !== null) {
        links.push({
          href: match[1],
          label: match[2].trim(),
          surface: surface,
          group: null
        });
      }
    }
  }

  // Extract footer nav links
  if (selector === 'footer') {
    const footerMatch = html.match(/<footer[^>]*class="footer"[^>]*>([\s\S]*?)<\/footer>/i);
    if (footerMatch) {
      const footerHtml = footerMatch[1];

      // Extract Services group
      const servicesMatch = footerHtml.match(/<h3[^>]*>Services<\/h3>[\s\S]*?<ul[^>]*class="footer-links"[^>]*>([\s\S]*?)<\/ul>/i);
      if (servicesMatch) {
        const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(servicesMatch[1])) !== null) {
          links.push({
            href: match[1],
            label: match[2].trim(),
            surface: surface,
            group: 'Services'
          });
        }
      }

      // Extract Company group
      const companyMatch = footerHtml.match(/<h3[^>]*>Company<\/h3>[\s\S]*?<ul[^>]*class="footer-links"[^>]*>([\s\S]*?)<\/ul>/i);
      if (companyMatch) {
        const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(companyMatch[1])) !== null) {
          links.push({
            href: match[1],
            label: match[2].trim(),
            surface: surface,
            group: 'Company'
          });
        }
      }

      // Extract legal links
      const legalMatch = footerHtml.match(/<div[^>]*class="footer-legal"[^>]*>([\s\S]*?)<\/div>/i);
      if (legalMatch) {
        const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(legalMatch[1])) !== null) {
          links.push({
            href: match[1],
            label: match[2].trim(),
            surface: surface,
            group: 'Legal'
          });
        }
      }
    }
  }

  return links;
}

// Read index.html for main nav surfaces
const indexPath = path.join(ROOT, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

// Desktop header = Mobile hamburger (same nav element)
inventory.surfaces.desktopHeader = extractLinks(indexHtml, 'header', 'desktopHeader');
inventory.surfaces.mobileHamburger = extractLinks(indexHtml, 'header', 'mobileHamburger');

// Footer
inventory.surfaces.footer = extractLinks(indexHtml, 'footer', 'footer');

// HTML Sitemap page
const sitemapPagePath = path.join(ROOT, 'sitemap-page/index.html');
if (fs.existsSync(sitemapPagePath)) {
  const sitemapHtml = fs.readFileSync(sitemapPagePath, 'utf-8');

  // Extract all links from sitemap sections
  const sitemapLinks = [];
  const sectionRegex = /<div[^>]*class="sitemap-section"[^>]*>[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<ul[^>]*class="sitemap-list"[^>]*>([\s\S]*?)<\/ul>/gi;

  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(sitemapHtml)) !== null) {
    const groupName = sectionMatch[1].trim();
    const linksHtml = sectionMatch[2];

    const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(linksHtml)) !== null) {
      sitemapLinks.push({
        href: linkMatch[1],
        label: linkMatch[2].trim(),
        surface: 'htmlSitemap',
        group: groupName
      });
    }
  }

  inventory.surfaces.htmlSitemap = sitemapLinks;
}

// XML Sitemap
const xmlSitemapPath = path.join(ROOT, 'sitemap.xml');
if (fs.existsSync(xmlSitemapPath)) {
  const xmlContent = fs.readFileSync(xmlSitemapPath, 'utf-8');
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xmlContent)) !== null) {
    const url = match[1].replace('https://tdrealtyohio.com', '');
    inventory.surfaces.xmlSitemap.push({
      href: url || '/',
      label: null,
      surface: 'xmlSitemap',
      group: null
    });
  }
}

// Write inventory
const outputPath = path.join(ROOT, 'audit/nav-inventory.json');
fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2));

console.log('Navigation inventory built successfully.');
console.log(`  Desktop header: ${inventory.surfaces.desktopHeader.length} links`);
console.log(`  Footer: ${inventory.surfaces.footer.length} links`);
console.log(`  HTML Sitemap: ${inventory.surfaces.htmlSitemap.length} links`);
console.log(`  XML Sitemap: ${inventory.surfaces.xmlSitemap.length} URLs`);
console.log(`Output: ${outputPath}`);
