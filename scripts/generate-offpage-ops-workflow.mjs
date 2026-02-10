#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PRIORITY_FILE = path.join(ROOT, 'ops', 'offpage', 'priority-urls.json');
const REPORT_FILE = path.join(ROOT, 'ops', 'reports', 'offpage-ops-workflow.json');
const LOG_DIR = path.join(ROOT, 'ops', 'logs', 'offpage');
const CHECKLIST_DIR = path.join(ROOT, 'ops', 'checklists');

function isoTimestamp() {
  return new Date().toISOString();
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function cityFromCluster(cluster) {
  return cluster
    .replace('/areas/', '')
    .replace(/\//g, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toChecklistMarkdown({ generatedAt, priorities }) {
  const lines = [];
  lines.push('# Off-Page SEO Operations Checklist');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('Use this checklist as the single artifact for weekly ops standups.');
  lines.push('Mark each checkbox complete and copy completion updates into `ops/logs/offpage/*.jsonl`.');
  lines.push('');

  priorities.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.url}`);
    lines.push(`- City cluster: ${item.cityCluster}`);
    lines.push(`- Primary service angle: ${item.primaryService}`);
    lines.push(`- GBP post/topic alignment: ${item.offPageActions.gbpTopic}`);
    lines.push(`- Citation consistency checks: ${item.offPageActions.citationChecks.join('; ')}`);
    lines.push(`- Review-generation prompt: ${item.offPageActions.reviewPrompt}`);
    lines.push(`- Local partnership/link opportunities: ${item.offPageActions.partnershipTargets.join('; ')}`);
    lines.push('');
    lines.push('- [ ] Publish GBP post and link to this URL');
    lines.push('- [ ] Complete citation audit + NAP verification');
    lines.push('- [ ] Send 3 review prompts tied to primary service');
    lines.push('- [ ] Reach out to 2 local partners for backlink opportunities');
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function createLogLines({ generatedAt, priorities }) {
  return priorities
    .map((item) => {
      const base = {
        timestamp: generatedAt,
        url: item.url,
        cityCluster: item.cityCluster,
        status: 'planned',
        tasks: {
          gbpPost: 'pending',
          citationCheck: 'pending',
          reviewPrompt: 'pending',
          partnershipOutreach: 'pending'
        },
        notes: 'Initial plan generated. Update statuses as each action ships.'
      };
      return JSON.stringify(base);
    })
    .join('\n');
}

async function main() {
  const generatedAt = isoTimestamp();
  const priorityRaw = await readFile(PRIORITY_FILE, 'utf8');
  const source = JSON.parse(priorityRaw);

  const priorities = source.priorityUrls.map((item) => ({
    ...item,
    cityLabel: cityFromCluster(item.cityCluster)
  }));

  const report = {
    generatedAt,
    workflow: 'off-page-authority-actions',
    summary: {
      totalPriorityUrls: priorities.length,
      actionTypes: [
        'gbp-post-topic-alignment',
        'citation-consistency-checks',
        'review-generation-prompts',
        'local-partnership-link-opportunities'
      ]
    },
    priorities
  };

  await mkdir(path.dirname(REPORT_FILE), { recursive: true });
  await mkdir(LOG_DIR, { recursive: true });
  await mkdir(CHECKLIST_DIR, { recursive: true });

  await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const stamp = compactTimestamp(generatedAt);
  const checklistFile = path.join(CHECKLIST_DIR, `offpage-actions-checklist-${stamp}.md`);
  await writeFile(checklistFile, toChecklistMarkdown({ generatedAt, priorities }), 'utf8');

  const logFile = path.join(LOG_DIR, `${stamp}-offpage-actions.jsonl`);
  await writeFile(logFile, `${createLogLines({ generatedAt, priorities })}\n`, 'utf8');

  console.log(`Wrote report: ${path.relative(ROOT, REPORT_FILE)}`);
  console.log(`Wrote checklist: ${path.relative(ROOT, checklistFile)}`);
  console.log(`Wrote log: ${path.relative(ROOT, logFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
