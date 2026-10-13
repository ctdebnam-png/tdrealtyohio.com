#!/usr/bin/env node
/**
 * Route reachability check.
 *
 * Serves the site the way Cloudflare Pages does — `wrangler pages dev`, which
 * reads _redirects and _headers with the real matching semantics — and fetches
 * every route in src/config/routes.js.
 *
 * Fails on:
 *   - any status other than 200 at the end of the chain
 *   - a redirect chain longer than MAX_HOPS (1), which is what an infinite
 *     redirect looks like from the outside
 *
 * This exists because four trailing globs in _redirects matched the canonical
 * pages they pointed at, and /buyers/, /sellers/ and /areas/ 301'd to
 * themselves on the live site. Every other check in this repo reads files off
 * disk; none of them served a request, so none of them could see it.
 *
 * A sample of retired paths is also checked, so a future edit cannot silently
 * drop the redirects that keep old inbound links working.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { ROUTES } = require('../src/config/routes.js');
const { GONE_URLS } = await import('../src/config/gone-urls.mjs');

const PORT = Number(process.env.CHECK_ROUTES_PORT || 8791);
const BASE = `http://127.0.0.1:${PORT}`;
const MAX_HOPS = 1;
const BOOT_TIMEOUT_MS = 180_000;

/**
 * Retired paths that must still land somewhere useful in one hop. Not
 * exhaustive — a representative entry per retired family, so a glob that stops
 * matching is noticed.
 */
const RETIRED = [
  ['/areas/upper-arlington/', '/areas/'],
  ['/areas/zip/43081/', '/areas/'],
  ['/buyers/first-time/dublin/', '/buyers/'],
  ['/sell/net-sheet/', '/sellers/'],
  ['/buy/pre-approval/', '/buyers/'],
  ['/blog/closing-costs-columbus-ohio/', '/about/'],
  ['/faq/', '/contact/'],
  ['/sitemap-page/', '/'],
  // Trailing-slash normalisation.
  ['/buyers', '/buyers/'],
  ['/sellers', '/sellers/'],
  ['/areas', '/areas/'],
];

/*
 * /tools/seller-net-proceeds/, /compare/1-percent-vs-3-percent/ and
 * /home-value/ used to be sampled here as redirects. They are now on the gone
 * list and answer 410, which is the point of that list, so asserting a 301 for
 * them asserts the opposite of the intended behaviour. They are covered by the
 * gone-URL section below instead.
 *
 * _redirects still carries /tools/* and /compare/* rules. They are no longer
 * reachable for any path this repo knows about, because every /tools/ and
 * /compare/ URL that ever existed is on the gone list and Functions run first.
 * They survive only as a fallback for paths that never existed, which is
 * harmless — but if the gone list is ever trimmed, those rules are what the
 * trimmed paths fall back to.
 */

const errors = [];

function fail(msg) {
  errors.push(msg);
}

/**
 * Waits until _redirects is actually in force, not merely until the server
 * answers.
 *
 * wrangler starts serving static assets before it has compiled the redirect
 * rules. A probe that accepts any response therefore races: the same broken
 * _redirects produced three self-redirects on one run and none at all on the
 * next, because the second run got in first. A check that reports "all routes
 * 200" while the rules are still loading is worse than no check.
 *
 * /index.html -> / is a static, unconditional rule near the top of the file, so
 * a 301 on it means the file has been parsed and applied.
 */
const READY_PROBE = { path: '/index.html', expect: 301 };

async function waitForServer() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let sawServer = false;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}${READY_PROBE.path}`, { redirect: 'manual' });
      sawServer = true;
      if (res.status === READY_PROBE.expect) return { ok: true };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    ok: false,
    reason: sawServer
      ? `server answered but ${READY_PROBE.path} never returned ${READY_PROBE.expect} — ` +
        '_redirects was not applied (malformed file, or it no longer contains that rule)'
      : 'server never became reachable',
  };
}

/**
 * Walks the redirect chain by hand. fetch's own `redirect: 'follow'` throws a
 * generic error on a loop and does not say how long the chain was, which is the
 * detail that makes the failure diagnosable.
 */
async function trace(path) {
  const chain = [];
  let url = `${BASE}${path}`;

  for (let hop = 0; hop <= MAX_HOPS + 1; hop++) {
    const res = await fetch(url, { redirect: 'manual' });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { chain, status: res.status, error: `${res.status} with no Location header` };
      }
      const next = new URL(location, url).href;
      chain.push({ from: url, to: next, status: res.status });
      if (next === url) {
        return { chain, status: res.status, error: 'redirects to itself' };
      }
      url = next;
      continue;
    }

    return { chain, status: res.status, final: url };
  }

  return { chain, status: null, error: `more than ${MAX_HOPS + 1} redirects` };
}

function pathOf(href) {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

async function main() {
  console.log('[check-routes] starting wrangler pages dev...');

  const server = spawn(
    'npx',
    ['wrangler', 'pages', 'dev', '.', '--port', String(PORT), '--ip', '127.0.0.1'],
    {
      cwd: ROOT,
      stdio: 'ignore',
      detached: false,
      // wrangler phones workers.cloudflare.com and sparrow.cloudflare.com on
      // startup. Where egress is blocked those calls hang until they time out,
      // which is most of the boot time and makes readiness unpredictable.
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' },
    },
  );

  let exitCode = 0;
  try {
    const ready = await waitForServer();
    if (!ready.ok) {
      console.error(`[check-routes] not ready: ${ready.reason}`);
      return 1;
    }
    console.log(`[check-routes] ready on ${BASE} (_redirects confirmed active)\n`);

    console.log(`Canonical routes (${ROUTES.length}) — must be 200 in ${MAX_HOPS} hop(s) or fewer:`);
    for (const route of ROUTES) {
      const r = await trace(route.path);
      const hops = r.chain.length;

      if (r.error) {
        fail(`${route.path}: ${r.error} (${hops} hop(s) followed)`);
        console.log(`  X  ${route.path.padEnd(20)} ${r.error}`);
        continue;
      }
      if (hops > MAX_HOPS) {
        fail(`${route.path}: ${hops} redirect hops, limit is ${MAX_HOPS}`);
        console.log(`  X  ${route.path.padEnd(20)} ${hops} hops`);
        continue;
      }
      if (r.status !== 200) {
        fail(`${route.path}: final status ${r.status}`);
        console.log(`  X  ${route.path.padEnd(20)} ${r.status}`);
        continue;
      }
      console.log(`  ok ${route.path.padEnd(20)} 200${hops ? ` (${hops} hop)` : ''}`);
    }

    console.log(`\nRetired paths (${RETIRED.length}) — must reach their target in one hop:`);
    for (const [from, expected] of RETIRED) {
      const r = await trace(from);
      const hops = r.chain.length;

      if (r.error) {
        fail(`${from}: ${r.error}`);
        console.log(`  X  ${from.padEnd(38)} ${r.error}`);
        continue;
      }
      if (hops === 0) {
        fail(`${from}: expected a redirect to ${expected}, got ${r.status} directly`);
        console.log(`  X  ${from.padEnd(38)} no redirect`);
        continue;
      }
      if (hops > MAX_HOPS) {
        fail(`${from}: ${hops} redirect hops, limit is ${MAX_HOPS}`);
        console.log(`  X  ${from.padEnd(38)} ${hops} hops`);
        continue;
      }
      const landed = pathOf(r.final);
      if (landed !== expected) {
        fail(`${from}: landed on ${landed}, expected ${expected}`);
        console.log(`  X  ${from.padEnd(38)} -> ${landed} (want ${expected})`);
        continue;
      }
      if (r.status !== 200) {
        fail(`${from}: ${expected} returned ${r.status}`);
        console.log(`  X  ${from.padEnd(38)} -> ${landed} ${r.status}`);
        continue;
      }
      console.log(`  ok ${from.padEnd(38)} -> ${landed}`);
    }

    /*
     * Every URL on the gone list must actually answer 410.
     *
     * Checked here rather than in check-gone-urls.mjs because this is the only
     * check with a server running, and 410 is a behaviour, not a fact about a
     * file: the middleware has to be reached, its import of the data file has
     * to resolve inside the Functions bundle, and it has to win over any
     * _redirects rule for the same path. A static check of the array proves
     * none of that.
     */
    console.log(`\nGone URLs (${GONE_URLS.length}) — must answer 410:`);
    let goneOk = 0;
    for (const url of GONE_URLS) {
      const res = await fetch(`${BASE}${url}`, { redirect: 'manual' });
      if (res.status === 410) {
        goneOk++;
        continue;
      }
      const where = res.headers.get('location');
      fail(`${url}: expected 410, got ${res.status}${where ? ` -> ${where}` : ''}`);
      console.log(`  X  ${url.padEnd(38)} ${res.status}${where ? ` -> ${where}` : ''}`);
    }
    console.log(`  ok ${goneOk} of ${GONE_URLS.length} answered 410`);

    console.log('');
    if (errors.length > 0) {
      console.error(`[check-routes] FAILED — ${errors.length} problem(s):`);
      errors.forEach((e) => console.error(`  - ${e}`));
      exitCode = 1;
    } else {
      console.log('[check-routes] all routes reachable, all retired paths land in one hop.');
    }
  } finally {
    server.kill('SIGTERM');
  }

  return exitCode;
}

process.exit(await main());
