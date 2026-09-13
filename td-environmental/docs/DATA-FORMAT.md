# Data format

What to put in each file in `src/data`, field by field, with a worked example.
Every example here was pasted into the real schemas and validated before this
document was written; each one parses, builds, and passes the gates.

## Rules that apply to every file

**Every key must be present.** A field that accepts `null` still needs its key.
Omitting `address` is an error; `address: null` is correct. There is no "leave
it out if you don't have it" — the blank is the point, and it has to be written
down.

**Unknown means `null`, never a guess.** No plausible figures, no rounded
estimates, no "about £2,000". If you do not know a driller's day rate, `rates`
stays `null` and the column on `/internal/subcontractors/` stays empty until a
written quote fills it.

**Empty strings are rejected.** A required text field must carry real content.
`source_note: ""` fails validation. This is deliberate: every record has to say
where it came from.

**Provenance — four fields, on every record in every file:**

| field | type | notes |
| --- | --- | --- |
| `source_url` | URL string, or `null` | Must be a well-formed URL if present. `null` is normal and fine — a phone call has no URL. |
| `source_note` | string, **required, non-empty** | Where the fact came from, so someone else can retrace it. "Phone call with their dispatcher, 12 March 2026" is good. "Website" is not. |
| `verified_at` | `YYYY-MM-DD`, or `null` | **Do not fill this in by hand.** The link checker writes it. Paste `null`. |
| `confidence` | `sourced` \| `constructed` \| `unverified` | `sourced` = read it at the source. `constructed` = derived from sourced inputs. `unverified` = believed but unconfirmed. |

**YAML shape.** Each file is a list of records. Paste block sequences below the
comment header; do not add `[]`. Two-space indent. Quote anything that could be
read as a number or a date — ZIP codes especially: `zip: '43123'`, not `43123`.
For long prose use a folded scalar:

```yaml
  summary: >-
    First line of the passage, which
    continues here and becomes one paragraph.
```

---

## 1. `subcontractors.yaml` — firms that perform work you sell

Internal only. Renders on `/internal/subcontractors/` with blank rate columns.

| field | required | type / allowed values |
| --- | --- | --- |
| `category` | yes | `driller` \| `laboratory` \| `surveyor` \| `waste` \| `field_services` |
| `name` | yes | non-empty string |
| `address`, `city`, `state`, `zip` | key required | string or `null` |
| `phone` | key required | string or `null` — any format, not validated |
| `email` | key required | valid email or `null` |
| `url` | key required | valid URL or `null` |
| `capabilities` | optional | list of strings, defaults `[]` |
| `published_productivity` | key required | string or `null` — a stated rate of work, verbatim |
| `rates` | yes | **must be `null`** — the schema rejects any other value |
| `works_with_small_firms` | key required | `true` \| `false` \| `null` |
| `notes` | optional | string, defaults `""` |

```yaml
- category: driller
  name: Buckeye Drilling Services Inc
  address: 1200 Industrial Parkway
  city: Grove City
  state: OH
  zip: '43123'
  phone: (614) 555-0142
  email: dispatch@example.com
  url: https://example.com
  capabilities:
    - hollow-stem auger
    - direct push
    - well abandonment
  published_productivity: null
  rates: null
  works_with_small_firms: true
  notes: Two rigs. Asked about minimum day charge; they would not quote by phone.
  source_url: https://example.com
  source_note: Phone call with their dispatcher, 12 March 2026
  verified_at: null
  confidence: sourced
```

## 2. `buyers.yaml` — organisations that buy this work

Internal only, a call list. Named firms never reach a public page.

| field | required | type / allowed values |
| --- | --- | --- |
| `segment` | yes | `consulting_firm` \| `lender` \| `brokerage` \| `title` \| `developer` \| `attorney` \| `public_agency` \| `land_bank` \| `port_authority` \| `utility` |
| `name` | yes | non-empty string |
| `city`, `phone` | key required | string or `null` |
| `url` | key required | valid URL or `null` |
| `contact_path` | key required | string or `null` — the person, role, or intake route |
| `credentials_held` | optional | list of strings, defaults `[]` |
| `why_they_buy` | yes | non-empty string |

```yaml
- segment: consulting_firm
  name: Scioto Environmental Partners LLC
  city: Columbus
  phone: (614) 555-0118
  url: https://example.com
  contact_path: Principal, via the general line; they have no RFP inbox
  credentials_held:
    - VAP CP189
  why_they_buy: Two assessors for a backlog that spikes every spring; they turn work away in April.
  source_url: https://example.com
  source_note: Their staff page, read 12 March 2026
  verified_at: null
  confidence: sourced
```

## 3. `credentials.yaml` — certifications and what they gate

| field | required | type / allowed values |
| --- | --- | --- |
| `holder` | yes | `travis` \| `kwame` \| `sam` \| `firm` |
| `name`, `issuing_body` | yes | non-empty string |
| `url` | key required | valid URL or `null` |
| `prerequisites` | optional | list of strings, defaults `[]` |
| `coursework`, `exam`, `experience_requirement`, `time_to_earn` | key required | string or `null` |
| `cost_initial`, `cost_maintenance` | key required | number or `null` — plain number, no `$` or commas |
| `displayable_on_join` | yes | `true` \| `false` — may it be listed before it is earned |
| `earned_at` | optional | `YYYY-MM-DD` or `null`, defaults `null` |
| `license_number` | optional | string or `null`, defaults `null` |
| `market_recognition` | yes | `gate` \| `strong` \| `moderate` \| `vanity` |
| `verdict` | yes | non-empty string — is it worth earning |
| `plan_year` | optional | `1` \| `3` \| `null`, defaults `null` |

**Only a credential with a non-null `earned_at` appears in the public
"Credentials held" strip.** `displayable_on_join: true` puts it on
`/about/certifications/` with its status stated, not in the held list.

```yaml
- holder: travis
  name: Ohio VAP Certified Professional
  issuing_body: Ohio EPA Division of Environmental Response and Revitalization
  url: https://example.com
  prerequisites:
    - bachelor's degree in a natural science
    - eight years of relevant experience
  coursework: None required beyond the degree
  exam: None; application review only
  experience_requirement: Eight years, of which four supervising remediation
  cost_initial: null
  cost_maintenance: null
  time_to_earn: Unknown; application review reported to take several months
  displayable_on_join: false
  earned_at: null
  license_number: null
  market_recognition: gate
  verdict: The gate for VAP work. Nothing in that programme can be sold without it.
  plan_year: 3
  source_url: https://example.com
  source_note: Ohio EPA programme page, read 12 March 2026
  verified_at: null
  confidence: sourced
```

## 4. `services.yaml` — what the firm sells

| field | required | type / allowed values |
| --- | --- | --- |
| `slug` | yes | lowercase kebab-case, `^[a-z0-9]+(-[a-z0-9]+)*$`. **Must be unique.** Becomes `/services/<slug>/` |
| `name` | yes | non-empty. **Scanned for ORC terms — see below** |
| `category` | yes | free text; groups the services index. Case-insensitively deduplicated |
| `description` | yes | non-empty. The page lead, and the default meta description |
| `problem`, `scope` | optional | string or `null`, default `null`. Rendered as their own sections |
| `meta_description` | optional | string or `null`, default `null`. Use when `description` cannot serve as a meta description |
| `standard` | key required | string or `null` — e.g. `E1527-21`, `E1903`, `VAP`, `BUSTR`, `RCRA` |
| `delivery` | yes | `in_house` \| `subcontracted` \| `blocked` |
| `blocker` | key required | string or `null`. **Required when `delivery: blocked`; must be `null` otherwise** |
| `typical_buyer_segments` | optional | list of segment values from `buyers.yaml`, defaults `[]` |
| `deliverable` | yes | non-empty string |

**`delivery: blocked` renders on `/internal/services/` only** — no public page, no
tile, no sitemap entry.

```yaml
- slug: phase-i-esa
  name: Phase I environmental site assessment
  category: Site assessment
  description: >-
    A records review, site reconnaissance, and interviews to identify recognised
    environmental conditions on a property, written to the standard a lender's
    file has to satisfy.
  problem: You cannot close until someone documents what the property's former use left behind.
  scope: Records review, regulatory database search, site reconnaissance, interviews, and a written report.
  meta_description: null
  standard: E1527-21
  delivery: in_house
  blocker: null
  typical_buyer_segments:
    - lender
    - consulting_firm
    - developer
  deliverable: A Phase I report naming the standard on its face, signed and dated.
  source_url: null
  source_note: Scope agreed with the broker, March 2026
  verified_at: null
  confidence: constructed
```

## 5. `pricing.yaml` — price points

Internal only. No price renders on a public page.

| field | required | type / allowed values |
| --- | --- | --- |
| `item` | yes | non-empty string |
| `amount_low`, `amount_high` | key required | number or `null`. Plain numbers: `1800`, not `$1,800` |
| `unit` | yes | non-empty string — "per assessment", "per boring foot" |
| `currency` | optional | three uppercase letters, defaults `USD`. Lowercase `usd` is rejected |
| `basis` | yes | `sourced` \| `constructed` |
| `construction_method` | key required | string or `null`. **Required when `basis: constructed` and a figure is present** |
| `source_date` | optional | string or `null`, defaults `null` |
| `caveat` | optional | string, defaults `""` |

Two rules the schema enforces: a **constructed** figure must show its arithmetic
in `construction_method`; a **sourced** figure needs a `source_url` or a
`source_note` of at least 20 characters — a bare `source_date` is not a citation.
`amount_low` may not exceed `amount_high`. A one-sided figure renders as
"from $1,800", never as a bare amount that could be mistaken for a quote.

```yaml
- item: Phase I environmental site assessment, small commercial parcel
  amount_low: 1800
  amount_high: 2600
  unit: per assessment
  currency: USD
  basis: constructed
  construction_method: >-
    Low and high are the two quotes obtained by phone in March 2026 (1,800 and
    2,600), taken as the observed range rather than averaged. Two data points
    only; not a market rate.
  source_url: null
  source_date: '2026-03-12'
  caveat: Two quotes is not a market. Replace once five or more are in hand.
  source_note: Two quotes taken by phone from Columbus-area firms, March 2026
  verified_at: null
  confidence: constructed
```

## 6. `regulatory.yaml` — rules that govern the work

Internal only.

| field | required | type / allowed values |
| --- | --- | --- |
| `requirement`, `citation`, `agency`, `applies_to`, `summary` | yes | non-empty string |
| `url` | key required | valid URL or `null` |
| `fee` | key required | number or `null` |
| `fee_note` | optional | string or `null`, defaults `null` |
| `blocking` | yes | `true` \| `false` — does it stop you selling work today |

**This file may use the reserved words freely.** See the ORC section below.

```yaml
- requirement: Certificate of authorization to offer engineering services
  citation: ORC 4733.16
  agency: Ohio State Board of Registration for Professional Engineers and Surveyors
  url: https://example.com
  applies_to: Any firm offering or performing engineering services in Ohio
  fee: null
  fee_note: Fee schedule not yet read
  blocking: true
  summary: >-
    The firm may not offer engineering services, or use the reserved words, without
    a certificate of authorization it does not hold. Offering is the trigger, not
    only performing.
  source_url: https://example.com
  source_note: Ohio Revised Code 4733.16, read 12 March 2026
  verified_at: null
  confidence: sourced
```

## 7. `market-language.yaml` — how competitors name their offer

Internal only.

| field | required | type / allowed values |
| --- | --- | --- |
| `firm_name`, `city` | yes | non-empty string |
| `url` | key required | valid URL or `null` |
| `menu_headings` | optional | list of strings, defaults `[]`. **Verbatim from their site, in their order** |
| `organizing_principle` | yes | non-empty string — by standard, by media, by buyer, by phase |
| `observed_at` | key required | `YYYY-MM-DD` or `null` — the date you read their site |

```yaml
- firm_name: Olentangy Environmental Group
  city: Worthington
  url: https://example.com
  menu_headings:
    - Due Diligence
    - Site Investigation
    - Remediation
    - Compliance
  organizing_principle: By phase of the transaction, not by medium or standard.
  observed_at: '2026-03-12'
  source_url: https://example.com
  source_note: Their services menu, read 12 March 2026
  verified_at: null
  confidence: sourced
```

## 8. `team.yaml` — the people, for `/about/team/`

| field | required | type / allowed values |
| --- | --- | --- |
| `id` | yes | `travis` \| `kwame` \| `sam`. **Must be unique.** Joins to `credentials.yaml` `holder` |
| `name`, `role` | yes | non-empty string |
| `photo` | key required | path under `public/`, e.g. `/team/travis.jpg`, or `null`. **Checked against disk — a missing file fails the build** |
| `photo_alt` | key required | string or `null` |
| `years_experience` | key required | number or `null`. Never rounded up |
| `narrative` | key required | string or `null` — a paragraph of real project work |
| `certifications`, `education`, `expertise` | optional | lists of strings, default `[]` |
| `order` | optional | number, defaults `0` |

Credentials from `credentials.yaml` are joined automatically by `holder`, and
deduplicated against anything you list by hand, so you need not repeat them.

```yaml
- id: travis
  name: Travis Debnam
  role: Principal
  photo: null
  photo_alt: null
  years_experience: null
  narrative: >-
    Write a paragraph of real project work here — what was assessed, where, and
    what the finding changed. Leave it null until there is one worth printing.
  certifications: []
  education: []
  expertise: []
  order: 0
  source_url: null
  source_note: Supplied by the principal
  verified_at: null
  confidence: sourced
```

---

## What the link checker does to URLs

`npm run check:links` reads **every `source_url` and `url`** across all eight
files and issues a GET with a browser User-Agent — several Ohio state sites
answer 404 to a default agent and 200 to a browser.

- **2xx** → writes `verified_at: <today>` into that record, editing the YAML
  document in place so your comments and formatting survive.
- **Non-2xx** → the record is written to `reports/broken-links.json`, flagged
  with whether it is reachable from a public page.
- **`verified_at` is per record, not per field.** It is written only when *every*
  URL on that record answers 2xx. A record whose `url` is live but whose
  `source_url` is dead is not verified, and an existing date is **cleared back to
  `null`** rather than left claiming the source still resolves.
- **One retry, transport errors only.** A DNS blip does not fail a deploy; a
  server that answers 404 twice is answering 404.

**What happens when a URL does not resolve** depends on where the record renders:

| record | effect of a dead URL |
| --- | --- |
| `services.yaml` (not blocked), `credentials.yaml` (publishable), `team.yaml` | **Build fails.** A URL reachable from a public page must resolve |
| `subcontractors.yaml`, `buyers.yaml`, `pricing.yaml`, `regulatory.yaml`, `market-language.yaml`, blocked services | Reported, build continues. Nobody outside the firm will follow it |

If a URL is dead and you have no replacement, set it to `null` and say so in
`source_note`. A `null` URL is honest; a dead one is not.

Building with no network: `LINK_CHECK_OFFLINE=1 npm run build`. Never in CI.

## Which fields the ORC 4733.16 gate inspects

The gate fails the build on `engineer`, `engineering`, `surveyor`, `surveying`
and derivations, matched on a Unicode-folded form so homoglyphs and zero-width
characters cannot slip through. It inspects page titles, meta and `og:` tags,
headings `h1`–`h6`, **the visible body copy of every rendered page**, service
names, the firm name, and the site origin.

Because it reads rendered body copy, it sees your data. Three things follow:

**Third-party firm names are exempt, automatically.** `name` in
`subcontractors.yaml` and `buyers.yaml`, `firm_name` in `market-language.yaml`,
and `agency` in `regulatory.yaml` are treated as proper nouns. A driller called
**Buckeye Engineering & Drilling Inc** is fine and needs no action from you —
the build reports it as permitted so the exemption stays visible. ORC 4733.16
restrains what *this* firm may offer, not whose name you may write down.

**`regulatory.yaml` prose is exempt on `/internal/` pages.** You can describe ORC
4733.16 in `requirement`, `applies_to`, `summary` and `fee_note` using the words
it reserves. Those records render only on `/internal/regulatory/`. The same
sentence on a public page still fails.

**Everything else fails, including lawful references.** A `notes` field saying
"we use them for engineering support" fails, even in the same record whose name
was exempt. So does a service `description` mentioning a client's engineer. No
pattern can separate an offer from a reference, so a human decides: rewrite it,
or add the phrase to `ORC_COPY_ALLOWLIST` in `src/lib/prohibited-terms.ts` with a
reason. A **service name** gets no exemption at all — that is this firm's own
offer, and the schema rejects it before it can render.

A bare "survey" is **not** blocked — it is lawful and ordinary Phase I
vocabulary. It is reported as an advisory for you to confirm.

## Checking your work

```bash
npm run check:data     # schemas only — fastest loop while formatting
npm run build          # everything: links, schemas, build, ORC, link text
```

`check:data` names the file, the record index and the field for every failure,
so `services.yaml[2.slug]: duplicate slug "phase-i-esa"` points straight at the
third record.
