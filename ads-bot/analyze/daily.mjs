#!/usr/bin/env node
/**
 * Daily Deterministic Analyzer
 * Reads snapshots from /ops/snapshots/ and metrics.json thresholds,
 * produces a deterministic report in /ops/reports/daily-YYYY-MM-DD.md
 *
 * No freeform LLM decisions — all rules + thresholds from metrics.json.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function loadJSON(path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function analyze() {
  const date = yesterday();
  const snapshotDir = join(ROOT, 'ops', 'snapshots', date);
  const reportDir = join(ROOT, 'ops', 'reports');
  await mkdir(reportDir, { recursive: true });

  // Load metrics config
  const metrics = await loadJSON(join(ROOT, 'ops', 'metrics.json'));
  if (!metrics) {
    console.error('[analyze] Cannot load /ops/metrics.json');
    process.exit(1);
  }

  // Load snapshots
  const ads = await loadJSON(join(snapshotDir, 'google-ads.json'));
  const gsc = await loadJSON(join(snapshotDir, 'gsc.json'));
  const ga4 = await loadJSON(join(snapshotDir, 'ga4.json'));

  // Load experiment log for learning
  const experiments = await loadJSON(join(ROOT, 'ops', 'experiments', 'experiment-log.json')) || [];

  const sections = [];
  const actions = { ads: [], seo: [], landingPage: [], content: [], nav: [] };

  // ── ADS ANALYSIS ─────────────────────────────────────────
  sections.push('## Ads Actions\n');

  if (ads && ads.status === 'success') {
    // Identify wasteful search terms (spend > threshold, no conversions)
    const wastefulTerms = (ads.searchTerms || []).filter(st =>
      st.cost > (metrics.guardrails?.minSpendForNegative || 5) && st.conversions === 0
    );
    if (wastefulTerms.length > 0) {
      sections.push(`### Negative Keywords to Add (${wastefulTerms.length})\n`);
      wastefulTerms.forEach(st => {
        sections.push(`- **"${st.term}"** — $${st.cost.toFixed(2)} spent, ${st.clicks} clicks, 0 conversions`);
        actions.ads.push({ type: 'negative_add', term: st.term, reason: `$${st.cost.toFixed(2)} spent with 0 conversions` });
      });
      sections.push('');
    }

    // Keywords to pause (high spend, low quality score, no conversions over threshold)
    const minClicksForPause = metrics.guardrails?.minClicksBeforePause || 20;
    const keywordsToPause = (ads.keywords || []).filter(k =>
      k.clicks >= minClicksForPause && k.conversions === 0 && (k.qualityScore === null || k.qualityScore < 4)
    );
    if (keywordsToPause.length > 0) {
      sections.push(`### Keywords to Pause (${keywordsToPause.length})\n`);
      keywordsToPause.forEach(k => {
        sections.push(`- **"${k.text}"** (${k.matchType}) — ${k.clicks} clicks, $${k.cost.toFixed(2)}, QS: ${k.qualityScore || 'N/A'}`);
        actions.ads.push({ type: 'keyword_pause', keyword: k.text, matchType: k.matchType, reason: `${k.clicks} clicks, 0 conversions` });
      });
      sections.push('');
    }

    // Budget shift recommendations
    const campaignsWithConv = (ads.campaigns || []).filter(c => c.conversions > 0);
    const campaignsNoConv = (ads.campaigns || []).filter(c => c.conversions === 0 && c.cost > 10);
    if (campaignsWithConv.length > 0 && campaignsNoConv.length > 0) {
      const maxBudgetDelta = metrics.guardrails?.maxDailyBudgetChangePct || 10;
      sections.push(`### Budget Shift Recommendations (capped at ±${maxBudgetDelta}%)\n`);
      campaignsNoConv.forEach(c => {
        sections.push(`- **${c.name}**: Consider reducing budget — $${c.cost.toFixed(2)} spent, 0 conversions`);
        actions.ads.push({ type: 'budget_decrease', campaign: c.name, reason: 'No conversions', maxDeltaPct: maxBudgetDelta });
      });
      campaignsWithConv.forEach(c => {
        const cpa = c.cost / c.conversions;
        if (cpa < (metrics.targets?.maxCPA || 50)) {
          sections.push(`- **${c.name}**: Consider increasing budget — CPA $${cpa.toFixed(2)} (below target)`);
          actions.ads.push({ type: 'budget_increase', campaign: c.name, reason: `CPA $${cpa.toFixed(2)}`, maxDeltaPct: maxBudgetDelta });
        }
      });
      sections.push('');
    }

    // Total spend summary
    const totalSpend = (ads.campaigns || []).reduce((sum, c) => sum + c.cost, 0);
    const totalConv = (ads.campaigns || []).reduce((sum, c) => sum + c.conversions, 0);
    sections.push(`**Daily Summary:** $${totalSpend.toFixed(2)} spent, ${totalConv} conversions\n`);
  } else {
    sections.push('_No Google Ads data available for this date._\n');
  }

  // ── SEO ANALYSIS ─────────────────────────────────────────
  sections.push('## SEO Actions\n');

  if (gsc && gsc.status === 'success') {
    // Pages losing position (position > target for key queries)
    const targetPosition = metrics.targets?.avgPosition || 10;
    const lowPositionPages = (gsc.pages || []).filter(p =>
      p.position > targetPosition && p.impressions > 50
    );
    if (lowPositionPages.length > 0) {
      sections.push(`### Pages Below Target Position (>${targetPosition})\n`);
      lowPositionPages.slice(0, 10).forEach(p => {
        sections.push(`- **${p.page}** — Position ${p.position.toFixed(1)}, ${p.impressions} impressions, CTR ${(p.ctr * 100).toFixed(1)}%`);
        actions.seo.push({ type: 'page_improve', page: p.page, position: p.position, reason: 'Below target position' });
      });
      sections.push('');
    }

    // High-impression, low-CTR queries (opportunity for title/description improvement)
    const lowCTRQueries = (gsc.queries || []).filter(q =>
      q.impressions > 100 && q.ctr < 0.03 && q.position < 20
    );
    if (lowCTRQueries.length > 0) {
      sections.push(`### Low CTR Queries (CTR < 3%, 100+ impressions)\n`);
      lowCTRQueries.slice(0, 10).forEach(q => {
        sections.push(`- **"${q.query}"** — Position ${q.position.toFixed(1)}, ${q.impressions} impressions, CTR ${(q.ctr * 100).toFixed(1)}%`);
        actions.seo.push({ type: 'title_description_improve', query: q.query, reason: 'Low CTR' });
      });
      sections.push('');
    }

    // Summary
    const totalClicks = (gsc.queries || []).reduce((s, q) => s + q.clicks, 0);
    const totalImpressions = (gsc.queries || []).reduce((s, q) => s + q.impressions, 0);
    sections.push(`**GSC Summary:** ${totalClicks} clicks, ${totalImpressions} impressions (7-day)\n`);
  } else {
    sections.push('_No GSC data available for this date._\n');
  }

  // ── LANDING PAGE ANALYSIS ────────────────────────────────
  sections.push('## Landing Page Actions\n');

  if (ga4 && ga4.status === 'success') {
    // High bounce pages
    const highBouncePages = (ga4.landingPages || []).filter(p =>
      p.sessions >= 10 && p.bounceRate > (metrics.guardrails?.maxBounceRate || 0.7)
    );
    if (highBouncePages.length > 0) {
      sections.push(`### High Bounce Rate Pages (>${(metrics.guardrails?.maxBounceRate || 0.7) * 100}%)\n`);
      highBouncePages.slice(0, 10).forEach(p => {
        sections.push(`- **${p.page}** — ${(p.bounceRate * 100).toFixed(0)}% bounce, ${p.sessions} sessions, ${p.avgDuration.toFixed(0)}s avg duration`);
        actions.landingPage.push({ type: 'reduce_bounce', page: p.page, bounceRate: p.bounceRate });
      });
      sections.push('');
    }

    // Conversion events summary
    const convEvents = (ga4.events || []).reduce((acc, e) => {
      acc[e.event] = (acc[e.event] || 0) + e.count;
      return acc;
    }, {});
    if (Object.keys(convEvents).length > 0) {
      sections.push('### Conversion Events Summary\n');
      Object.entries(convEvents).sort((a, b) => b[1] - a[1]).forEach(([event, count]) => {
        sections.push(`- **${event}**: ${count}`);
      });
      sections.push('');
    }
  } else {
    sections.push('_No GA4 data available for this date._\n');
  }

  // ── CONTENT ACTIONS ──────────────────────────────────────
  sections.push('## Content Actions\n');

  if (gsc && gsc.status === 'success') {
    // Search terms that indicate new page opportunities
    const existingPages = new Set((gsc.pages || []).map(p => p.page));
    const newPageOpportunities = (gsc.queries || []).filter(q =>
      q.impressions > 50 && q.clicks < 2 && q.position > 15
    );
    if (newPageOpportunities.length > 0) {
      sections.push(`### Potential New Page Opportunities\n`);
      newPageOpportunities.slice(0, 10).forEach(q => {
        sections.push(`- **"${q.query}"** — ${q.impressions} impressions, position ${q.position.toFixed(1)}`);
        actions.content.push({ type: 'new_page', query: q.query, impressions: q.impressions });
      });
      sections.push('');
    }
  }

  sections.push('## Nav/UX Actions\n');
  sections.push('_Automated nav/UX checks run in CI. See CI results for details._\n');

  // ── COMPOSE REPORT ───────────────────────────────────────
  const report = `# Daily Report — ${date}

Generated: ${new Date().toISOString()}

${sections.join('\n')}

---

_Report generated by /ads-bot/analyze/daily.mjs using rules from /ops/metrics.json_
`;

  await writeFile(join(reportDir, `daily-${date}.md`), report);
  console.log(`[analyze] Wrote report to /ops/reports/daily-${date}.md`);

  // Write actions JSON for plan generator
  await writeFile(join(reportDir, `daily-${date}.actions.json`), JSON.stringify(actions, null, 2));
  console.log(`[analyze] Wrote actions to /ops/reports/daily-${date}.actions.json`);

  return { report, actions };
}

export { analyze };

analyze();
