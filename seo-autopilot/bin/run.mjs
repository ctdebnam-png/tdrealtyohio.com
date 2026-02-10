#!/usr/bin/env node
/**
 * SEO Autopilot — main entry point
 *
 * This script is invoked by the seo-autopilot GitHub Actions workflow.
 * It always exits 0 so the workflow never fails.
 *
 * Pipeline:
 * 1. Detect build output + enumerate pages
 * 2. Run before-audit + link graph (read-only)
 * 3. Collect GSC data + compute opportunities (read-only)
 * 4. Compute score + focus plan (decision engine)
 * 5. Execute focus-gated actions (tech, links, ctr, refresh, publish)
 * 6. Run after-audit + link graph, compute diff
 * 7. Update score history, module outcomes, and report
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
import { computeGscDeltas } from '../scoring/gsc-deltas.mjs';
import { computeScore, classifyIssues, countThinPages, countUnderlinkedPillars } from '../scoring/score.mjs';
import { computeFocusPlan } from '../planners/focus-plan.mjs';
import { auditLiveRobotsSitemap } from '../auditors/live-robots-sitemap.mjs';
import { auditLiveIndexing } from '../auditors/live-indexing.mjs';
import { fixIndexingHygiene } from '../fixers/indexing-hygiene.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REPORT_DIR = join(__dirname, '..', 'report');
const STATE_DIR = join(__dirname, '..', 'state');
const CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');
const PILLARS_PATH = join(__dirname, '..', 'config', 'pillars.json');
const BACKLOG_PATH = join(__dirname, '..', 'config', 'content-backlog.json');
const SEO_DEFAULTS_PATH = join(__dirname, '..', 'config', 'seo-defaults.json');
const RELATED_GUIDES_PATH = join(__dirname, '..', 'config', 'related-guides.json');
const STATE_PATH = join(STATE_DIR, 'state.json');
const SCORE_HISTORY_PATH = join(STATE_DIR, 'score-history.json');
const MODULE_OUTCOMES_PATH = join(STATE_DIR, 'module-outcomes.json');

// ── Loaders ────────────────────────────────────────────────────────────────

function loadJson(path, fallback = {}) {
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}
function loadConfig() { return loadJson(CONFIG_PATH, { baseUrl: '', canonicalStrategy: 'slash', rankIntentRoutes: [], utilityRoutesNoIndex: [] }); }
function loadPillars() { return loadJson(PILLARS_PATH, { pillars: [], rules: { maxNewLinksPerRun: 3, maxLinksAddedPerFile: 2, minAnchorLength: 4 } }); }
function loadBacklog() { return loadJson(BACKLOG_PATH, null); }
function loadSeoDefaults() { return loadJson(SEO_DEFAULTS_PATH, { baseUrl: 'https://tdrealtyohio.com' }); }
function loadRelatedGuides() { return loadJson(RELATED_GUIDES_PATH, {}); }
function loadState() { return loadJson(STATE_PATH, {}); }
function loadScoreHistory() { return loadJson(SCORE_HISTORY_PATH, { runs: [] }); }
function loadModuleOutcomes() { return loadJson(MODULE_OUTCOMES_PATH, { tech: {}, links: {}, ctr: {}, content: {} }); }

async function saveState(state) { await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n'); }
async function saveScoreHistory(h) { await writeFile(SCORE_HISTORY_PATH, JSON.stringify(h, null, 2) + '\n'); }
async function saveModuleOutcomes(m) { await writeFile(MODULE_OUTCOMES_PATH, JSON.stringify(m, null, 2) + '\n'); }

// ── Helpers ────────────────────────────────────────────────────────────────

function computeDiff(before, after) {
  const diff = {};
  const allCodes = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const code of allCodes) {
    const b = (before || {})[code] || 0;
    const a = (after || {})[code] || 0;
    if (b !== a) diff[code] = { before: b, after: a, delta: a - b };
  }
  return diff;
}

function linkGraphSummary(graph) {
  return {
    pagesInGraph: graph.pagesInGraph,
    edgesInGraph: graph.edgesInGraph,
    orphanCount: graph.orphanCount,
    topUnderlinked: graph.topUnderlinked,
    topLinkSources: (graph.topLinkSources || []).slice(0, 10),
    brokenEdgesSample: graph.brokenEdgesSample,
  };
}

// ── Main pipeline ──────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  console.log('[seo-autopilot] Starting run…');

  await mkdir(REPORT_DIR, { recursive: true });
  await mkdir(STATE_DIR, { recursive: true });

  const config = loadConfig();
  const pillars = loadPillars();
  let state = loadState();

  const report = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    buildOutput: null,
    beforeAudit: null, afterAudit: null, diff: null,
    fixerResults: null,
    linkGraphBefore: null, linkGraphAfter: null,
    linkActionsApplied: [], budgetUsed: { linksAdded: 0, filesEdited: 0 },
    gsc: null, experiments: { applied: [], evaluated: [] },
    content: { action: 'none', target: null, reason: '', filesEdited: [], wordsAdded: 0 },
    score: null, focusPlan: null, moduleOutcomes: null,
    notes: '', errors: [],
  };

  // ─────────────────────────── PHASE 1: COLLECT DATA ───────────────────────

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

  if (buildOutput.mode !== 'static-html') {
    report.notes = `Build output mode "${buildOutput.mode}" — scan skipped.`;
    console.log(`[seo-autopilot] Mode "${buildOutput.mode}" — scan skipped`);
    report.durationMs = Date.now() - start;
    await writeFile(join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`[seo-autopilot] Done in ${report.durationMs}ms`);
    return;
  }

  let pages;
  let beforeAudit;
  let linkGraphBefore;

  // Step 2: Before-audit + link graph
  try {
    pages = listHtmlPages(buildOutput.outputDir, { canonicalStrategy: config.canonicalStrategy });
    console.log(`[seo-autopilot] Found ${pages.length} HTML page(s)`);

    beforeAudit = runBuildAudit(pages, config);
    report.beforeAudit = {
      pagesScanned: beforeAudit.totals.pagesScanned,
      issuesTotal: beforeAudit.totals.issuesTotal,
      issueCounts: beforeAudit.totals.issueCounts,
      pages: beforeAudit.pages,
    };
    console.log('\n=== BEFORE AUDIT ===');
    printAuditSummary(beforeAudit);
  } catch (err) {
    report.errors.push(`beforeAudit: ${err.message}`);
    console.error('[seo-autopilot] Before-audit error (non-fatal):', err.message);
  }

  if (pages) {
    try {
      linkGraphBefore = buildLinkGraph(pages, config);
      report.linkGraphBefore = linkGraphSummary(linkGraphBefore);
      console.log('\n=== LINK GRAPH ===');
      printLinkGraphSummary(linkGraphBefore);
    } catch (err) {
      report.errors.push(`linkGraphBefore: ${err.message}`);
      console.error('[seo-autopilot] Link graph error (non-fatal):', err.message);
    }
  }

  // Step 3: GSC data collection
  let gscOk = false;
  let opportunities = { highImpressionsLowCtrPages: [], strikingDistanceQueries: [], decliningPages: [] };
  try {
    console.log('\n=== GSC DATA COLLECTION ===');
    const gscResult = await pullGscData();

    if (gscResult.ok) {
      gscOk = true;
      console.log(`[gsc] Pulled at: ${gscResult.pulledAt}`);
      console.log(`[gsc] 28d: ${gscResult.totals28.clicks} clicks, ${gscResult.totals28.impressions} impressions, CTR ${(gscResult.totals28.ctr * 100).toFixed(2)}%, pos ${gscResult.totals28.position.toFixed(1)}`);
      console.log(`[gsc]  7d: ${gscResult.totals7.clicks} clicks, ${gscResult.totals7.impressions} impressions, CTR ${(gscResult.totals7.ctr * 100).toFixed(2)}%, pos ${gscResult.totals7.position.toFixed(1)}`);

      opportunities = computeOpportunities(gscResult);
      console.log(`[gsc] High imp/low CTR: ${opportunities.highImpressionsLowCtrPages.length}, Striking: ${opportunities.strikingDistanceQueries.length}, Declining: ${opportunities.decliningPages.length}`);

      const snapshots = buildPageSnapshots(gscResult, config.baseUrl, config.canonicalStrategy);
      state.gsc = {
        lastPulledAt: gscResult.pulledAt,
        totals28: gscResult.totals28, totals7: gscResult.totals7,
        pageSnapshots: snapshots,
        opportunities,
      };
      await saveState(state);

      report.gsc = {
        ok: true, skipped: false, pulledAt: gscResult.pulledAt,
        totals28: gscResult.totals28, totals7: gscResult.totals7,
        opportunityCounts: {
          ctrPages: opportunities.highImpressionsLowCtrPages.length,
          strikingQueries: opportunities.strikingDistanceQueries.length,
          decliningPages: opportunities.decliningPages.length,
        },
      };
    } else {
      console.log(`[gsc] Skipped: ${gscResult.reason || 'unknown'}`);
      report.gsc = { ok: false, skipped: gscResult.skipped, reason: gscResult.reason || 'unknown' };
    }
  } catch (err) {
    report.errors.push(`gsc: ${err.message}`);
    report.gsc = { ok: false, skipped: false, reason: err.message };
    console.error('[seo-autopilot] GSC error (non-fatal):', err.message);
  }

  // ─────────────────────────── PHASE 2: SCORE + FOCUS ──────────────────────

  // Blog discovery (needed for thin page count and content planning)
  const blogResult = discoverBlog();
  console.log(`\n[blog] Discovered ${blogResult.posts.length} post(s)`);

  // Classify audit issues
  const techClassification = beforeAudit
    ? classifyIssues(beforeAudit, config.rankIntentRoutes || [])
    : { criticalCount: 0, otherCount: 0, brokenInternalLinks: 0 };

  // Compute GSC deltas
  const scoreHistory = loadScoreHistory();
  const lastRunEntry = scoreHistory.runs.length > 0 ? scoreHistory.runs[scoreHistory.runs.length - 1] : null;
  const gscDeltas = gscOk
    ? computeGscDeltas({ totals7: state.gsc?.totals7 }, lastRunEntry?.components)
    : { clicks7DeltaPct: 0, impressions7DeltaPct: 0, ctr7DeltaPct: 0, pos7Delta: 0, insufficientBaseline: true };

  // Compute score
  const thinCount = countThinPages(blogResult.posts, 300);
  const underlinkedPillarCount = countUnderlinkedPillars(linkGraphBefore, 10);

  const scoreResult = computeScore({
    gscDeltas,
    techClassification,
    linkGraph: linkGraphBefore || {},
    thinCount,
    underlinkedPillarCount,
  });

  console.log(`\n=== SCORE: ${scoreResult.score}/100 ===`);
  console.log(`  Tech: ${techClassification.criticalCount} critical, ${techClassification.otherCount} other, ${techClassification.brokenInternalLinks} broken links`);
  console.log(`  Links: ${linkGraphBefore?.orphanCount || 0} orphans, ${underlinkedPillarCount} underlinked pillars`);
  console.log(`  Content: ${thinCount} thin page(s)`);
  if (!gscDeltas.insufficientBaseline) {
    console.log(`  GSC deltas: clicks ${(gscDeltas.clicks7DeltaPct * 100).toFixed(1)}%, impr ${(gscDeltas.impressions7DeltaPct * 100).toFixed(1)}%, CTR ${(gscDeltas.ctr7DeltaPct * 100).toFixed(1)}%, pos ${gscDeltas.pos7Delta.toFixed(1)}`);
  } else {
    console.log('  GSC deltas: insufficient baseline');
  }

  // Compute focus plan
  const moduleOutcomes = loadModuleOutcomes();
  const focusPlan = computeFocusPlan({
    scoreResult,
    scoreHistory: scoreHistory.runs,
    opportunities,
    backlog: loadBacklog(),
    state,
    moduleOutcomes,
  });

  console.log(`\n=== FOCUS: ${focusPlan.focus} ===`);
  console.log(`  Reason: ${focusPlan.reason}`);

  report.score = { value: scoreResult.score, components: scoreResult.components, focus: focusPlan.focus };
  report.focusPlan = focusPlan;

  // ─────────────────────────── PHASE 3: EXECUTE FOCUS ──────────────────────

  const focus = focusPlan.focus;

  // Tech focus: run metadata fixer + indexing hygiene
  if (focus === 'tech' && pages) {
    try {
      const fixResult = fixMetadata(pages);
      report.fixerResults = { filesChanged: fixResult.filesChanged, tagsAdded: fixResult.tagsAdded, details: fixResult.details };
      console.log(`\n[tech] Metadata fixer: ${fixResult.filesChanged} file(s) changed, ${fixResult.tagsAdded} tag(s) added`);

      // Run indexing hygiene fixer (robots.txt, canonical normalization)
      const hygieneResult = fixIndexingHygiene();
      if (hygieneResult.filesChanged > 0) {
        console.log(`[tech] Indexing hygiene: ${hygieneResult.filesChanged} file(s) fixed`);
        for (const f of hygieneResult.fixes) console.log(`  ${f.file}: ${f.action}`);
      }
      report.indexingHygiene = hygieneResult;

      moduleOutcomes.tech = {
        lastRunAt: new Date().toISOString(),
        lastDeltaCritical: 0, // Will be updated after re-audit
        lastDeltaBrokenLinks: 0,
      };
    } catch (err) {
      report.errors.push(`metadataFixer: ${err.message}`);
      console.error('[seo-autopilot] Metadata fixer error (non-fatal):', err.message);
    }
  }

  // Live URL verification (runs on any focus, but only if baseUrl is configured)
  report.live = { checked: false, issueCounts: {}, results: [] };
  try {
    const siteBaseUrl = config.baseUrl || '';
    if (siteBaseUrl) {
      console.log('\n=== LIVE INDEXING CHECKS ===');

      // Robots.txt and sitemap checks
      const robotsSitemapResult = await auditLiveRobotsSitemap();
      if (robotsSitemapResult.issues.length > 0) {
        console.log(`[live] Robots/sitemap issues: ${robotsSitemapResult.issues.length}`);
        for (const issue of robotsSitemapResult.issues.slice(0, 5)) {
          console.log(`  ${issue.code}: ${issue.detail}`);
        }
      } else {
        console.log('[live] Robots/sitemap: OK');
      }

      // Live URL indexing checks
      const liveResult = await auditLiveIndexing({ robotsDisallowed: robotsSitemapResult.robotsDisallowed });
      const totalLiveIssues = Object.values(liveResult.issueCounts).reduce((a, b) => a + b, 0);
      if (totalLiveIssues > 0) {
        console.log(`[live] Indexing issues: ${totalLiveIssues}`);
        for (const [code, count] of Object.entries(liveResult.issueCounts)) {
          console.log(`  ${code}: ${count}`);
        }
      } else {
        console.log('[live] All live routes OK');
      }

      // Merge issue counts
      const mergedIssueCounts = { ...robotsSitemapResult.issueCounts };
      for (const [code, count] of Object.entries(liveResult.issueCounts)) {
        mergedIssueCounts[code] = (mergedIssueCounts[code] || 0) + count;
      }

      report.live = {
        checked: true,
        checkedAt: liveResult.checkedAt,
        issueCounts: mergedIssueCounts,
        results: liveResult.results.slice(0, 10),
        robotsSitemap: {
          issues: robotsSitemapResult.issues,
          issueCounts: robotsSitemapResult.issueCounts,
        },
      };

      // Persist live state
      state.live = {
        lastCheckedAt: liveResult.checkedAt,
        issueCounts: mergedIssueCounts,
        worstRoutes: liveResult.results
          .filter(r => r.issues && r.issues.length > 0)
          .slice(0, 10)
          .map(r => ({ route: r.route, codes: r.issues.map(i => i.code) })),
      };

      // Hard gate: if LIVE_NOINDEX or LIVE_ROBOTS_TXT_BLOCKING on any route, override focus for next run
      const criticalLiveIssues = (mergedIssueCounts.LIVE_NOINDEX || 0) + (mergedIssueCounts.LIVE_ROBOTS_TXT_BLOCKING || 0);
      if (criticalLiveIssues > 0) {
        console.log(`[live] WARNING: ${criticalLiveIssues} critical live indexing issue(s) — tech focus will be forced on next run`);
        state.liveGateForced = true;
      }
    } else {
      console.log('\n[live] No baseUrl configured — skipping live checks');
    }
  } catch (err) {
    report.errors.push(`liveChecks: ${err.message}`);
    console.error('[seo-autopilot] Live checks error (non-fatal):', err.message);
  }

  // Links focus: run link planner
  if (focus === 'links' && linkGraphBefore) {
    try {
      const { actions } = generateLinkPlan(linkGraphBefore, config, pillars);
      if (actions.length > 0) {
        console.log(`\n[links] Link plan: ${actions.length} action(s)`);
        for (const a of actions) console.log(`  ${a.fromPath} -> ${a.toPath} ("${a.anchorText}")`);

        const linkResult = applyInternalLinks(actions);
        report.linkActionsApplied = linkResult.details.filter(d => d.status === 'added');
        report.budgetUsed = { linksAdded: linkResult.linksAdded, filesEdited: linkResult.filesEdited };
        console.log(`[links] Applied: ${linkResult.linksAdded} link(s), ${linkResult.filesEdited} file(s)`);

        moduleOutcomes.links = {
          lastRunAt: new Date().toISOString(),
          lastDeltaOrphans: 0,
          lastDeltaInDegreePillars: 0,
        };
      } else {
        console.log('\n[links] No actions needed');
      }
    } catch (err) {
      report.errors.push(`linkPlan: ${err.message}`);
      console.error('[seo-autopilot] Link plan error (non-fatal):', err.message);
    }
  }

  // CTR focus: run experiment evaluation + apply
  if (focus === 'ctr') {
    try {
      const pageSnapshots = state.gsc?.pageSnapshots || {};

      // Evaluate existing experiments
      const evalResults = evaluateExperiments(pageSnapshots);
      if (evalResults.length > 0) {
        console.log('\n=== EXPERIMENT EVALUATIONS ===');
        for (const ev of evalResults) console.log(`  ${ev.path}: ${ev.result} — ${ev.notes}`);
        report.experiments.evaluated = evalResults;
      }

      // Apply new experiments
      const ctrOpportunities = state.gsc?.opportunities?.highImpressionsLowCtrPages || [];
      if (ctrOpportunities.length > 0) {
        const expConfig = loadJson(join(__dirname, '..', 'config', 'experiments.json'), {});
        const expState = loadJson(join(__dirname, '..', 'state', 'experiments.json'), {});

        const candidates = selectCandidates({ opportunities: ctrOpportunities, experimentsConfig: expConfig, experimentsState: expState, siteConfig: config });
        if (candidates.length > 0) {
          console.log(`\n[ctr] Experiment candidates: ${candidates.length}`);
          let applied = 0;
          const maxChanges = focusPlan.budgets.maxMetaEdits || 3;

          for (const candidate of candidates) {
            if (applied >= maxChanges) break;
            const variant = generateVariant({ path: candidate.path, existingTitle: '', existingDescription: '', topQueries: candidate.topQueries || [], ctr28: candidate.ctr28 });
            if (variant) {
              const baseline = pageSnapshots[candidate.path] || { impressions7: 0, clicks7: 0, ctr7: candidate.ctr28, pos7: candidate.pos28 };
              applyVariant({
                path: candidate.path, title: variant.chosen.title, description: variant.chosen.description,
                existingTitle: variant.variantA.title !== variant.chosen.title ? variant.variantA.title : '', existingDescription: '',
                baseline: { impressions7: baseline.impressions7 || 0, clicks7: baseline.clicks7 || 0, ctr7: baseline.ctr7 || 0, pos7: baseline.pos7 || 0 },
              });
              report.experiments.applied.push({ path: candidate.path, title: variant.chosen.title, description: variant.chosen.description });
              applied++;
              console.log(`  Applied: ${candidate.path} — "${variant.chosen.title}"`);
            }
          }

          moduleOutcomes.ctr = {
            lastRunAt: new Date().toISOString(),
            pagesEdited: applied,
            kept: evalResults.filter(e => e.result === 'KEEP').length,
            reverted: evalResults.filter(e => e.result === 'REVERT').length,
          };
        } else {
          console.log('\n[ctr] No eligible candidates');
        }
      } else {
        console.log('\n[ctr] No CTR opportunities — skipping experiments');
      }
    } catch (err) {
      report.errors.push(`experiments: ${err.message}`);
      console.error('[seo-autopilot] Experiments error (non-fatal):', err.message);
    }
  }

  // Refresh or Publish focus: run content engine
  if ((focus === 'refresh' || focus === 'publish') && focusPlan.budgets.contentActionAllowed) {
    try {
      console.log('\n=== CONTENT ENGINE ===');
      const backlog = loadBacklog();
      const seoDefaults = loadSeoDefaults();

      const contentPlan = planContent({
        strikingDistanceQueries: state.gsc?.opportunities?.strikingDistanceQueries || [],
        backlog,
        blogPosts: blogResult.posts,
        rankIntentRoutes: config.rankIntentRoutes || [],
        auditResult: beforeAudit,
        state,
        linkGraph: linkGraphBefore,
      });

      console.log(`[content] Plan: ${contentPlan.action} — ${contentPlan.reason}`);
      report.content.action = contentPlan.action;
      report.content.target = contentPlan.target;
      report.content.reason = contentPlan.reason;

      if (contentPlan.action === 'refresh-post' && contentPlan.target) {
        const post = blogResult.posts.find(p => p.path === contentPlan.target.pathOrSlug);
        if (post) {
          const result = refreshBlogPost({ filePath: post.filePath, query: contentPlan.target.query, internalLinksTo: contentPlan.target.internalLinksTo || [], rankIntentRoutes: config.rankIntentRoutes || [] });
          console.log(`[content] Refresh blog post: ${result.reason} (${result.wordsAdded} words)`);
          report.content.filesEdited = result.filesEdited;
          report.content.wordsAdded = result.wordsAdded;
          state.content = { ...(state.content || {}), lastActionAt: new Date().toISOString(), lastRefreshAt: new Date().toISOString(), lastTargets: [{ path: contentPlan.target.pathOrSlug, action: 'refresh-post' }] };
          moduleOutcomes.content = { lastRunAt: new Date().toISOString(), action: 'refresh', target: contentPlan.target.pathOrSlug };
        }
      } else if (contentPlan.action === 'refresh-page' && contentPlan.target) {
        const result = refreshMoneyPage({ routePath: contentPlan.target.pathOrSlug, query: contentPlan.target.query, internalLinksTo: contentPlan.target.internalLinksTo || [] });
        console.log(`[content] Refresh money page: ${result.reason} (${result.wordsAdded} words)`);
        report.content.filesEdited = result.filesEdited;
        report.content.wordsAdded = result.wordsAdded;
        state.content = { ...(state.content || {}), lastActionAt: new Date().toISOString(), lastRefreshAt: new Date().toISOString(), lastTargets: [{ path: contentPlan.target.pathOrSlug, action: 'refresh-page' }] };
        moduleOutcomes.content = { lastRunAt: new Date().toISOString(), action: 'refresh', target: contentPlan.target.pathOrSlug };
      } else if (contentPlan.action === 'publish-post' && contentPlan.target) {
        const result = publishPost({
          topic: { topicId: contentPlan.target.topicId, primaryIntent: contentPlan.target.primaryIntent, targetQueryHints: contentPlan.target.targetQueryHints, requiredSections: contentPlan.target.requiredSections, internalLinksTo: contentPlan.target.internalLinksTo },
          clusterId: contentPlan.target.clusterId, pillarPath: contentPlan.target.pillarPath,
          blogPosts: blogResult.posts, rankIntentRoutes: config.rankIntentRoutes || [], seoDefaults,
        });
        console.log(`[content] Publish: ${result.reason} — ${result.slug} (${result.wordsAdded} words)`);
        report.content.filesEdited = result.filesCreated;
        report.content.wordsAdded = result.wordsAdded;

        if (result.success) {
          if (backlog) {
            for (const cluster of backlog.clusters) {
              for (const t of cluster.topics) {
                if (t.topicId === contentPlan.target.topicId) {
                  t.status = 'done'; t.publishedAt = new Date().toISOString(); t.slug = result.slug; t.routePath = result.routePath;
                }
              }
            }
            await writeFile(BACKLOG_PATH, JSON.stringify(backlog, null, 2) + '\n');
          }
          state.content = { ...(state.content || {}), lastActionAt: new Date().toISOString(), lastPublishAt: new Date().toISOString(), lastTargets: [{ path: result.routePath, action: 'publish-post', slug: result.slug }] };
          moduleOutcomes.content = { lastRunAt: new Date().toISOString(), action: 'publish', target: result.routePath };

          // Update related-guides
          try {
            const guides = loadRelatedGuides();
            const pillar = contentPlan.target.pillarPath;
            if (pillar) {
              if (!guides[pillar]) guides[pillar] = [];
              guides[pillar].push({ path: result.routePath, anchor: result.slug.replace(/-/g, ' '), addedAt: new Date().toISOString() });
              if (guides[pillar].length > 10) guides[pillar] = guides[pillar].slice(-10);
              await writeFile(RELATED_GUIDES_PATH, JSON.stringify(guides, null, 2) + '\n');
              console.log(`[content] Updated related-guides for ${pillar}`);
            }
          } catch (err) { console.warn(`[content] Could not update related-guides: ${err.message}`); }
        }
      } else {
        console.log('[content] No content action taken');
      }
    } catch (err) {
      report.errors.push(`content: ${err.message}`);
      console.error('[seo-autopilot] Content engine error (non-fatal):', err.message);
    }
  }

  // No-focus: just log
  if (focus === 'none') {
    console.log('\n[focus] No actions taken this run');
  }

  // ─────────────────────────── PHASE 4: AFTER-AUDIT ────────────────────────

  if (pages) {
    try {
      const afterPages = listHtmlPages(buildOutput.outputDir, { canonicalStrategy: config.canonicalStrategy });
      const afterAudit = runBuildAudit(afterPages, config);
      report.afterAudit = {
        pagesScanned: afterAudit.totals.pagesScanned, issuesTotal: afterAudit.totals.issuesTotal,
        issueCounts: afterAudit.totals.issueCounts, samples: afterAudit.samples, pages: afterAudit.pages,
      };
      console.log('\n=== AFTER AUDIT ===');
      printAuditSummary(afterAudit);

      const linkGraphAfter = buildLinkGraph(afterPages, config);
      report.linkGraphAfter = linkGraphSummary(linkGraphAfter);
      console.log('=== LINK GRAPH (AFTER) ===');
      printLinkGraphSummary(linkGraphAfter);

      // Diffs
      if (report.beforeAudit) {
        report.diff = computeDiff(report.beforeAudit.issueCounts, report.afterAudit.issueCounts);
        const diffEntries = Object.entries(report.diff);
        if (diffEntries.length > 0) {
          console.log('=== DIFF ===');
          for (const [code, { before, after, delta }] of diffEntries) {
            console.log(`  ${code}: ${before} -> ${after} (${delta > 0 ? '+' : ''}${delta})`);
          }
        }
      }
      if (report.linkGraphBefore && report.linkGraphAfter) {
        const eDelta = report.linkGraphAfter.edgesInGraph - report.linkGraphBefore.edgesInGraph;
        const oDelta = report.linkGraphAfter.orphanCount - report.linkGraphBefore.orphanCount;
        if (eDelta !== 0 || oDelta !== 0) {
          console.log('=== LINK GRAPH DIFF ===');
          if (eDelta !== 0) console.log(`  Edges: ${report.linkGraphBefore.edgesInGraph} -> ${report.linkGraphAfter.edgesInGraph} (${eDelta > 0 ? '+' : ''}${eDelta})`);
          if (oDelta !== 0) console.log(`  Orphans: ${report.linkGraphBefore.orphanCount} -> ${report.linkGraphAfter.orphanCount} (${oDelta > 0 ? '+' : ''}${oDelta})`);
        }
      }

      // Update module outcomes with after-audit deltas
      if (focus === 'tech' && report.beforeAudit) {
        const beforeClass = classifyIssues(beforeAudit, config.rankIntentRoutes || []);
        const afterClass = classifyIssues(afterAudit, config.rankIntentRoutes || []);
        moduleOutcomes.tech.lastDeltaCritical = afterClass.criticalCount - beforeClass.criticalCount;
        moduleOutcomes.tech.lastDeltaBrokenLinks = afterClass.brokenInternalLinks - beforeClass.brokenInternalLinks;
      }
      if (focus === 'links' && report.linkGraphBefore && report.linkGraphAfter) {
        moduleOutcomes.links.lastDeltaOrphans = report.linkGraphAfter.orphanCount - report.linkGraphBefore.orphanCount;
      }

      report.notes = `Score: ${scoreResult.score}. Focus: ${focus}. Before: ${report.beforeAudit?.issuesTotal ?? '?'} issues. After: ${afterAudit.totals.issuesTotal} issues. Links added: ${report.budgetUsed.linksAdded}. Content: ${report.content?.action || 'none'}.`;
    } catch (err) {
      report.errors.push(`afterAudit: ${err.message}`);
      console.error('[seo-autopilot] After-audit error (non-fatal):', err.message);
    }
  }

  // ─────────────────────────── PHASE 5: PERSIST STATE ──────────────────────

  // Append to score history (keep last 120 runs)
  scoreHistory.runs.push({
    runAt: new Date().toISOString(),
    score: scoreResult.score,
    components: {
      gsc: {
        clicks28: state.gsc?.totals28?.clicks || 0, clicks7: state.gsc?.totals7?.clicks || 0,
        impr28: state.gsc?.totals28?.impressions || 0, impr7: state.gsc?.totals7?.impressions || 0,
        ctr28: state.gsc?.totals28?.ctr || 0, ctr7: state.gsc?.totals7?.ctr || 0,
        pos28: state.gsc?.totals28?.position || 0, pos7: state.gsc?.totals7?.position || 0,
      },
      tech: { criticalCount: techClassification.criticalCount, otherCount: techClassification.otherCount, brokenInternalLinks: techClassification.brokenInternalLinks },
      links: { orphanCount: linkGraphBefore?.orphanCount || 0, underlinkedPillars: underlinkedPillarCount },
      content: { thinCount, lastAction: report.content.action },
    },
    decisions: { focus, actionsPlanned: 1, actionsApplied: focus === 'none' ? 0 : 1 },
  });
  if (scoreHistory.runs.length > 120) {
    scoreHistory.runs = scoreHistory.runs.slice(-120);
  }

  await saveState(state);
  await saveScoreHistory(scoreHistory);
  await saveModuleOutcomes(moduleOutcomes);

  report.moduleOutcomes = moduleOutcomes;
  report.durationMs = Date.now() - start;

  await writeFile(join(REPORT_DIR, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.linkGraphAfter) {
    await writeFile(join(REPORT_DIR, 'link-graph.json'), JSON.stringify(report.linkGraphAfter, null, 2) + '\n');
  }

  console.log(`\n[seo-autopilot] Done in ${report.durationMs}ms`);
}

main().catch((err) => {
  console.error('[seo-autopilot] Unexpected error (non-fatal):', err);
  process.exit(0);
});
