#!/usr/bin/env tsx
/**
 * Link checker.
 *
 * Reads every `source_url` and `url` field across /src/data, issues a GET with
 * a browser User-Agent (several Ohio state sites answer 404 to default agents),
 * records the status code, and writes `verified_at` back into the data file for
 * every record whose URL answered 2xx. Comments in the YAML are preserved: the
 * files are edited through the YAML document AST, not re-dumped.
 *
 * Non-2xx results are written to /reports/broken-links.json. The script exits
 * non-zero — failing the build — if any URL that is referenced from a public
 * page is non-2xx. A broken URL on an internal-only record is reported and
 * allowed through, because nobody outside the firm will ever follow it.
 *
 * Usage:
 *   tsx scripts/check-links.ts             check, write verified_at, gate build
 *   tsx scripts/check-links.ts --no-write   check and report, change no files
 *   tsx scripts/check-links.ts --offline    skip the network (local dev only;
 *                                           never set this in CI or on a host)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument, isSeq, isMap, type Document } from 'yaml';

import { DATA_FILES, DATA_DIR } from '../src/lib/data.js';
import { RELATED_SITE } from '../src/lib/site.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = join(root, 'reports', 'broken-links.json');

const args = new Set(process.argv.slice(2));
const WRITE = !args.has('--no-write');
const OFFLINE = args.has('--offline') || process.env.LINK_CHECK_OFFLINE === '1';

/**
 * Several ohio.gov and epa.ohio.gov endpoints return 404 or 403 to a default
 * Node or curl agent and 200 to a browser. The checker therefore presents one.
 */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

const URL_FIELDS = ['source_url', 'url'] as const;
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;

type Entry = {
  file: string;
  index: number;
  field: string;
  url: string;
  record: string;
  public: boolean;
};

type Result = Entry & { status: number | null; error: string | null; ok: boolean };

/** Does this record reach a public page? Decides whether a bad URL breaks the build. */
const isRecordPublic = (file: string, record: Record<string, unknown>): boolean => {
  switch (file) {
    case 'services.yaml':
      return record.delivery !== 'blocked';
    case 'credentials.yaml':
      return record.displayable_on_join === true || record.earned_at != null;
    case 'team.yaml':
      return true;
    default:
      // subcontractors, buyers, pricing, regulatory, market-language are
      // rendered on /internal/ only.
      return false;
  }
};

const labelFor = (record: Record<string, unknown>, index: number): string => {
  const named = record.name ?? record.firm_name ?? record.item ?? record.requirement ?? record.slug;
  return typeof named === 'string' && named.length > 0 ? named : `record ${index}`;
};

// ---------------------------------------------------------------- collect ---

const documents = new Map<string, Document>();
const entries: Entry[] = [];

for (const { file } of DATA_FILES) {
  const path = join(DATA_DIR, file);
  const doc = parseDocument(readFileSync(path, 'utf8'));
  documents.set(file, doc);

  const contents = doc.contents;
  if (!isSeq(contents)) continue;

  contents.items.forEach((item, index) => {
    if (!isMap(item)) return;
    const plain = item.toJSON() as Record<string, unknown>;
    for (const field of URL_FIELDS) {
      const value = plain[field];
      if (typeof value !== 'string' || value.trim().length === 0) continue;
      entries.push({
        file,
        index,
        field,
        url: value.trim(),
        record: labelFor(plain, index),
        public: isRecordPublic(file, plain),
      });
    }
  });
}

// The one outbound link carried on every public page.
entries.push({
  file: '(site)',
  index: -1,
  field: 'RELATED_SITE.url',
  url: RELATED_SITE.url,
  record: RELATED_SITE.name,
  public: RELATED_SITE.public,
});

// ------------------------------------------------------------------ fetch ---

const fetchStatus = async (url: string): Promise<{ status: number | null; error: string | null }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    return { status: response.status, error: null };
  } catch (error) {
    return { status: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
};

const runPool = async (urls: string[]): Promise<Map<string, { status: number | null; error: string | null }>> => {
  const statuses = new Map<string, { status: number | null; error: string | null }>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      const outcome = await fetchStatus(url);
      statuses.set(url, outcome);
      const label = outcome.status ?? outcome.error ?? 'no response';
      console.log(`  ${String(label).padEnd(24)} ${url}`);
    }
  });
  await Promise.all(workers);
  return statuses;
};

const today = new Date().toISOString().slice(0, 10);

const main = async () => {
  if (entries.length === 0) {
    console.log('No URLs found in src/data. Nothing to check.');
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(
      REPORT_PATH,
      `${JSON.stringify({ checked_at: today, checked: 0, broken: [] }, null, 2)}\n`,
    );
    return;
  }

  if (OFFLINE) {
    console.warn(
      `Offline mode: ${entries.length} URL(s) left unchecked and no verified_at written.\n` +
        'Never use --offline in CI or on the deploy host.',
    );
    return;
  }

  const unique = [...new Set(entries.map((entry) => entry.url))];
  console.log(`Checking ${unique.length} unique URL(s) from ${entries.length} field(s):\n`);
  const statuses = await runPool(unique);

  const results: Result[] = entries.map((entry) => {
    const outcome = statuses.get(entry.url) ?? { status: null, error: 'not checked' };
    const ok = outcome.status !== null && outcome.status >= 200 && outcome.status < 300;
    return { ...entry, status: outcome.status, error: outcome.error, ok };
  });

  // ------------------------------------------------- write verified_at back ---
  if (WRITE) {
    const touched = new Set<string>();
    for (const result of results) {
      if (!result.ok || result.index < 0) continue;
      const doc = documents.get(result.file);
      if (!doc || !isSeq(doc.contents)) continue;
      const item = doc.contents.items[result.index];
      if (!isMap(item)) continue;
      if (item.get('verified_at') === today) continue;
      item.set('verified_at', today);
      touched.add(result.file);
    }
    for (const file of touched) {
      writeFileSync(join(DATA_DIR, file), documents.get(file)!.toString({ lineWidth: 0, flowCollectionPadding: false }));
      console.log(`\n  wrote verified_at: ${today} into ${file}`);
    }
  }

  // ------------------------------------------------------------- reporting ---
  const broken = results.filter((result) => !result.ok);
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        checked_at: today,
        checked: results.length,
        unique_urls: unique.length,
        broken: broken.map(({ file, record, field, url, status, error, public: isPublic }) => ({
          file,
          record,
          field,
          url,
          status,
          error,
          referenced_from_public_page: isPublic,
        })),
      },
      null,
      2,
    )}\n`,
  );

  const blocking = broken.filter((result) => result.public);
  console.log(
    `\n${results.length - broken.length}/${results.length} URL field(s) answered 2xx. ` +
      `${broken.length} did not.`,
  );

  if (broken.length > 0) {
    console.log(`Report written to reports/broken-links.json`);
    for (const result of broken) {
      const surface = result.public ? 'PUBLIC' : 'internal';
      console.log(
        `  [${surface}] ${result.file} -> ${result.record} (${result.field}): ` +
          `${result.status ?? result.error} ${result.url}`,
      );
    }
  }

  if (blocking.length > 0) {
    console.error(
      `\nBuild stopped: ${blocking.length} URL(s) referenced from a public page did not answer 2xx.\n` +
        'A URL that has not been checked is not published. Fix or null the URL and re-run.',
    );
    process.exit(1);
  }
};

await main();
