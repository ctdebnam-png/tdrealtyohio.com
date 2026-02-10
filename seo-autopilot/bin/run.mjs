#!/usr/bin/env node
/**
 * SEO Autopilot — main entry point
 *
 * This script is invoked by the seo-autopilot GitHub Actions workflow.
 * It always exits 0 so the workflow never fails.
 *
 * Pipeline:
 * 1. Detect build output directory
 * 2. Run before-audit + link graph
 * 3. Apply metadata fixer (OG/Twitter tags)
 * 4. Generate link plan + apply internal link insertions
 * 5. Run after-audit + link graph and compute diff
 * 6. Write report with before/after comparison
 */

import { readFileSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { detectBuildOutput } from '../lib/detect-build-output.mjs';
import { listHtmlPages } from '../lib/list-html-pages.mjs';
import { runBuildAudit, printAuditSummary } from '../auditors/build-audit.mjs';
import { buildLinkGraph, printLinkGraphSummary } from '../auditors/link-graph.mjs';
import { fixMetadata } from '../fixers/metadata-fixer.mjs';
import { generateLinkPlan } from '../planners/link-plan.mjs';
import { applyInternalLinks } from '../fixers/internal-links.mjs';
import { pullGscData } from '../collectors/gsc.mjs';
import { computeOpportunities, buildPageSnapshots } from '../analyzers/gsc-opportunities.mjs';
import { selectCandidates } from '../experiments/select-candidates.mjs';
import { generateVariant } from '../experiments/generate-variant.mjs';
import { applyVariant } from '../experiments/apply-variant.mjs';
import { evaluateExperiments } from '../experiments/evaluate.mjs';
import { discoverBlog } from '../lib/blog-discovery.mjs';
import { planContent } from '../planners/content-plan.mjs';
import { refreshBlogPost, refreshMoneyPage } from '../generators/refresh.mjs';
import { publishPost } from '../generators/publish-post.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REPORT_DIR = join(__dirname, '..', 'report');
const CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');
const PILLARS_PATH = join(__dirname, '..', 'config', 'pillars.json');
const BACKLOG_PATH = join(__dirname, '..', 'config', 'content-backlog.json');
const SEO_DEFAULTS_PATH = join(__dirname, '..', 'config', 'seo-defaults.json');
const RELATED_GUIDES_PATH = join(__dirname, '..', 'config', 'related-guides.json');

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    console.warn('[seo-autopilot] Could not load site.json — using defaults');
    return { baseUrl: '', canonicalStrategy: 'slash', rankIntentRoutes: [], utilityRoutesNoIndex: [] };
  }
}

function loadPillars() {
  try {
    return JSON.parse(readFileSync(PILLARS_PATH, 'utf-8'));
  } catch {
    console.warn('[seo-autopilot] Could not load pillars.json — using defaults');
    return { pillars: [], rules: { maxNewLinksPerRun: 3, maxLinksAddedPerFile: 2, minAnchorLength: 4 } };
  }
}

function loadBacklog() {
  try {
    return JSON.parse(readFileSync(BACKLOG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function loadSeoDefaults() {
  try {
    return JSON.parse(readFileSync(SEO_DEFAULTS_PATH, 'utf-8'));
  } catch {
    return { baseUrl: 'https://tdrealtyohio.com' };
  }
}

function loadRelatedGuides() {
  try {
    return JSON.parse(readFileSync(RELATED_GUIDES_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Compute the diff between before and after issue counts.
 */
function computeDiff(before, after) {
  const diff = {};
  const allCodes = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const code of allCodes) {
    const b = (before || {})[code] || 0;
    const a = (after || {})[code] || 0;
    if (b !== a) {
      diff[code] = { before: b, after: a, delta: a - b };
    }
  }
  return diff;
}

/**
 * Extract summary from link graph for reporting.
 */
function linkGraphSummary(graph) {
  return {
    pagesInGraph: graph.pagesInGraph,
    edgesInGraph: graph.edgesInGraph,
    orphanCount: graph.orphanCount,
    topUnderlinked: graph.topUnderlinked,
    topLinkSources: graph.topLinkSources.slice(0, 10),
    brokenEdgesSample: graph.brokenEdgesSample,
  };
}

async function main() {
  const start = Date.now();
  console.log('[seo-autopilot] Starting run…');

  // Ensure directories exist
  await mkdir(REPORT_DIR, { recursive: true });
  await mkdir(join(__dirname, '..', 'state'), { recursive: true });

  const config = loadConfig();
  const pillars = loadPillars();

  const report = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    buildOutput: null,
    beforeAudit: null,
    afterAudit: null,
    diff: null,
    fixerResults: null,
    linkGraphBefore: null,
    linkGraphAfter: null,
    linkActionsApplied: [],
    budgetUsed: { linksAdded: 0, filesEdited: 0 },
    notes: '',
    errors: [],
  };

  // Step 1: Detect build output
  let buildOutput;
  try {
    buildOutput = detectBuildOutput(ROOT);
  } catch (err) {
    buildOutput = { outputDir: ROOT, mode: 'unknown', reason: `Detection error: ${err.message}` };
    report.errors.push(`detectBuildOutput: ${err.message}`);
  }
  report.buildOutput = buildOutput;
  console.log(`[seo-autopilot] Build output: ${buildOutput.mode} — ${buildOutput.reason}`);

  if (buildOutput.mode === 'static-html') {
    let pages;

    // Step 2: Before-audit + link graph
    try {
      pages = listHtmlPages(buildOutput.outputDir, {
        canonicalStrategy: config.canonicalStrategy,
      });
      console.log(`[seo-autopilot] Found ${pages.length} HTML page(s)`);

      const beforeAudit = runBuildAudit(pages, config);
      report.beforeAudit = {
        pagesScanned: beforeAudit.totals.pagesScanned,
        issuesTotal: beforeAudit.totals.issuesTotal,
        issueCounts: beforeAudit.totals.issueCounts,
      };

      console.log('\n=== BEFORE FIXES ===');
      printAuditSummary(beforeAudit);
    } catch (err) {
      report.errors.push(`beforeAudit: ${err.message}`);
      console.error('[seo-autopilot] Before-audit error (non-fatal):', err.message);
    }

    // Link graph before fixes
    let linkGraphBefore;
    if (pages) {
      try {
        linkGraphBefore = buildLinkGraph(pages, config);
        report.linkGraphBefore = linkGraphSummary(linkGraphBefore);
        console.log('\n=== LINK GRAPH (BEFORE) ===');
        printLinkGraphSummary(linkGraphBefore);
      } catch (err) {
        report.errors.push(`linkGraphBefore: ${err.message}`);
        console.error('[seo-autopilot] Link graph error (non-fatal):', err.message);
      }
    }

    // Step 3: Apply metadata fixer
    if (pages) {
      try {
        const fixResult = fixMetadata(pages);
        report.fixerResults = {
          filesChanged: fixResult.filesChanged,
          tagsAdded: fixResult.tagsAdded,
          details: fixResult.details,
        };
        console.log(`[seo-autopilot] Metadata fixer: ${fixResult.filesChanged} file(s) changed, ${fixResult.tagsAdded} tag(s) added`);
      } catch (err) {
        report.errors.push(`metadataFixer: ${err.message}`);
        console.error('[seo-autopilot] Metadata fixer error (non-fatal):', err.message);
      }
    }

    // Step 4: Generate link plan + apply
    if (linkGraphBefore) {
      try {
        const { actions } = generateLinkPlan(linkGraphBefore, config, pillars);

        if (actions.length > 0) {
          console.log(`\n[seo-autopilot] Link plan: ${actions.length} action(s)`);
          for (const a of actions) {
            console.log(`  ${a.fromPath} -> ${a.toPath} ("${a.anchorText}")`);
          }

          const linkResult = applyInternalLinks(actions);
          report.linkActionsApplied = linkResult.details.filter((d) => d.status === 'added');
          report.budgetUsed = {
            linksAdded: linkResult.linksAdded,
            filesEdited: linkResult.filesEdited,
          };
          console.log(`[seo-autopilot] Internal links: ${linkResult.linksAdded} link(s) added, ${linkResult.filesEdited} file(s) edited`);
        } else {
          console.log('\n[seo-autopilot] Link plan: no actions needed');
        }
      } catch (err) {
        report.errors.push(`linkPlan: ${err.message}`);
        console.error('[seo-autopilot] Link plan error (non-fatal):', err.message);
      }
    }

    // Step 5: GSC data collection + opportunity analysis
    try {
      console.log('\n=== GSC DATA COLLECTION ===');
      const gscResult = await pullGscData();

      if (gscResult.ok) {
        console.log(`[gsc] Pulled at: ${gscResult.pulledAt}`);
        console.log(`[gsc] 28d: ${gscResult.totals28.clicks} clicks, ${gscResult.totals28.impressions} impressions, CTR ${(gscResult.totals28.ctr * 100).toFixed(2)}%, pos ${gscResult.totals28.position.toFixed(1)}`);
        console.log(`[gsc]  7d: ${gscResult.totals7.clicks} clicks, ${gscResult.totals7.impressions} impressions, CTR ${(gscResult.totals7.ctr * 100).toFixed(2)}%, pos ${gscResult.totals7.position.toFixed(1)}`);

        // Compute opportunities
        const opportunities = computeOpportunities(gscResult);
        console.log(`[gsc] High impressions / low CTR pages: ${opportunities.highImpressionsLowCtrPages.length}`);
        console.log(`[gsc] Striking distance queries: ${opportunities.strikingDistanceQueries.length}`);
        console.log(`[gsc] Declining pages: ${opportunities.decliningPages.length}`);

        // Top 5 CTR opportunities
        if (opportunities.highImpressionsLowCtrPages.length > 0) {
          console.log('\n[gsc] Top CTR opportunities:');
          for (const p of opportunities.highImpressionsLowCtrPages.slice(0, 5)) {
            console.log(`  ${p.path} — ${p.impressions28} imp, CTR ${(p.ctr28 * 100).toFixed(2)}%`);
          }
        }

        // Build page snapshots and update state
        const snapshots = buildPageSnapshots(gscResult, config.baseUrl, config.canonicalStrategy);
        const statePath = join(__dirname, '..', 'state', 'state.json');
        let state = {};
        try { state = JSON.parse(readFileSync(statePath, 'utf-8')); } catch { /* new state */ }
        state.gsc = {
          lastPulledAt: gscResult.pulledAt,
          totals28: gscResult.totals28,
          totals7: gscResult.totals7,
          pageSnapshots: snapshots,
          opportunities: {
            highImpressionsLowCtrPages: opportunities.highImpressionsLowCtrPages,
            strikingDistanceQueries: opportunities.strikingDistanceQueries,
            decliningPages: opportunities.decliningPages,
          },
        };
        await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');

        report.gsc = {
          ok: true,
          skipped: false,
          pulledAt: gscResult.pulledAt,
          totals28: gscResult.totals28,
          totals7: gscResult.totals7,
          opportunityCounts: {
            ctrPages: opportunities.highImpressionsLowCtrPages.length,
            strikingQueries: opportunities.strikingDistanceQueries.length,
            decliningPages: opportunities.decliningPages.length,
          },
        };
      } else {
        const reason = gscResult.reason || 'unknown';
        console.log(`[gsc] Skipped: ${reason}`);
        report.gsc = { ok: false, skipped: gscResult.skipped, reason };
      }
    } catch (err) {
      report.errors.push(`gsc: ${err.message}`);
      report.gsc = { ok: false, skipped: false, reason: err.message };
      console.error('[seo-autopilot] GSC error (non-fatal):', err.message);
    }

    // Step 6: Experiment evaluation + new experiments
    report.experiments = { applied: [], evaluated: [] };
    try {
      // 6a: Evaluate existing running experiments
      const statePath = join(__dirname, '..', 'state', 'state.json');
      let currentState = {};
      try { currentState = JSON.parse(readFileSync(statePath, 'utf-8')); } catch { /* new state */ }
      const pageSnapshots = currentState.gsc?.pageSnapshots || {};

      const evalResults = evaluateExperiments(pageSnapshots);
      if (evalResults.length > 0) {
        console.log('\n=== EXPERIMENT EVALUATIONS ===');
        for (const ev of evalResults) {
          console.log(`  ${ev.path}: ${ev.result} — ${ev.notes}`);
        }
        report.experiments.evaluated = evalResults;
      }

      // 6b: Select candidates and apply new experiments (only if GSC data is available)
      const opportunities = currentState.gsc?.opportunities?.highImpressionsLowCtrPages || [];
      if (opportunities.length > 0) {
        const experimentsConfigPath = join(__dirname, '..', 'config', 'experiments.json');
        let experimentsConfig = {};
        try { experimentsConfig = JSON.parse(readFileSync(experimentsConfigPath, 'utf-8')); } catch { /* defaults */ }

        const experimentsStatePath = join(__dirname, '..', 'state', 'experiments.json');
        let experimentsState = {};
        try { experimentsState = JSON.parse(readFileSync(experimentsStatePath, 'utf-8')); } catch { /* defaults */ }

        const candidates = selectCandidates({
          opportunities,
          experimentsConfig,
          experimentsState,
          siteConfig: config,
        });

        if (candidates.length > 0) {
          console.log(`\n=== EXPERIMENT CANDIDATES: ${candidates.length} ===`);
          let applied = 0;
          const maxChanges = experimentsConfig.maxMetaChangesPerRun || 3;

          for (const candidate of candidates) {
            if (applied >= maxChanges) break;

            const variant = generateVariant({
              path: candidate.path,
              existingTitle: '', // Will be looked up from route registry
              existingDescription: '',
              topQueries: candidate.topQueries || [],
              ctr28: candidate.ctr28,
            });

            if (variant) {
              const baseline = pageSnapshots[candidate.path] || {
                impressions7: 0, clicks7: 0,
                ctr7: candidate.ctr28, pos7: candidate.pos28,
              };

              applyVariant({
                path: candidate.path,
                title: variant.chosen.title,
                description: variant.chosen.description,
                existingTitle: variant.variantA.title !== variant.chosen.title ? variant.variantA.title : '',
                existingDescription: '',
                baseline: {
                  impressions7: baseline.impressions7 || 0,
                  clicks7: baseline.clicks7 || 0,
                  ctr7: baseline.ctr7 || 0,
                  pos7: baseline.pos7 || 0,
                },
              });

              report.experiments.applied.push({
                path: candidate.path,
                title: variant.chosen.title,
                description: variant.chosen.description,
              });
              applied++;
              console.log(`  Applied: ${candidate.path} — "${variant.chosen.title}"`);
            }
          }

          if (applied === 0) {
            console.log('  No viable variants generated');
          }
        } else {
          console.log('\n[experiments] No eligible candidates');
        }
      } else {
        console.log('\n[experiments] No GSC opportunities available — skipping experiments');
      }
    } catch (err) {
      report.errors.push(`experiments: ${err.message}`);
      console.error('[seo-autopilot] Experiments error (non-fatal):', err.message);
    }

    // Step 7: Content clusters — blog discovery, planning, and execution
    report.content = { action: 'none', target: null, reason: '', filesEdited: [], wordsAdded: 0 };
    try {
      console.log('\n=== CONTENT ENGINE ===');

      // 7a: Blog discovery
      const blogResult = discoverBlog();
      console.log(`[content] Blog type: ${blogResult.type}, ${blogResult.posts.length} post(s) found`);

      // 7b: Content planning
      const backlog = loadBacklog();
      const seoDefaults = loadSeoDefaults();

      // Load state for content tracking
      const contentStatePath = join(__dirname, '..', 'state', 'state.json');
      let contentState = {};
      try { contentState = JSON.parse(readFileSync(contentStatePath, 'utf-8')); } catch { /* new */ }

      // Build audit result for tech gate (need pages array with issues)
      let auditForGate = null;
      if (pages) {
        try {
          const gateAudit = runBuildAudit(pages, config);
          auditForGate = gateAudit;
        } catch { /* skip gate check */ }
      }

      const strikingDistanceQueries = contentState.gsc?.opportunities?.strikingDistanceQueries || [];

      const contentPlan = planContent({
        strikingDistanceQueries,
        backlog,
        blogPosts: blogResult.posts,
        rankIntentRoutes: config.rankIntentRoutes || [],
        auditResult: auditForGate,
        state: contentState,
        linkGraph: linkGraphBefore,
      });

      console.log(`[content] Plan: ${contentPlan.action} — ${contentPlan.reason}`);
      report.content.action = contentPlan.action;
      report.content.target = contentPlan.target;
      report.content.reason = contentPlan.reason;

      // 7c: Execute the content action
      if (contentPlan.action === 'refresh-post' && contentPlan.target) {
        const targetPath = contentPlan.target.pathOrSlug;
        const post = blogResult.posts.find(p => p.path === targetPath);
        if (post) {
          const result = refreshBlogPost({
            filePath: post.filePath,
            query: contentPlan.target.query,
            internalLinksTo: contentPlan.target.internalLinksTo || [],
            rankIntentRoutes: config.rankIntentRoutes || [],
          });
          console.log(`[content] Refresh blog post: ${result.reason} (${result.wordsAdded} words)`);
          report.content.filesEdited = result.filesEdited;
          report.content.wordsAdded = result.wordsAdded;

          // Update state
          contentState.content = contentState.content || {};
          contentState.content.lastActionAt = new Date().toISOString();
          contentState.content.lastRefreshAt = new Date().toISOString();
          contentState.content.lastTargets = [{ path: targetPath, action: 'refresh-post' }];
          await writeFile(contentStatePath, JSON.stringify(contentState, null, 2) + '\n');
        }
      } else if (contentPlan.action === 'refresh-page' && contentPlan.target) {
        const result = refreshMoneyPage({
          routePath: contentPlan.target.pathOrSlug,
          query: contentPlan.target.query,
          internalLinksTo: contentPlan.target.internalLinksTo || [],
        });
        console.log(`[content] Refresh money page: ${result.reason} (${result.wordsAdded} words)`);
        report.content.filesEdited = result.filesEdited;
        report.content.wordsAdded = result.wordsAdded;

        // Update state
        contentState.content = contentState.content || {};
        contentState.content.lastActionAt = new Date().toISOString();
        contentState.content.lastRefreshAt = new Date().toISOString();
        contentState.content.lastTargets = [{ path: contentPlan.target.pathOrSlug, action: 'refresh-page' }];
        await writeFile(contentStatePath, JSON.stringify(contentState, null, 2) + '\n');
      } else if (contentPlan.action === 'publish-post' && contentPlan.target) {
        const result = publishPost({
          topic: {
            topicId: contentPlan.target.topicId,
            primaryIntent: contentPlan.target.primaryIntent,
            targetQueryHints: contentPlan.target.targetQueryHints,
            requiredSections: contentPlan.target.requiredSections,
            internalLinksTo: contentPlan.target.internalLinksTo,
          },
          clusterId: contentPlan.target.clusterId,
          pillarPath: contentPlan.target.pillarPath,
          blogPosts: blogResult.posts,
          rankIntentRoutes: config.rankIntentRoutes || [],
          seoDefaults,
        });
        console.log(`[content] Publish post: ${result.reason} — ${result.slug} (${result.wordsAdded} words)`);
        report.content.filesEdited = result.filesCreated;
        report.content.wordsAdded = result.wordsAdded;

        if (result.success) {
          // Update backlog: mark topic as done
          if (backlog) {
            for (const cluster of backlog.clusters) {
              for (const t of cluster.topics) {
                if (t.topicId === contentPlan.target.topicId) {
                  t.status = 'done';
                  t.publishedAt = new Date().toISOString();
                  t.slug = result.slug;
                  t.routePath = result.routePath;
                }
              }
            }
            await writeFile(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + '\n');
          }

          // Update state
          contentState.content = contentState.content || {};
          contentState.content.lastActionAt = new Date().toISOString();
          contentState.content.lastPublishAt = new Date().toISOString();
          contentState.content.lastTargets = [{ path: result.routePath, action: 'publish-post', slug: result.slug }];
          await writeFile(contentStatePath, JSON.stringify(contentState, null, 2) + '\n');

          // Update related-guides for the cluster pillar (Step 7 from chunk spec)
          try {
            const guides = loadRelatedGuides();
            const pillar = contentPlan.target.pillarPath;
            if (pillar) {
              if (!guides[pillar]) guides[pillar] = [];
              guides[pillar].push({
                path: result.routePath,
                anchor: result.slug.replace(/-/g, ' '),
                addedAt: new Date().toISOString(),
              });
              // Cap at 10 per pillar, drop oldest
              if (guides[pillar].length > 10) {
                guides[pillar] = guides[pillar].slice(-10);
              }
              await writeFile(RELATED_GUIDES_PATH, JSON.stringify(guides, null, 2) + '\n');
              console.log(`[content] Updated related-guides for ${pillar}`);
            }
          } catch (err) {
            console.warn(`[content] Could not update related-guides: ${err.message}`);
          }
        }
      } else {
        console.log('[content] No content action taken');
      }
    } catch (err) {
      report.errors.push(`content: ${err.message}`);
      console.error('[seo-autopilot] Content engine error (non-fatal):', err.message);
    }

    // Step 8: After-audit + link graph
    if (pages) {
      try {
        const afterPages = listHtmlPages(buildOutput.outputDir, {
          canonicalStrategy: config.canonicalStrategy,
        });
        const afterAudit = runBuildAudit(afterPages, config);
        report.afterAudit = {
          pagesScanned: afterAudit.totals.pagesScanned,
          issuesTotal: afterAudit.totals.issuesTotal,
          issueCounts: afterAudit.totals.issueCounts,
          samples: afterAudit.samples,
          pages: afterAudit.pages,
        };

        console.log('\n=== AFTER FIXES ===');
        printAuditSummary(afterAudit);

        // Link graph after
        const linkGraphAfter = buildLinkGraph(afterPages, config);
        report.linkGraphAfter = linkGraphSummary(linkGraphAfter);
        console.log('=== LINK GRAPH (AFTER) ===');
        printLinkGraphSummary(linkGraphAfter);

        // Compute audit diff
        if (report.beforeAudit) {
          report.diff = computeDiff(
            report.beforeAudit.issueCounts,
            report.afterAudit.issueCounts,
          );

          const diffEntries = Object.entries(report.diff);
          if (diffEntries.length > 0) {
            console.log('=== DIFF (before -> after) ===');
            for (const [code, { before, after, delta }] of diffEntries) {
              const sign = delta > 0 ? '+' : '';
              console.log(`  ${code}: ${before} -> ${after} (${sign}${delta})`);
            }
            console.log('');
          }
        }

        // Compute link graph diff
        if (report.linkGraphBefore && report.linkGraphAfter) {
          const orphanDelta = report.linkGraphAfter.orphanCount - report.linkGraphBefore.orphanCount;
          const edgeDelta = report.linkGraphAfter.edgesInGraph - report.linkGraphBefore.edgesInGraph;
          if (orphanDelta !== 0 || edgeDelta !== 0) {
            console.log('=== LINK GRAPH DIFF ===');
            if (edgeDelta !== 0) console.log(`  Edges: ${report.linkGraphBefore.edgesInGraph} -> ${report.linkGraphAfter.edgesInGraph} (${edgeDelta > 0 ? '+' : ''}${edgeDelta})`);
            if (orphanDelta !== 0) console.log(`  Orphans: ${report.linkGraphBefore.orphanCount} -> ${report.linkGraphAfter.orphanCount} (${orphanDelta > 0 ? '+' : ''}${orphanDelta})`);
            console.log('');
          }
        }

        report.notes = `Before: ${report.beforeAudit?.issuesTotal ?? '?'} issues. After: ${afterAudit.totals.issuesTotal} issues. Links added: ${report.budgetUsed.linksAdded}. Content: ${report.content?.action || 'none'}.`;
      } catch (err) {
        report.errors.push(`afterAudit: ${err.message}`);
        console.error('[seo-autopilot] After-audit error (non-fatal):', err.message);
      }
    }
  } else if (buildOutput.mode === 'ssr-unknown') {
    report.notes = 'SSR output not available; skipping html scan.';
    console.log('[seo-autopilot] SSR output not available; skipping html scan');
  } else {
    report.notes = `Build output mode "${buildOutput.mode}" — html scan skipped.`;
    console.log(`[seo-autopilot] Mode "${buildOutput.mode}" — html scan skipped`);
  }

  report.durationMs = Date.now() - start;

  // Write report (gitignored)
  await writeFile(
    join(REPORT_DIR, 'latest.json'),
    JSON.stringify(report, null, 2) + '\n',
  );

  // Write link graph data (gitignored)
  if (report.linkGraphAfter) {
    await writeFile(
      join(REPORT_DIR, 'link-graph.json'),
      JSON.stringify(report.linkGraphAfter, null, 2) + '\n',
    );
  }

  console.log(`[seo-autopilot] Done in ${report.durationMs}ms`);
}

main().catch((err) => {
  console.error('[seo-autopilot] Unexpected error (non-fatal):', err);
  // Always exit 0 so the workflow never fails
  process.exit(0);
});
