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
import { auditThinContent } from '../auditors/content-thin.mjs';
import { detectNearDuplicates } from '../auditors/near-duplicates.mjs';
import { discoverAreas } from '../lib/area-discovery.mjs';
import { planAreaExpansion } from '../planners/area-plan.mjs';
import { expandAreaPage, revertAreaExpansion } from '../generators/area-expand.mjs';
import { buildCanonicalUrlSet } from '../lib/canonical-url-set.mjs';
import { auditSitemapCoverage } from '../auditors/sitemap-coverage.mjs';
import { compareSitemapAgreement } from '../auditors/live-robots-sitemap.mjs';
import { auditCanonicalAgreement } from '../auditors/canonical-agreement.mjs';
import { pullGscSitemapStatus } from '../collectors/gsc-sitemaps.mjs';
import { checkDiffBudget } from '../lib/diff-budget.mjs';
import { computeAuditDelta } from '../lib/audit-delta.mjs';
import { getHeadSha, saveSnapshot, revertToSha } from '../lib/snapshot.mjs';
import { getSchedule } from '../lib/schedule.mjs';
import { writeJsonStable } from '../lib/write-json.mjs';
import { runHousekeeping } from '../lib/housekeeping.mjs';
import { extractMoneyPageIntents } from '../analyzers/money-page-intents.mjs';
import { enhanceMoneyPage, revertMoneyEnhancement } from '../generators/money-page-enhance.mjs';
import { buildQueryPageMap } from '../analyzers/query-page-map.mjs';
import { planStrikingRefresh } from '../planners/striking-refresh-plan.mjs';
import { executeStrikingRefresh, revertStrikingRefresh } from '../generators/striking-refresh.mjs';
import { applyPillarNav, removeAllPillarNavBlocks } from '../fixers/pillar-nav.mjs';
import { auditNavConsistency } from '../auditors/nav-consistency.mjs';
import { pullConversions, loadConversions } from '../collectors/conversions.mjs';
import { computeConversionAttribution } from '../analyzers/conversion-attribution.mjs';
import { injectLocalBusinessSchema } from '../generators/localbusiness-schema.mjs';
import { auditNapDrift } from '../auditors/nap-drift.mjs';
import { generateCitationsPlan } from '../generators/citations-plan.mjs';
import { auditImages } from '../auditors/image-audit.mjs';
import { fixImageAlt } from '../fixers/image-alt.mjs';
import { fixImageLazy } from '../fixers/image-lazy.mjs';
import { fixOgImage } from '../fixers/og-image.mjs';
import { auditSchema } from '../auditors/schema.mjs';
import { auditPerf } from '../auditors/perf.mjs';
import { detectPerfRegressions } from '../analyzers/perf-regressions.mjs';
import { applyPerfHints } from '../fixers/perf-hints.mjs';
import { buildQueryPagesIndex } from '../analyzers/query-pages-index.mjs';
import { detectCannibalization } from '../analyzers/cannibalization.mjs';
import { planConsolidation } from '../planners/consolidation-plan.mjs';
import { applyConsolidationMitigation, removeConsolidationMitigations } from '../fixers/consolidation-mitigations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REPORT_DIR = join(__dirname, '..', 'report');
const STATE_DIR = join(__dirname, '..', 'state');
const CONFIG_PATH = join(__dirname, '..', 'config', 'site.json');
const PILLARS_PATH = join(__dirname, '..', 'config', 'pillars.json');
const BACKLOG_PATH = join(__dirname, '..', 'config', 'content-backlog.json');
const SEO_DEFAULTS_PATH = join(__dirname, '..', 'config', 'seo-defaults.json');
const RELATED_GUIDES_PATH = join(__dirname, '..', 'config', 'related-guides.json');
const AREAS_CONFIG_PATH = join(__dirname, '..', 'config', 'areas.json');
const SAFETY_CONFIG_PATH = join(__dirname, '..', 'config', 'safety.json');
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

async function saveState(state) { await writeJsonStable(STATE_PATH, state, 'state'); }
async function saveScoreHistory(h) { await writeJsonStable(SCORE_HISTORY_PATH, h, 'scoreHistory'); }
async function saveModuleOutcomes(m) { await writeJsonStable(MODULE_OUTCOMES_PATH, m, 'moduleOutcomes'); }

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
    quality: { thinRankIntentCount: 0, nearDuplicatePairsCount: 0, thinRankIntent: [], nearDuplicatePairs: [] },
    areas: { selected: null, wordsBefore: 0, wordsAfter: 0, linksAdded: [], reason: '' },
    moneyEnhancements: [],
    strikingRefresh: { action: 'none', targetPagePath: null, queries: [], pageType: '', reason: '' },
    pillarNav: { filesChanged: 0, details: [] },
    navConsistency: { totalChecked: 0, issues: [], pillarInDegree: {} },
    conversions: { lastDay: null, last7: null, deltas: null },
    localSeo: { napDrift: { phoneMismatchCount: 0, emailMismatchCount: 0, sampleRoutes: [] }, schema: { injected: false, pages: [] } },
    images: { pagesChecked: 0, issueCounts: {}, oversizedImages: [], ogImageIssues: [], fixes: {} },
    schema: { issueCounts: {}, keyPages: {} },
    perf: { issueCounts: {}, perRoute: [], regressions: [], fixes: {} },
    cannibalization: { multiPageCount: 0, pairs: 0, planItems: 0, mitigation: null },
    score: null, focusPlan: null, moduleOutcomes: null,
    safety: { reverted: false, reason: '', baselineSha: '', stats: {}, auditDelta: {} },
    notes: '', errors: [],
  };

  // ─────────────────────────── CONFIG FLAGS ────────────────────────────────
  const DEBUG = process.env.SEO_AUTOPILOT_DEBUG === '1';
  const scoreHistory = loadScoreHistory();
  const schedule = getSchedule({ runCount: scoreHistory.runs.length });

  // ─────────────────────────── SAFETY: BASELINE ───────────────────────────
  const baselineSha = getHeadSha();
  report.safety.baselineSha = baselineSha || '';
  let reverted = false;

  // Load safety config for repeated revert recovery (Step 7)
  const safetyConfig = loadJson(SAFETY_CONFIG_PATH, { budgets: {}, revertIfWorse: {}, snapshots: { keepRuns: 14 } });
  const consecutiveReverts = state.safety?.consecutiveReverts || 0;
  if (consecutiveReverts >= 3) {
    console.log(`[safety] ${consecutiveReverts} consecutive reverts — forcing tech focus, disabling content actions`);
  }

  // Save pre-run snapshot
  try {
    await saveSnapshot({ headSha: baselineSha, reason: 'pre_run', focus: '' });
  } catch (err) {
    report.errors.push(`snapshot: ${err.message}`);
  }

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
      ...(DEBUG ? { pages: beforeAudit.pages } : {}),
    };
    if (DEBUG) {
      console.log('\n=== BEFORE AUDIT ===');
      printAuditSummary(beforeAudit);
    } else {
      console.log(`\n[audit] ${beforeAudit.totals.pagesScanned} pages, ${beforeAudit.totals.issuesTotal} issues`);
    }
  } catch (err) {
    report.errors.push(`beforeAudit: ${err.message}`);
    console.error('[seo-autopilot] Before-audit error (non-fatal):', err.message);
  }

  if (pages) {
    try {
      linkGraphBefore = buildLinkGraph(pages, config);
      report.linkGraphBefore = linkGraphSummary(linkGraphBefore);
      if (DEBUG) {
        console.log('\n=== LINK GRAPH ===');
        printLinkGraphSummary(linkGraphBefore);
      }
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

  // Extract money page intents from GSC data (Chunk 16)
  let moneyIntents = {};
  try {
    if (gscOk && state.gsc) {
      const gscLatest = loadJson(join(STATE_DIR, 'gsc-latest.json'), {});
      moneyIntents = extractMoneyPageIntents({
        rows28: gscLatest.rows28 || [],
        baseUrl: config.baseUrl || '',
      });
      if (Object.keys(moneyIntents).length > 0) {
        // Persist compact version in state (cap to 3 queries per bucket)
        const compact = {};
        for (const [route, data] of Object.entries(moneyIntents)) {
          compact[route] = {
            buckets: (data.buckets || []).map(b => ({
              bucketId: b.bucketId,
              impressions: b.impressions,
              clicks: b.clicks,
              topQueries: (b.topQueries || []).slice(0, 3),
            })),
          };
        }
        state.moneyIntents = compact;
      }
    }
  } catch (err) {
    report.errors.push(`moneyIntents: ${err.message}`);
  }

  // Build query-to-page map from striking-distance queries (Chunk 17)
  let queryPageMap = [];
  try {
    const strikingQueries = state.gsc?.opportunities?.strikingDistanceQueries || opportunities.strikingDistanceQueries || [];
    if (strikingQueries.length > 0) {
      const mapResult = buildQueryPageMap({
        strikingDistanceQueries: strikingQueries,
        rankIntentRoutes: config.rankIntentRoutes || [],
      });
      queryPageMap = mapResult.fullMap;
      state.queryPageMap = mapResult.compactMap;
    }
  } catch (err) {
    report.errors.push(`queryPageMap: ${err.message}`);
  }

  // Conversion data collection (Chunk 19)
  let conversionAttribution = { last7: { totalConversions: 0 }, deltas: {}, insufficientData: true };
  try {
    const convResult = await pullConversions();
    if (convResult.ok) {
      console.log(`[conversions] Pulled ${convResult.days.length} day(s)`);
    } else if (convResult.skipped) {
      console.log(`[conversions] Skipped: ${convResult.reason}`);
    }

    // Load (either freshly pulled or existing on disk)
    const convData = loadConversions();
    if (convData.days.length > 0) {
      const gscClicks7 = state.gsc?.totals7?.clicks || 0;
      conversionAttribution = computeConversionAttribution({
        days: convData.days,
        gscClicks7,
      });

      if (!conversionAttribution.insufficientData) {
        console.log(`[conversions] Last 7d: ${conversionAttribution.last7.totalConversions} conversions, delta: ${(conversionAttribution.deltas.totalDeltaPct * 100).toFixed(1)}%`);
        console.log(`[conversions] Money page share: ${(conversionAttribution.moneyPageShare * 100).toFixed(1)}%`);
      }

      // Persist compact summary in state
      state.conversions = {
        lastCheckedAt: new Date().toISOString(),
        last7Total: conversionAttribution.last7.totalConversions,
        moneyPageShare: conversionAttribution.moneyPageShare,
        totalDeltaPct: conversionAttribution.deltas.totalDeltaPct,
      };

      // Report
      report.conversions = {
        lastDay: convData.days.length > 0 ? convData.days[convData.days.length - 1] : null,
        last7: conversionAttribution.last7,
        deltas: conversionAttribution.deltas,
      };
    }
  } catch (err) {
    report.errors.push(`conversions: ${err.message}`);
    console.error('[seo-autopilot] Conversions error (non-fatal):', err.message);
  }

  // Cannibalization analysis (Chunk 24) — requires GSC data
  let cannibalizationPairs = [];
  let consolidationPlan = { items: [] };
  try {
    const gscRows28 = state.gsc?.rows28 || [];
    if (gscRows28.length > 0) {
      const qpIndex = await buildQueryPagesIndex(gscRows28);
      if (qpIndex.multiPageCount > 0) {
        const cannResult = detectCannibalization(qpIndex.multiPageQueries);
        cannibalizationPairs = cannResult.pairs;
        if (cannResult.totalCandidates > 0) {
          consolidationPlan = await planConsolidation(cannResult.pairs);
          console.log(`[cannibalization] ${cannResult.totalCandidates} competing pair(s), ${consolidationPlan.items.length} plan item(s)`);
        }
      }
      report.cannibalization = {
        multiPageCount: qpIndex.multiPageCount,
        pairs: cannibalizationPairs.length,
        planItems: consolidationPlan.items.length,
        mitigation: null,
      };
    }
  } catch (err) {
    report.errors.push(`cannibalization: ${err.message}`);
  }

  // ─────────────────────────── PHASE 2: SCORE + FOCUS ──────────────────────

  // Blog discovery (needed for thin page count and content planning)
  const blogResult = discoverBlog();
  console.log(`\n[blog] Discovered ${blogResult.posts.length} post(s)`);

  // Quality audits: thin content + near-duplicate detection (Chunk 10)
  // Near-duplicate runs on schedule (weekly); thin always runs (full scan weekly)
  let qualitySignals = { thinRankIntentCount: 0, thinRankIntent: [], nearDuplicatePairs: [] };
  try {
    const qualityConfig = loadJson(join(__dirname, '..', 'config', 'quality.json'), {});
    const thinResult = auditThinContent(pages || [], qualityConfig, { fullScan: schedule.runFullThinScan });
    const nearDupResult = schedule.runNearDuplicateAudit
      ? detectNearDuplicates(pages || [], qualityConfig, blogResult.posts)
      : { pairs: [] };
    qualitySignals = {
      thinRankIntentCount: thinResult.thinRankIntent?.length || 0,
      thinRankIntent: thinResult.thinRankIntent || [],
      thinAnyCount: thinResult.thinAny?.length || 0,
      nearDuplicatePairs: nearDupResult.pairs || [],
      nearDuplicatePairsCount: nearDupResult.pairs?.length || 0,
    };
    const schedNote = !schedule.runNearDuplicateAudit ? ' (near-dup skipped, not scheduled)' : '';
    console.log(`[quality] Thin rank-intent: ${qualitySignals.thinRankIntentCount}, Near-duplicates: ${qualitySignals.nearDuplicatePairsCount}${schedNote}`);
    report.quality = {
      thinRankIntentCount: qualitySignals.thinRankIntentCount,
      thinAnyCount: qualitySignals.thinAnyCount || 0,
      nearDuplicatePairsCount: qualitySignals.nearDuplicatePairsCount,
      thinRankIntent: (qualitySignals.thinRankIntent || []).slice(0, 10),
      nearDuplicatePairs: (qualitySignals.nearDuplicatePairs || []).slice(0, 10),
    };
  } catch (err) {
    report.errors.push(`qualityAudit: ${err.message}`);
    console.error('[seo-autopilot] Quality audit error (non-fatal):', err.message);
  }

  // Nav consistency audit (Chunk 18) — read-only check
  try {
    const navResult = auditNavConsistency(pages || []);
    report.navConsistency = {
      totalChecked: navResult.totalChecked,
      issues: navResult.issues,
      pillarInDegree: navResult.pillarInDegree,
    };
    if (navResult.issues.length > 0) {
      console.log(`[nav] ${navResult.issues.length} consistency issue(s)`);
      for (const issue of navResult.issues.slice(0, 3)) {
        console.log(`  ${issue.code}: ${issue.detail}`);
      }
    }
  } catch (err) {
    report.errors.push(`navConsistency: ${err.message}`);
  }

  // NAP drift audit (Chunk 20) — read-only check
  let napDriftResult = { phoneMismatchCount: 0, emailMismatchCount: 0, nameMismatchCount: 0 };
  try {
    napDriftResult = auditNapDrift(pages || []);
    report.localSeo.napDrift = {
      phoneMismatchCount: napDriftResult.phoneMismatchCount,
      emailMismatchCount: napDriftResult.emailMismatchCount,
      sampleRoutes: [
        ...napDriftResult.phoneMismatches.slice(0, 5).map(m => ({ route: m.routePath, type: 'phone', snippet: m.snippet })),
        ...napDriftResult.emailMismatches.slice(0, 5).map(m => ({ route: m.routePath, type: 'email', snippet: m.snippet })),
      ],
    };
    const totalDrift = napDriftResult.phoneMismatchCount + napDriftResult.emailMismatchCount;
    if (totalDrift > 0) {
      console.log(`[nap] ${totalDrift} NAP drift issue(s): ${napDriftResult.phoneMismatchCount} phone, ${napDriftResult.emailMismatchCount} email`);
    }
  } catch (err) {
    report.errors.push(`napDrift: ${err.message}`);
  }

  // Image audit (Chunk 21) — read-only scan
  try {
    const imageAuditResult = auditImages(pages || []);
    report.images = {
      pagesChecked: imageAuditResult.pagesChecked,
      issueCounts: imageAuditResult.issueCounts,
      oversizedImages: imageAuditResult.oversizedImages,
      ogImageIssues: imageAuditResult.ogImageIssues,
      fixes: {},
    };
    const totalImgIssues = imageAuditResult.summary.totalIssues;
    if (totalImgIssues > 0) {
      const counts = imageAuditResult.issueCounts;
      const parts = [];
      if (counts.MISSING_ALT) parts.push(`${counts.MISSING_ALT} missing alt`);
      if (counts.EMPTY_ALT) parts.push(`${counts.EMPTY_ALT} empty alt`);
      if (counts.MISSING_OG_IMAGE) parts.push(`${counts.MISSING_OG_IMAGE} missing og:image`);
      if (counts.OVERSIZED_IMAGE) parts.push(`${counts.OVERSIZED_IMAGE} oversized`);
      console.log(`[images] ${totalImgIssues} image issue(s): ${parts.join(', ')}`);
    }
  } catch (err) {
    report.errors.push(`imageAudit: ${err.message}`);
  }

  // Schema audit (Chunk 22) — read-only structured data validation
  let schemaAuditResult = { issueCounts: {}, keyPages: {} };
  try {
    schemaAuditResult = auditSchema(pages || []);
    report.schema = {
      issueCounts: schemaAuditResult.issueCounts,
      keyPages: schemaAuditResult.keyPages,
    };
    const totalSchemaIssues = Object.values(schemaAuditResult.issueCounts).reduce((a, b) => a + b, 0);
    if (totalSchemaIssues > 0) {
      const ic = schemaAuditResult.issueCounts;
      const parts = [];
      if (ic.SCHEMA_INVALID_JSON) parts.push(`${ic.SCHEMA_INVALID_JSON} invalid JSON`);
      if (ic.SCHEMA_INVALID_LOCALBUSINESS) parts.push(`${ic.SCHEMA_INVALID_LOCALBUSINESS} invalid LocalBusiness`);
      if (ic.SCHEMA_INVALID_FAQPAGE) parts.push(`${ic.SCHEMA_INVALID_FAQPAGE} invalid FAQPage`);
      if (ic.SCHEMA_INVALID_BLOGPOSTING) parts.push(`${ic.SCHEMA_INVALID_BLOGPOSTING} invalid Article`);
      if (ic.SCHEMA_CONTENT_MISMATCH) parts.push(`${ic.SCHEMA_CONTENT_MISMATCH} mismatch`);
      console.log(`[schema] ${totalSchemaIssues} schema issue(s): ${parts.join(', ')}`);
    }
  } catch (err) {
    report.errors.push(`schemaAudit: ${err.message}`);
  }

  // Performance audit (Chunk 23) — fast built-HTML check
  let perfAuditResult = { issueCounts: {}, perRoute: [], issues: [] };
  try {
    perfAuditResult = auditPerf();
    const totalPerfIssues = Object.values(perfAuditResult.issueCounts).reduce((a, b) => a + b, 0);
    if (totalPerfIssues > 0) {
      const ic = perfAuditResult.issueCounts;
      const parts = [];
      if (ic.PERF_HTML_OVER_BUDGET) parts.push(`${ic.PERF_HTML_OVER_BUDGET} over-budget HTML`);
      if (ic.PERF_HEAD_BLOCKING_SCRIPT) parts.push(`${ic.PERF_HEAD_BLOCKING_SCRIPT} blocking scripts`);
      if (ic.PERF_TOO_MANY_SCRIPTS) parts.push(`${ic.PERF_TOO_MANY_SCRIPTS} too many scripts`);
      if (ic.PERF_INLINE_JS_OVER_BUDGET) parts.push(`${ic.PERF_INLINE_JS_OVER_BUDGET} inline JS over budget`);
      console.log(`[perf] ${totalPerfIssues} perf issue(s): ${parts.join(', ')}`);
    }
  } catch (err) {
    report.errors.push(`perfAudit: ${err.message}`);
  }

  // Perf regression detection (Chunk 23)
  let perfRegressions = [];
  try {
    const regressionResult = await detectPerfRegressions(perfAuditResult.perRoute);
    perfRegressions = regressionResult.regressions;
    if (perfRegressions.length > 0) {
      console.log(`[perf] ${perfRegressions.length} regression(s) detected`);
      for (const r of perfRegressions) {
        console.log(`  ${r.route}: ${r.metric} ${r.previous} → ${r.current} (+${(r.deltaPct * 100).toFixed(0)}%)`);
      }
    }
  } catch (err) {
    report.errors.push(`perfRegressions: ${err.message}`);
  }

  report.perf = {
    issueCounts: perfAuditResult.issueCounts,
    perRoute: perfAuditResult.perRoute,
    regressions: perfRegressions,
    fixes: {},
  };

  // Classify audit issues
  const techClassification = beforeAudit
    ? classifyIssues(beforeAudit, config.rankIntentRoutes || [])
    : { criticalCount: 0, otherCount: 0, brokenInternalLinks: 0 };

  // Compute GSC deltas
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
    nearDuplicatePairsCount: qualitySignals.nearDuplicatePairsCount || 0,
    conversionDeltas: {
      totalDeltaPct: conversionAttribution.deltas?.totalDeltaPct || 0,
      conversionRateDeltaPct: conversionAttribution.deltas?.formSubmitDeltaPct || 0,
      insufficientData: conversionAttribution.insufficientData,
    },
    schemaIssues: {
      totalIssueCount: Object.values(schemaAuditResult.issueCounts || {}).reduce((a, b) => a + b, 0),
      keyPageIssueCount: Object.values(schemaAuditResult.keyPages || {}).reduce((sum, p) => sum + (p.issues?.length || 0), 0),
    },
    perfIssues: {
      htmlOverBudget: perfAuditResult.issueCounts.PERF_HTML_OVER_BUDGET || 0,
      headBlockingScripts: perfAuditResult.issueCounts.PERF_HEAD_BLOCKING_SCRIPT || 0,
      regressionCount: perfRegressions.length,
    },
  });

  console.log(`\n=== SCORE: ${scoreResult.score}/100 ===`);
  console.log(`  Tech: ${techClassification.criticalCount} critical, ${techClassification.otherCount} other, ${techClassification.brokenInternalLinks} broken links`);
  console.log(`  Links: ${linkGraphBefore?.orphanCount || 0} orphans, ${underlinkedPillarCount} underlinked pillars`);
  console.log(`  Content: ${thinCount} thin page(s), ${qualitySignals.nearDuplicatePairsCount} near-duplicate pair(s)`);
  if (!gscDeltas.insufficientBaseline) {
    console.log(`  GSC deltas: clicks ${(gscDeltas.clicks7DeltaPct * 100).toFixed(1)}%, impr ${(gscDeltas.impressions7DeltaPct * 100).toFixed(1)}%, CTR ${(gscDeltas.ctr7DeltaPct * 100).toFixed(1)}%, pos ${gscDeltas.pos7Delta.toFixed(1)}`);
  } else {
    console.log('  GSC deltas: insufficient baseline');
  }

  // Sitemap coverage and canonical agreement (Chunk 12)
  let indexingSignals = {};
  try {
    const areaDiscovery = discoverAreas(pages || []);
    const canonicalSet = buildCanonicalUrlSet({ blogPosts: blogResult.posts, areaRoutes: areaDiscovery.areaRoutes });
    const sitemapCoverage = auditSitemapCoverage({ canonicalUrls: canonicalSet.canonicalUrls });
    const canonicalAgreement = auditCanonicalAgreement({
      auditResult: beforeAudit,
      canonicalUrls: canonicalSet.canonicalUrls,
      liveResults: report.live?.results || [],
      rankIntentRoutes: config.rankIntentRoutes || [],
    });

    indexingSignals = {
      sitemapMissingRankIntent: sitemapCoverage.issueCounts.SITEMAP_MISSING_RANK_INTENT || 0,
      sitemapExtraUrls: sitemapCoverage.issueCounts.SITEMAP_HAS_EXTRA_URLS || 0,
      canonicalBuildMismatchCount: canonicalAgreement.issueCounts.CANONICAL_BUILD_MISMATCH || 0,
      canonicalLiveMismatchCount: canonicalAgreement.issueCounts.CANONICAL_LIVE_MISMATCH || 0,
    };

    report.sitemapCoverage = {
      missingCount: sitemapCoverage.missingInSitemap.length,
      extraCount: sitemapCoverage.extraInSitemap.length,
      missingSamples: sitemapCoverage.missingInSitemap.slice(0, 25),
      extraSamples: sitemapCoverage.extraInSitemap.slice(0, 25),
    };
    report.canonicalAgreement = {
      buildMismatchCount: canonicalAgreement.buildMismatches.length,
      liveMismatchCount: canonicalAgreement.liveMismatches.length,
      samples: [...canonicalAgreement.buildMismatches.slice(0, 10), ...canonicalAgreement.liveMismatches.slice(0, 10)],
    };

    if (sitemapCoverage.missingInSitemap.length > 0 || sitemapCoverage.extraInSitemap.length > 0) {
      console.log(`\n[indexing] Sitemap coverage: ${sitemapCoverage.missingInSitemap.length} missing, ${sitemapCoverage.extraInSitemap.length} extra`);
    }
    if (canonicalAgreement.buildMismatches.length > 0 || canonicalAgreement.liveMismatches.length > 0) {
      console.log(`[indexing] Canonical agreement: ${canonicalAgreement.buildMismatches.length} build, ${canonicalAgreement.liveMismatches.length} live mismatches`);
    }
  } catch (err) {
    report.errors.push(`indexingSignals: ${err.message}`);
    console.error('[seo-autopilot] Indexing signals error (non-fatal):', err.message);
  }

  // GSC sitemap status (observation only)
  try {
    const gscSitemapResult = await pullGscSitemapStatus();
    if (gscSitemapResult.ok) {
      report.gscSitemaps = { ok: true, sitemaps: gscSitemapResult.sitemaps };
      state.indexing = { ...(state.indexing || {}), gscSitemaps: gscSitemapResult.sitemaps, lastCheckedAt: new Date().toISOString() };
    } else if (!gscSitemapResult.skipped) {
      report.gscSitemaps = { ok: false, reason: gscSitemapResult.reason };
    }
  } catch (err) {
    // Non-fatal
  }

  // Compute focus plan
  const moduleOutcomes = loadModuleOutcomes();
  // Collect near-duplicate route set for focus gating
  const nearDuplicateRoutes = (qualitySignals.nearDuplicatePairs || [])
    .flatMap(p => [p.routeA || p.pathA, p.routeB || p.pathB])
    .filter(Boolean);

  const focusPlan = computeFocusPlan({
    scoreResult,
    scoreHistory: scoreHistory.runs,
    opportunities,
    backlog: loadBacklog(),
    state,
    moduleOutcomes,
    indexingSignals,
    moneyRoutes: config.moneyRoutes || [],
    liveIssueCounts: report.live?.issueCounts || {},
    nearDuplicateRoutes,
  });

  // Override focus if repeated reverts (Step 7)
  if (consecutiveReverts >= 3 && focusPlan.focus !== 'tech' && focusPlan.focus !== 'none') {
    focusPlan.focus = 'tech';
    focusPlan.reason = `Forced tech: ${consecutiveReverts} consecutive reverts`;
    focusPlan.budgets = { ...focusPlan.budgets, contentActionAllowed: false };
  }

  console.log(`\n=== FOCUS: ${focusPlan.focus} ===`);
  console.log(`  Reason: ${focusPlan.reason}`);

  report.score = { value: scoreResult.score, components: scoreResult.components, focus: focusPlan.focus };
  report.focusPlan = focusPlan;

  // ─────────────────────────── PHASE 3: EXECUTE FOCUS ──────────────────────

  const focus = focusPlan.focus;

  // No-op fast path: if nothing to do and score unchanged, minimize writes
  let noOpFastPath = false;
  if (focus === 'none' && techClassification.criticalCount === 0) {
    const prev = lastRunEntry?.components;
    if (prev &&
        prev.tech?.criticalCount === techClassification.criticalCount &&
        prev.tech?.brokenInternalLinks === techClassification.brokenInternalLinks &&
        prev.links?.orphanCount === (linkGraphBefore?.orphanCount || 0) &&
        !gscOk // No new GSC data to record
    ) {
      noOpFastPath = true;
      console.log('\n[fast-path] No changes needed and score unchanged — minimal write');
    }
  }

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

      // LocalBusiness schema injection (Chunk 20)
      try {
        const schemaResult = injectLocalBusinessSchema();
        report.localSeo.schema = { injected: schemaResult.injected, pages: schemaResult.pagesUpdated };
        if (schemaResult.injected) {
          console.log(`[tech] LocalBusiness schema: injected on ${schemaResult.pagesUpdated.join(', ')}`);
        }
      } catch (err) {
        report.errors.push(`localBusinessSchema: ${err.message}`);
      }

      // Citations plan generation (Chunk 20)
      try {
        await generateCitationsPlan();
      } catch (err) {
        report.errors.push(`citationsPlan: ${err.message}`);
      }

      // Image SEO fixers (Chunk 21)
      try {
        const altResult = fixImageAlt(pages);
        const lazyResult = fixImageLazy(pages);
        const ogResult = fixOgImage(pages);
        report.images.fixes = {
          alt: { filesChanged: altResult.filesChanged, tagsFixed: altResult.tagsFixed },
          lazy: { filesChanged: lazyResult.filesChanged, tagsFixed: lazyResult.tagsFixed },
          ogImage: { filesChanged: ogResult.filesChanged, tagsFixed: ogResult.tagsFixed },
        };
        const totalFixFiles = altResult.filesChanged + lazyResult.filesChanged + ogResult.filesChanged;
        if (totalFixFiles > 0) {
          console.log(`[tech] Image fixes: alt=${altResult.tagsFixed}, lazy=${lazyResult.tagsFixed}, og=${ogResult.tagsFixed}`);
        }
      } catch (err) {
        report.errors.push(`imageFixer: ${err.message}`);
      }

      // Performance hints fixer (Chunk 23)
      try {
        const perfFixResult = applyPerfHints(pages);
        report.perf.fixes = { filesChanged: perfFixResult.filesChanged, actions: perfFixResult.actions };
        if (perfFixResult.filesChanged > 0) {
          console.log(`[tech] Perf hints: ${perfFixResult.filesChanged} file(s) updated`);
        }
      } catch (err) {
        report.errors.push(`perfHints: ${err.message}`);
      }

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
      if (DEBUG) console.log('\n=== LIVE INDEXING CHECKS ===');

      // Robots.txt and sitemap checks
      const robotsSitemapResult = await auditLiveRobotsSitemap();
      if (DEBUG && robotsSitemapResult.issues.length > 0) {
        console.log(`[live] Robots/sitemap issues: ${robotsSitemapResult.issues.length}`);
        for (const issue of robotsSitemapResult.issues.slice(0, 5)) {
          console.log(`  ${issue.code}: ${issue.detail}`);
        }
      }

      // Live URL indexing checks
      const liveResult = await auditLiveIndexing({ robotsDisallowed: robotsSitemapResult.robotsDisallowed });
      const totalLiveIssues = Object.values(liveResult.issueCounts).reduce((a, b) => a + b, 0);
      if (DEBUG) {
        if (totalLiveIssues > 0) {
          console.log(`[live] Indexing issues: ${totalLiveIssues}`);
          for (const [code, count] of Object.entries(liveResult.issueCounts)) {
            console.log(`  ${code}: ${count}`);
          }
        } else {
          console.log('[live] All live routes OK');
        }
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

      // Live sitemap agreement check (Chunk 12)
      if (robotsSitemapResult.liveSitemapUrls && robotsSitemapResult.liveSitemapUrls.length > 0) {
        try {
          const sitemapCoverageResult = auditSitemapCoverage({ canonicalUrls: [] });
          const sourceUrls = sitemapCoverageResult.sitemapUrls || [];
          const agreement = compareSitemapAgreement(sourceUrls, robotsSitemapResult.liveSitemapUrls, 50);
          if (!agreement.matches) {
            console.log(`[live] Sitemap mismatch: ${agreement.issues[0]?.detail || 'differs'}`);
            for (const issue of agreement.issues) {
              mergedIssueCounts[issue.code] = (mergedIssueCounts[issue.code] || 0) + 1;
            }
          }
        } catch { /* non-fatal */ }
      }

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

  // Persist quality signals in state
  state.quality = {
    lastCheckedAt: new Date().toISOString(),
    thinRankIntentCount: qualitySignals.thinRankIntentCount,
    nearDuplicatePairsCount: qualitySignals.nearDuplicatePairsCount,
  };

  // Persist indexing signals in state (Chunk 12)
  state.indexing = {
    ...(state.indexing || {}),
    lastCheckedAt: new Date().toISOString(),
    sitemapMissingCount: indexingSignals.sitemapMissingRankIntent || 0,
    sitemapExtraCount: indexingSignals.sitemapExtraUrls || 0,
    canonicalBuildMismatchCount: indexingSignals.canonicalBuildMismatchCount || 0,
    canonicalLiveMismatchCount: indexingSignals.canonicalLiveMismatchCount || 0,
  };

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

    // Pillar nav: apply subnav + crosslinks to pillar root pages (Chunk 18)
    try {
      const pillarNavResult = applyPillarNav();
      report.pillarNav = pillarNavResult;
      if (pillarNavResult.filesChanged > 0) {
        console.log(`[links] Pillar nav: ${pillarNavResult.filesChanged} file(s) updated`);
        for (const d of pillarNavResult.details) {
          if (d.subnavInserted || d.nextStepsInserted) {
            console.log(`  ${d.route}: subnav=${d.subnavInserted}, nextSteps=${d.nextStepsInserted}`);
          }
        }
      }
    } catch (err) {
      report.errors.push(`pillarNav: ${err.message}`);
      console.error('[seo-autopilot] Pillar nav error (non-fatal):', err.message);
    }

    // Consolidation mitigation (Chunk 24) — apply one safe mitigation per run
    if (consolidationPlan.items.length > 0) {
      try {
        const topItem = consolidationPlan.items[0];
        const mitResult = applyConsolidationMitigation(topItem);
        report.cannibalization.mitigation = {
          applied: mitResult.applied,
          primary: topItem.primary,
          supporting: topItem.supporting,
          actions: mitResult.actions,
        };
        if (mitResult.applied) {
          console.log(`[links] Consolidation: mitigated ${topItem.supporting[0]} → ${topItem.primary}`);
        }
      } catch (err) {
        report.errors.push(`consolidationMitigation: ${err.message}`);
      }
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

  // Striking-distance refresh (Chunk 17) — runs before generic content engine
  let strikingRefreshDone = false;
  if (focus === 'refresh' && queryPageMap.length > 0 && focusPlan.budgets.contentActionAllowed) {
    try {
      console.log('\n=== STRIKING DISTANCE REFRESH ===');
      const expState = loadJson(join(STATE_DIR, 'experiments.json'), {});

      const strikePlan = planStrikingRefresh({
        queryMap: queryPageMap,
        rankIntentRoutes: config.rankIntentRoutes || [],
        moneyRoutes: config.moneyRoutes || [],
        state,
        experimentsState: expState,
        nearDuplicatePairs: qualitySignals.nearDuplicatePairs || [],
        thinRankIntent: qualitySignals.thinRankIntent || [],
      });

      console.log(`[strike] Plan: ${strikePlan.action} — ${strikePlan.reason}`);
      report.strikingRefresh = {
        action: strikePlan.action,
        targetPagePath: strikePlan.targetPagePath,
        queries: (strikePlan.queries || []).map(q => q.query),
        pageType: strikePlan.pageType,
        reason: strikePlan.reason,
      };

      if (strikePlan.action === 'refresh' && strikePlan.targetPagePath) {
        const strikeResult = executeStrikingRefresh({
          targetPagePath: strikePlan.targetPagePath,
          queries: strikePlan.queries,
          pageType: strikePlan.pageType,
        });

        if (strikeResult.success) {
          console.log(`[strike] ${strikeResult.reason}: ${strikePlan.targetPagePath} (+${strikeResult.wordsAdded} words, ${strikeResult.queriesTargeted.length} queries)`);

          // Post-refresh near-duplicate check
          let revertNeeded = false;
          try {
            const qualityConfig = loadJson(join(__dirname, '..', 'config', 'quality.json'), {});
            const afterPages = listHtmlPages(buildOutput.outputDir, { canonicalStrategy: config.canonicalStrategy });
            const afterNearDup = detectNearDuplicates(afterPages, qualityConfig, blogResult.posts);
            const newPairsCount = afterNearDup.pairs?.length || 0;
            const oldPairsCount = qualitySignals.nearDuplicatePairsCount || 0;
            if (newPairsCount > oldPairsCount) {
              console.log(`[strike] Near-duplicate count increased (${oldPairsCount} -> ${newPairsCount}) — reverting`);
              revertNeeded = true;
            }
          } catch (err) {
            console.warn(`[strike] Post-refresh quality check error (non-fatal): ${err.message}`);
          }

          if (revertNeeded) {
            revertStrikingRefresh(strikeResult.filePath, strikeResult.originalContent);
            report.strikingRefresh.action = 'reverted';
            report.strikingRefresh.reason = 'reverted_near_duplicate';
            console.log(`[strike] Reverted refresh of ${strikePlan.targetPagePath}`);
          } else {
            strikingRefreshDone = true;

            // Track state
            state.strikingRefresh = state.strikingRefresh || { history: [] };
            state.strikingRefresh.lastRefreshAt = new Date().toISOString();
            state.strikingRefresh.lastTargetPath = strikePlan.targetPagePath;
            state.strikingRefresh.history = state.strikingRefresh.history || [];
            state.strikingRefresh.history.push({
              pagePath: strikePlan.targetPagePath,
              at: new Date().toISOString(),
              queries: strikeResult.queriesTargeted,
              wordsAdded: strikeResult.wordsAdded,
            });
            if (state.strikingRefresh.history.length > 50) {
              state.strikingRefresh.history = state.strikingRefresh.history.slice(-50);
            }

            moduleOutcomes.content = {
              lastRunAt: new Date().toISOString(),
              action: 'striking-refresh',
              target: strikePlan.targetPagePath,
            };
          }
        } else {
          console.log(`[strike] Execution failed: ${strikeResult.reason}`);
          report.strikingRefresh.reason = strikeResult.reason;
        }
      }
    } catch (err) {
      report.errors.push(`strikingRefresh: ${err.message}`);
      console.error('[seo-autopilot] Striking refresh error (non-fatal):', err.message);
    }
  }

  // Refresh or Publish focus: run content engine (skip if striking-refresh already acted)
  if ((focus === 'refresh' || focus === 'publish') && focusPlan.budgets.contentActionAllowed && !strikingRefreshDone) {
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
        qualitySignals,
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
            await writeJsonStable(BACKLOG_PATH, backlog);
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
              await writeJsonStable(RELATED_GUIDES_PATH, guides);
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

  // Area page expansion (Chunk 11) — runs as refresh subtype when no content/striking action was taken
  if (focus === 'refresh' && report.content.action === 'none' && !strikingRefreshDone && pages) {
    try {
      console.log('\n=== AREA EXPANSION ===');

      // Check indexing gate: skip if LIVE_NOINDEX or LIVE_ROBOTS_TXT_BLOCKING exist
      const liveCritical = (report.live?.issueCounts?.LIVE_NOINDEX || 0) + (report.live?.issueCounts?.LIVE_ROBOTS_TXT_BLOCKING || 0);
      if (liveCritical > 0) {
        console.log(`[areas] Skipped: ${liveCritical} critical live indexing issue(s)`);
        report.areas.reason = 'live_indexing_gate';
      } else {
        const areaDiscovery = discoverAreas(pages);
        console.log(`[areas] Discovered ${areaDiscovery.areaRoutes.length} area route(s)`);

        const areaPlan = planAreaExpansion({
          areaRoutes: areaDiscovery.areaRoutes,
          thinRankIntent: qualitySignals.thinRankIntent || [],
          linkGraphInDegree: linkGraphBefore?.inDegree || {},
          areasConfig: areaDiscovery.config,
          nearDuplicatePairs: qualitySignals.nearDuplicatePairs || [],
          state,
        });

        if (areaPlan.selected) {
          console.log(`[areas] Selected: ${areaPlan.selected} (${areaPlan.reason})`);
          const expandResult = expandAreaPage({
            routePath: areaPlan.selected,
            maxWordsAdd: areaDiscovery.config.maxWordsAddPerRun || 600,
            intent: 'sellerIntent',
          });

          if (expandResult.success) {
            console.log(`[areas] Expanded: ${areaPlan.selected} — ${expandResult.wordsBefore} -> ${expandResult.wordsAfter} words`);

            // Post-expansion quality check: re-run near-duplicate on bounded set
            let revertNeeded = false;
            try {
              const qualityConfig = loadJson(join(__dirname, '..', 'config', 'quality.json'), {});
              const afterPages = listHtmlPages(buildOutput.outputDir, { canonicalStrategy: config.canonicalStrategy });
              const afterNearDup = detectNearDuplicates(afterPages, qualityConfig, blogResult.posts);
              const newPairsCount = afterNearDup.pairs?.length || 0;
              const oldPairsCount = qualitySignals.nearDuplicatePairsCount || 0;
              if (newPairsCount > oldPairsCount) {
                console.log(`[areas] Near-duplicate count increased (${oldPairsCount} -> ${newPairsCount}) — reverting`);
                revertNeeded = true;
              }
            } catch (err) {
              console.warn(`[areas] Post-expansion quality check error (non-fatal): ${err.message}`);
            }

            if (revertNeeded) {
              revertAreaExpansion(expandResult.filePath, expandResult.originalContent);
              report.areas = { selected: areaPlan.selected, wordsBefore: expandResult.wordsBefore, wordsAfter: expandResult.wordsBefore, linksAdded: [], reason: 'reverted_near_duplicate' };
              console.log(`[areas] Reverted expansion of ${areaPlan.selected}`);
            } else {
              report.areas = { selected: areaPlan.selected, wordsBefore: expandResult.wordsBefore, wordsAfter: expandResult.wordsAfter, linksAdded: expandResult.linksAdded, reason: expandResult.reason };

              // Update state
              state.areas = state.areas || { expandedHistory: [] };
              state.areas.lastExpandedAt = new Date().toISOString();
              state.areas.lastExpandedRoute = areaPlan.selected;
              state.areas.expandedHistory = state.areas.expandedHistory || [];
              state.areas.expandedHistory.push({ route: areaPlan.selected, at: new Date().toISOString() });
              if (state.areas.expandedHistory.length > 50) {
                state.areas.expandedHistory = state.areas.expandedHistory.slice(-50);
              }
            }
          } else {
            console.log(`[areas] Expansion failed: ${expandResult.reason}`);
            report.areas.reason = expandResult.reason;
          }
        } else {
          console.log(`[areas] No area selected: ${areaPlan.reason}`);
          report.areas.reason = areaPlan.reason;
        }
      }
    } catch (err) {
      report.errors.push(`areaExpansion: ${err.message}`);
      console.error('[seo-autopilot] Area expansion error (non-fatal):', err.message);
    }
  }

  // Money page enhancement (Chunk 16)
  if (focus === 'money') {
    try {
      console.log('\n=== MONEY PAGE ENHANCEMENT ===');
      const moneyRoutes = config.moneyRoutes || [];
      // Pick the first money route that has enhancement config and isn't complete
      let enhanced = false;
      for (const route of moneyRoutes) {
        if (enhanced) break;
        const result = enhanceMoneyPage({ routePath: route, intents: moneyIntents });
        if (result.success) {
          console.log(`[money] Enhanced ${route}: ${result.reason} (${result.sectionsAdded} sections, ${result.faqAdded} FAQ, schema: ${result.schemaAdded})`);
          report.moneyEnhancements.push({
            route,
            blockUpdated: true,
            sectionsAdded: result.sectionsAdded,
            faqAdded: result.faqAdded,
            schemaAdded: result.schemaAdded,
          });

          // Post-enhancement quality check: re-run build audit
          try {
            const afterPages = listHtmlPages(buildOutput.outputDir, { canonicalStrategy: config.canonicalStrategy });
            const afterCheck = runBuildAudit(afterPages, config);
            const afterClass = classifyIssues(afterCheck, config.rankIntentRoutes || []);
            if (afterClass.criticalCount > techClassification.criticalCount) {
              console.log(`[money] Critical issues increased — reverting ${route}`);
              revertMoneyEnhancement(result.filePath, result.originalContent);
              report.moneyEnhancements[report.moneyEnhancements.length - 1].blockUpdated = false;
              report.moneyEnhancements[report.moneyEnhancements.length - 1].reason = 'reverted_critical_increase';
            }
          } catch (err) {
            console.warn(`[money] Post-check error (non-fatal): ${err.message}`);
          }

          // Track state
          state.money = state.money || { enhancementsHistory: [] };
          state.money.lastEnhancedAt = new Date().toISOString();
          state.money.lastEnhancedRoute = route;
          state.money.enhancementsHistory.push({ route, at: new Date().toISOString() });
          if (state.money.enhancementsHistory.length > 50) {
            state.money.enhancementsHistory = state.money.enhancementsHistory.slice(-50);
          }

          moduleOutcomes.money = { lastRunAt: new Date().toISOString(), route, action: result.reason };
          enhanced = true;
        } else if (result.reason !== 'block_already_complete' && result.reason !== 'empty_block_config') {
          console.log(`[money] Skipped ${route}: ${result.reason}`);
        }
      }
      if (!enhanced) {
        console.log('[money] All money pages already enhanced or no eligible pages');
      }
    } catch (err) {
      report.errors.push(`moneyEnhance: ${err.message}`);
      console.error('[seo-autopilot] Money page enhancement error (non-fatal):', err.message);
    }
  }

  // No-focus: just log
  if (focus === 'none') {
    console.log('\n[focus] No actions taken this run');
  }

  // ─────────────────────────── SAFETY: DIFF BUDGET CHECK ─────────────────
  if (baselineSha && !reverted) {
    try {
      const budgetResult = checkDiffBudget({ baselineSha });
      report.safety.stats = budgetResult.stats;
      if (!budgetResult.ok) {
        console.log(`\n[safety] Budget exceeded: ${budgetResult.reason}`);
        console.log('[safety] Reverting to baseline...');
        const rv = revertToSha(baselineSha);
        if (rv.ok) {
          reverted = true;
          report.safety.reverted = true;
          report.safety.reason = budgetResult.reason;
          console.log(`[safety] Reverted to ${baselineSha}`);
        } else {
          console.warn(`[safety] Revert failed: ${rv.reason}`);
          report.errors.push(`safety_revert: ${rv.reason}`);
        }
      }
    } catch (err) {
      report.errors.push(`diffBudget: ${err.message}`);
      console.warn(`[safety] Diff budget check error (non-fatal): ${err.message}`);
    }
  }

  // ─────────────────────────── PHASE 4: AFTER-AUDIT ────────────────────────

  if (pages) {
    try {
      const afterPages = listHtmlPages(buildOutput.outputDir, { canonicalStrategy: config.canonicalStrategy });
      const afterAudit = runBuildAudit(afterPages, config);
      report.afterAudit = {
        pagesScanned: afterAudit.totals.pagesScanned, issuesTotal: afterAudit.totals.issuesTotal,
        issueCounts: afterAudit.totals.issueCounts, samples: afterAudit.samples, ...(DEBUG ? { pages: afterAudit.pages } : {}),
      };
      if (DEBUG) {
        console.log('\n=== AFTER AUDIT ===');
        printAuditSummary(afterAudit);
      } else {
        console.log(`\n[audit:after] ${afterAudit.totals.pagesScanned} pages, ${afterAudit.totals.issuesTotal} issues`);
      }

      const linkGraphAfter = buildLinkGraph(afterPages, config);
      report.linkGraphAfter = linkGraphSummary(linkGraphAfter);
      if (DEBUG) {
        console.log('=== LINK GRAPH (AFTER) ===');
        printLinkGraphSummary(linkGraphAfter);
      }

      // Diffs
      if (report.beforeAudit) {
        report.diff = computeDiff(report.beforeAudit.issueCounts, report.afterAudit.issueCounts);
        if (DEBUG) {
          const diffEntries = Object.entries(report.diff);
          if (diffEntries.length > 0) {
            console.log('=== DIFF ===');
            for (const [code, { before, after, delta }] of diffEntries) {
              console.log(`  ${code}: ${before} -> ${after} (${delta > 0 ? '+' : ''}${delta})`);
            }
          }
        }
      }
      if (DEBUG && report.linkGraphBefore && report.linkGraphAfter) {
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

      // ── SAFETY: AUDIT DELTA CHECK ──
      if (!reverted && baselineSha && beforeAudit) {
        try {
          const afterClass = classifyIssues(afterAudit, config.rankIntentRoutes || []);
          const auditDelta = computeAuditDelta({
            before: {
              criticalCount: techClassification.criticalCount,
              brokenLinkCount: techClassification.brokenInternalLinks,
              issueCounts: beforeAudit.totals.issueCounts,
            },
            after: {
              criticalCount: afterClass.criticalCount,
              brokenLinkCount: afterClass.brokenInternalLinks,
              issueCounts: afterAudit.totals.issueCounts,
            },
          });
          report.safety.auditDelta = auditDelta;

          // Also check for live noindex if configured
          const liveNoindex = (report.live?.issueCounts?.LIVE_NOINDEX || 0) > 0;
          const safetyRevertConfig = safetyConfig.revertIfWorse || {};
          const liveNoindexTrigger = safetyRevertConfig.liveNoindexDetected && liveNoindex;

          if (auditDelta.shouldRevert || liveNoindexTrigger) {
            const reasons = [...(auditDelta.reasons || [])];
            if (liveNoindexTrigger) reasons.push('live noindex detected');
            console.log(`\n[safety] Audit regression detected: ${reasons.join('; ')}`);
            console.log('[safety] Reverting to baseline...');
            const rv = revertToSha(baselineSha);
            if (rv.ok) {
              reverted = true;
              report.safety.reverted = true;
              report.safety.reason = reasons.join('; ');
              console.log(`[safety] Reverted to ${baselineSha}`);
            } else {
              console.warn(`[safety] Revert failed: ${rv.reason}`);
              report.errors.push(`safety_revert: ${rv.reason}`);
            }
          }
        } catch (err) {
          report.errors.push(`auditDelta: ${err.message}`);
          console.warn(`[safety] Audit delta check error (non-fatal): ${err.message}`);
        }
      }
    } catch (err) {
      report.errors.push(`afterAudit: ${err.message}`);
      console.error('[seo-autopilot] After-audit error (non-fatal):', err.message);
    }
  }

  // ─────────────────────────── PHASE 5: PERSIST STATE ──────────────────────

  // No-op fast path: skip score-history write if unchanged
  if (!noOpFastPath) {
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
        content: { thinCount, nearDuplicatePairsCount: qualitySignals.nearDuplicatePairsCount || 0, lastAction: report.content.action },
      },
      decisions: { focus, actionsPlanned: 1, actionsApplied: focus === 'none' ? 0 : 1 },
    });
    if (scoreHistory.runs.length > 120) {
      scoreHistory.runs = scoreHistory.runs.slice(-120);
    }
  }

  // Update safety state
  if (reverted) {
    state.safety = {
      ...(state.safety || {}),
      lastGoodSha: state.safety?.lastGoodSha || baselineSha,
      consecutiveReverts: (state.safety?.consecutiveReverts || 0) + 1,
      lastRevertAt: new Date().toISOString(),
      lastRevertReason: report.safety.reason,
    };
    console.log(`[safety] Consecutive reverts: ${state.safety.consecutiveReverts}`);
  } else {
    const currentSha = getHeadSha();
    state.safety = {
      ...(state.safety || {}),
      lastGoodSha: currentSha || baselineSha,
      lastGoodAt: new Date().toISOString(),
      consecutiveReverts: 0,
    };
    // Save post-run snapshot
    try {
      await saveSnapshot({ headSha: currentSha, reason: 'post_run_ok', focus });
    } catch { /* non-fatal */ }
  }

  await saveState(state);
  if (!noOpFastPath) {
    await saveScoreHistory(scoreHistory);
  }
  await saveModuleOutcomes(moduleOutcomes);

  // Run housekeeping to trim state files
  try {
    const hk = await runHousekeeping();
    if (hk.trimmed.length > 0) {
      console.log(`[housekeeping] Trimmed: ${hk.trimmed.join(', ')}`);
    }
  } catch { /* non-fatal */ }

  report.moduleOutcomes = moduleOutcomes;
  report.durationMs = Date.now() - start;

  // Write report (using stable JSON serialization)
  await writeJsonStable(join(REPORT_DIR, 'latest.json'), report);
  if (report.linkGraphAfter) {
    await writeJsonStable(join(REPORT_DIR, 'link-graph.json'), report.linkGraphAfter);
  }

  console.log(`\n[seo-autopilot] Done in ${report.durationMs}ms`);
}

main().catch((err) => {
  console.error('[seo-autopilot] Unexpected error (non-fatal):', err);
  process.exit(0);
});
