import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { subcontractors as subcontractorsSchema, type Subcontractor } from '../schemas/subcontractors.js';
import { buyers as buyersSchema, type Buyer, type BuyerSegment } from '../schemas/buyers.js';
import { credentials as credentialsSchema, isPublishable, type Credential } from '../schemas/credentials.js';
import { services as servicesSchema, isPublicService, type Service } from '../schemas/services.js';
import { pricing as pricingSchema, type PriceItem } from '../schemas/pricing.js';
import { regulatory as regulatorySchema, type RegulatoryRequirement } from '../schemas/regulatory.js';
import { marketLanguage as marketLanguageSchema, type MarketLanguageEntry } from '../schemas/market-language.js';
import { team as teamSchema, type TeamMember } from '../schemas/team.js';

/**
 * Resolve /src/data by walking up from this module, then from the working
 * directory. Astro bundles this file into dist/chunks/ for the build, so a
 * path relative to import.meta.url alone does not survive; walking up finds the
 * project root from either location and keeps the scripts in /scripts working
 * when run from anywhere.
 */
const findDataDir = (): string => {
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = join(dir, 'src', 'data');
      if (existsSync(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error('Could not locate src/data from this module or the working directory');
};

export const DATA_DIR = findDataDir();

export class DataValidationError extends Error {}

/**
 * Read one YAML file and validate it. An empty file is a valid empty data set:
 * every file in /src/data ships empty and is filled in from research, so the
 * site has to render with nothing in it.
 */
export function loadData<T extends z.ZodTypeAny>(fileName: string, schema: T): z.infer<T> {
  const path = join(DATA_DIR, fileName);
  if (!existsSync(path)) {
    throw new DataValidationError(`${fileName} is missing from src/data/`);
  }

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new DataValidationError(
      `${fileName} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // A file holding only comments parses to null. That is a valid empty data
  // set: every file ships empty and is filled in from research.
  const records = raw === null || raw === undefined ? [] : raw;

  const result = schema.safeParse(records);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  ${fileName}[${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new DataValidationError(`${fileName} failed validation:\n${detail}`);
  }
  return result.data;
}

/** Every data file, in one place, so the validator and link checker agree. */
export const DATA_FILES = [
  { file: 'subcontractors.yaml', schema: subcontractorsSchema, surface: 'internal' },
  { file: 'buyers.yaml', schema: buyersSchema, surface: 'internal' },
  { file: 'credentials.yaml', schema: credentialsSchema, surface: 'public' },
  { file: 'services.yaml', schema: servicesSchema, surface: 'public' },
  { file: 'pricing.yaml', schema: pricingSchema, surface: 'internal' },
  { file: 'regulatory.yaml', schema: regulatorySchema, surface: 'internal' },
  { file: 'market-language.yaml', schema: marketLanguageSchema, surface: 'internal' },
  { file: 'team.yaml', schema: teamSchema, surface: 'public' },
] as const;

export const getSubcontractors = (): Subcontractor[] =>
  loadData('subcontractors.yaml', subcontractorsSchema);
export const getBuyers = (): Buyer[] => loadData('buyers.yaml', buyersSchema);
export const getCredentials = (): Credential[] => loadData('credentials.yaml', credentialsSchema);
export const getServices = (): Service[] => loadData('services.yaml', servicesSchema);
export const getPricing = (): PriceItem[] => loadData('pricing.yaml', pricingSchema);
export const getRegulatory = (): RegulatoryRequirement[] =>
  loadData('regulatory.yaml', regulatorySchema);
export const getMarketLanguage = (): MarketLanguageEntry[] =>
  loadData('market-language.yaml', marketLanguageSchema);
export const getTeam = (): TeamMember[] =>
  getTeamSorted(loadData('team.yaml', teamSchema));

const getTeamSorted = (members: TeamMember[]): TeamMember[] =>
  [...members].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

/** Services that may be built as public pages. Blocked services are internal only. */
export const getPublicServices = (): Service[] => getServices().filter(isPublicService);
export const getBlockedServices = (): Service[] =>
  getServices().filter((s) => s.delivery === 'blocked');

/** Credentials that may be shown publicly: displayable on join, or already earned. */
export const getPublishableCredentials = (): Credential[] =>
  getCredentials().filter(isPublishable);

/** Buyer segments that have a public /who-we-serve/ page. */
export const SEGMENT_LABELS: Record<BuyerSegment, { singular: string; plural: string; slug: string }> = {
  consulting_firm: { singular: 'Consulting firm', plural: 'Consulting firms', slug: 'consulting-firms' },
  lender: { singular: 'Lender', plural: 'Lenders', slug: 'lenders' },
  brokerage: { singular: 'Brokerage', plural: 'Brokerages', slug: 'brokerages' },
  title: { singular: 'Title company', plural: 'Title companies', slug: 'title-companies' },
  developer: { singular: 'Developer', plural: 'Developers', slug: 'developers' },
  attorney: { singular: 'Attorney', plural: 'Attorneys', slug: 'attorneys' },
  public_agency: { singular: 'Public agency', plural: 'Public agencies', slug: 'public-agencies' },
  land_bank: { singular: 'Land bank', plural: 'Land banks', slug: 'land-banks' },
  port_authority: { singular: 'Port authority', plural: 'Port authorities', slug: 'port-authorities' },
  utility: { singular: 'Utility', plural: 'Utilities', slug: 'utilities' },
};

export const SEGMENT_BY_SLUG: Record<string, BuyerSegment> = Object.fromEntries(
  Object.entries(SEGMENT_LABELS).map(([segment, meta]) => [meta.slug, segment as BuyerSegment]),
) as Record<string, BuyerSegment>;

export type { Subcontractor, Buyer, Credential, Service, PriceItem, RegulatoryRequirement, MarketLanguageEntry, TeamMember, BuyerSegment };
