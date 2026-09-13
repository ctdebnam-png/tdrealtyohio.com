# TD Environmental

Two jobs, one repository:

1. **Hold the market research as structured, queryable data.** Everything we
   learn about subcontractors, buyers, credentials, services, pricing,
   regulation, and competitors' language lives in `/src/data` as YAML, validated
   against Zod schemas at build time. Every record carries its provenance.
2. **Render the public marketing site from that data.** Astro, static output,
   Tailwind, no CMS and no database. The site is a view of the data set, not a
   second copy of it.

TD Environmental is a trade name of TD Realty Ohio, LLC, Westerville, Ohio.

---

## The site is not published

It builds, validates, and deploys to preview. It does not go live until **both**
of these are true:

1. environmental professional liability is **bound**, and
2. the trade name is **registered** with the Ohio Secretary of State.

**The go-live switch is one environment variable: `PUBLISH=true`.** Set it in
the host's build environment and redeploy. Nothing else — no file to edit, no
tag to remove, no second step to forget. Everything below reads that one value
(`IS_PUBLISHED` in `src/lib/site.ts`), so there is no half-published state:

| | held (default) | published (`PUBLISH=true`) |
| --- | --- | --- |
| `robots.txt` | `Disallow: /` for every agent | `Allow: /`, minus `/internal/` |
| sitemap | **not generated at all** | `sitemap-index.xml` generated |
| `Sitemap:` line in robots | absent | present |
| robots meta | `noindex, nofollow, noarchive, nosnippet, noimageindex` on **every** page | `noindex` on `/internal/` only |
| `X-Robots-Tag` | `noindex` on every path, via generated `_headers` | `/internal/` only |
| forms | no method, no action, no handler, every control inside a `disabled` fieldset | live |
| phone number | absent from every page — header, footer, home, contact, proposal | shown |
| every page | carries a visible "preview only" banner | no banner |

Held means **no intake path of any kind**. A phone number routes a real enquiry
just as a form does, so while held it is absent from the markup rather than
merely hidden — there is no `tel:` link and no phone number anywhere in the
built output.

Four independent layers keep it out of indexes, because `robots.txt` alone does
not: a page linked from somewhere else can be indexed without ever being
crawled. Hence the meta tag, the header, and the absent sitemap as well.

`npm run check:data` prints which mode the build is in, and the origin it was
built against, on every run.

**Not automated, and deliberately so** — these are one-time human actions, and
nothing in this repository performs them: do not submit the sitemap to Search
Console or any indexing API, and do not create business listings anywhere
(Google Business Profile, Bing Places, directories, association member pages)
until the same two conditions are met.

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # link check + schema validation + build + content checks
npm run check:all      # everything, in order
```

Individual gates:

| Command | What it does |
| --- | --- |
| `npm run check:data` | Validates every file in `/src/data` against its Zod schema |
| `npm run check:links` | Fetches every URL in the data, writes `verified_at` back, reports breakage |
| `npm run check:orc` | Fails the build on a term reserved by ORC 4733.16 |
| `npm run check:link-text` | Fails on link text that does not say where it goes |
| `npm run check:astro` | TypeScript and Astro diagnostics |
| `npm run test:a11y` | axe (WCAG 2.2 AA) and content rules, via Playwright |

`npm run build` runs the link check and schema validation first, then builds,
then runs the ORC and link-text checks on the built output. Any of them failing
fails the deploy. That is the point.

---

## The provenance fields

Every record in every data file carries these four fields. They are not
decoration; they are the reason the data set is worth anything.

```yaml
source_url: null          # where the fact can be read, or null
source_note: ""           # where the fact came from, in words
verified_at: null         # ISO date the URL last answered 2xx
confidence: unverified    # sourced | constructed | unverified
```

**`source_url`** — the page the fact is stated on. `null` when there is no URL,
which is common and fine: a phone call, a quote on letterhead, and a PDF that
lives in a drive are all legitimate sources with no public URL. Say so in
`source_note`.

**`source_note`** — where the fact came from, written so that someone else can
retrace it. "Quoted by phone, 12 March, Dana at the front desk" is a good note.
"Website" is not.

**`verified_at`** — written by the link checker, not by hand. It records the
date on which **every** URL on the record answered 2xx. It belongs to the
record, not to one field: a record whose `url` is live but whose `source_url` is
dead is not a verified record, so it is not stamped. When a URL that previously
answered 2xx goes dead, the checker clears the date back to null rather than
leaving a stamp that claims the source is still reachable. A record with a
`source_url` and a null `verified_at` has a URL nobody has checked, and the
checker will not let it be published from a public page.

**`confidence`** —

| Value | Meaning |
| --- | --- |
| `sourced` | The fact is stated at `source_url`, or in the document named in `source_note`, and was read there. |
| `constructed` | The fact was derived from sourced inputs. The derivation must be written down. |
| `unverified` | We believe it but have not confirmed it. An unverified record still may not carry an invented value. |

---

## The rule about unknown values

**Unknown values stay null.** A plausible figure is worse than a blank, because
a blank announces itself and a plausible figure does not. If you do not know a
driller's day rate, `rates` stays `null` and the cell on
`/internal/subcontractors/` stays empty until a written quote fills it.

This has three enforced consequences:

- **Never invent a number.** Unknown means `null` and
  `confidence: unverified`. Do not substitute something reasonable.
- **A number that is not read from a source is `constructed`.** It carries
  `basis: constructed` and a `construction_method` that shows the arithmetic in
  enough detail that someone else could redo it and get the same answer. The
  pricing schema rejects a constructed figure without one.
- **A URL that has not been checked is not published.** The link checker gates
  the build on it.

`/internal/pricing/` keeps sourced and constructed figures in two separate
tables for the same reason: they are different kinds of fact and should never be
read as the same one.

---

## Data files

One file per domain in `/src/data`, one schema per file in `/src/schemas`.

| File | What it holds | Rendered on |
| --- | --- | --- |
| `subcontractors.yaml` | Firms that perform work we sell. Rate fields are `null` — no rate data exists yet. | `/internal/subcontractors/` |
| `buyers.yaml` | Organisations that buy this work, by segment. A call list. | `/internal/buyers/` |
| `credentials.yaml` | Certifications: cost, prerequisites, what they gate, whether they are worth it. | `/internal/credentials/`, and `/about/certifications/` for the publishable ones |
| `services.yaml` | What we sell, what we subcontract, what we cannot sell yet. | `/services/` and `/services/[slug]/`; blocked ones on `/internal/services/` only |
| `pricing.yaml` | Price points, sourced and constructed kept apart. | `/internal/pricing/` |
| `regulatory.yaml` | Rules that govern the work, and which ones block it. | `/internal/regulatory/` |
| `market-language.yaml` | How competitors name and organise the same work, verbatim. | `/internal/market-language/` |
| `team.yaml` | The people, for `/about/team/`. | `/about/team/` |

`team.yaml` is not one of the seven research domains. It exists because
`/about/team/` cannot be rendered from research data and nothing on that page
may be invented. Every field on it is nullable for the same reason: a person
with no photo renders without one rather than with a stand-in.

**The files ship empty.** They hold documented field shapes in comments and no
records. Paste records in; do not seed them with examples.

In those templates, a field shown as `""` is required and must be filled with a
real value — the schema rejects an empty string, `source_note` included. A field
shown as `null` may stay null, and should whenever the value is unknown.

`slug` in `services.yaml` and `id` in `team.yaml` must be unique: two records
sharing one would silently build the same page twice, the second overwriting the
first. Validation rejects the duplicate instead. A `photo` path in `team.yaml`
is checked against `public/` so a profile cannot ship a broken image.

### Publishing rules encoded in the schemas

- A service with `delivery: blocked` renders on `/internal/services/` only. It
  never gets a public page and never enters the sitemap. A blocked service must
  name its `blocker`.
- A credential appears on `/about/certifications/` only if
  `displayable_on_join` is true or `earned_at` is set. A credential we are
  working towards is not one we advertise.
- Buyer records are a prospect list and stay internal. The public
  `/who-we-serve/[segment]/` pages describe segments, not named firms; their
  copy lives in `src/lib/segments.ts` and the segment taxonomy comes from the
  buyers schema, so the two cannot drift apart.
- A credential reaches the public "Credentials held" strip only once `earned_at`
  is set. `displayable_on_join` puts it on `/about/certifications/` with its
  status stated — held since a date, or carried by someone joining — because a
  credential the firm does not yet hold must never read as one it holds.

**One thing no gate enforces:** the positioning copy on the home page
(`src/pages/index.astro`) and the segment copy in `src/lib/segments.ts` are
written by hand, not derived from `services.yaml`. If a service is marked
`blocked`, its page disappears from the public site but that prose does not
change. Read `/internal/services/` whenever a blocker is added, and check that
nothing on the public site still promises the blocked work.

---

## The link checker

`scripts/check-links.ts` reads every `source_url` and `url` field across all
data files, issues a GET with a browser User-Agent — several Ohio state sites
answer 404 or 403 to a default agent and 200 to a browser — and records the
status.

- On 2xx it writes `verified_at: <today>` back into the record. The YAML
  document AST is edited in place, so comments and formatting survive.
- Non-2xx results go to `reports/broken-links.json`, with each entry flagged
  `referenced_from_public_page`.
- The script exits non-zero, failing the build, **only** when a URL reached from
  a public page is non-2xx. A dead URL on an internal-only record is reported
  and allowed through: nobody outside the firm will follow it.

It runs as a prebuild step and weekly as a GitHub Action
(`.github/workflows/link-check.yml`), which commits refreshed `verified_at`
dates back to the repository and goes red on a broken public link.

⚠️ **The workflows only run once this project is its own repository.** GitHub
reads workflows from `.github/workflows/` at the *repository* root. While this
project lives in a subdirectory of `tdrealtyohio.com`, neither workflow is
triggered by anything. The local gates (`npm run build`, `npm run check:all`)
are the only enforcement until the extraction happens.

```bash
npm run check:links            # check, write verified_at, gate the build
npm run check:links:report     # check and report, change no files
npx tsx scripts/check-links.ts --offline   # skip the network, local dev only
```

`--offline` (or `LINK_CHECK_OFFLINE=1`) exists so the site can be built on a
machine with no outbound network. Never set it in CI or on the deploy host: it
turns the gate off.

---

## The ORC 4733.16 check

Ohio Revised Code 4733.16 reserves "engineer", "engineering", "surveyor" and
"surveying", and their derivations, for firms holding a certificate of
authorization from the Ohio State Board of Registration for Professional
Engineers and Surveyors. **TD Environmental does not hold one**, so those words
may not appear in the firm name, the domain, any page title, any meta
description, any h1, or any service name.

**Offering the service is the trigger, not only performing it**, so the check
covers what the site *says*, not just how its pages are named and routed.

Three layers enforce it:

1. `src/schemas/services.ts` rejects a service name containing a reserved term,
   so a bad record fails validation before it is ever rendered.
2. `src/layouts/BaseLayout.astro` throws during the build if a page's title or
   description carries one, naming the page.
3. `scripts/check-orc-4733.ts` scans the built output in `/dist` and fails the
   build on a hit in any of: a `<title>`, a meta description or `og:` tag, any
   heading `h1`–`h6`, **the visible body copy of any page**, any service name in
   the data, the firm name, or the site origin.

**Third-party firm names are exempt, automatically.** A subcontractor really
called "Acme Engineering Inc" is a proper noun naming somebody else's company;
rendering it is not this firm offering engineering services. The checker reads
the `name` fields from `subcontractors.yaml` and `buyers.yaml` and the
`firm_name` field from `market-language.yaml`, permits those exact strings
wherever they appear, and **reports every one it permitted** so the exemption is
visible rather than silent. It is narrow by design: the same record's `notes`
field saying "we use them for engineering support" still fails the build, and a
service name in `services.yaml` gets no exemption at all — that is this firm's
own offer, and the schema rejects it outright.

Body copy is otherwise scanned **fail-closed**: any occurrence fails, lawful or not. No
pattern can separate "we provide engineering studies" — an offer, unlawful
without a certificate of authorization — from "delivered to your engineer", a
reference, which is lawful. So every occurrence stops the build and a human
decides. Rewriting the copy is usually the right answer; where a phrase really
is a lawful reference, add it to `ORC_COPY_ALLOWLIST` in
`src/lib/prohibited-terms.ts` with a reason. That list is empty today, and the
checker reports entries that stop matching so it cannot rot into a blanket
exemption.

A service's `description` is the page lead **and** its default meta description.
`meta_description` exists so the two can differ where that helps, but note that
both are now scanned — so a description naming an engineer needs the allowlist
or a rewrite either way.

Matching is done on a folded form of each string — Unicode-normalised, with
zero-width characters removed and common Cyrillic, Greek, and fullwidth
homoglyphs mapped to ASCII — so `engin<zero-width space>eering` and
`еngineering` with a Cyrillic е are caught rather than waved through.

A bare "survey" is **not** blocked. ORC 4733.16 reserves "surveyor" and
"surveying"; "survey" is ordinary Phase I vocabulary ("windshield survey",
"site reconnaissance survey"). The check prints those occurrences as an
advisory for a human to confirm, and does not fail the build on them.

---

## Site

```
/                                 home
/services/                        index
/services/[slug]/                 from services.yaml, non-blocked only
/who-we-serve/                    index
/who-we-serve/[segment]/          from the buyers segment taxonomy
/about/
/about/team/
/about/certifications/            from credentials.yaml, publishable only
/projects/
/contact/
/request-a-proposal/
/internal/…                       working data views, not public
```

`/who-we-serve/consulting-firms/` is the highest-priority page. It states that
the firm takes overflow, works under the client's contract and letterhead where
required, carries its own professional liability, and does not solicit the
client's clients.

Two forms, both handled by Netlify Forms — no third-party form service and no
key in the repository. A short contact form (name, company, phone, email, county
or property address, single need dropdown) sits on every service page and on
`/contact/`. `/request-a-proposal/` asks the scoping questions: property size,
current and former use, whether a Phase I already exists, whether a lender or
agency deadline is driving it, and the date needed. To move off Netlify, set
`FORM.action` in `src/lib/site.ts` to your own POST endpoint and set
`FORM.netlify` to false; the markup needs no other change.

### Internal views

`/internal/` renders the full data set as working tables: subcontractors with
blank rate columns to fill, buyers as a call list, credentials sequenced by
holder and by year one versus year three, pricing with sourced and constructed
separated, regulatory blockers first, and blocked services. They are excluded
from the sitemap (`astro.config.mjs`), disallowed in `robots.txt`, and served
with `X-Robots-Tag: noindex` (`netlify.toml`). They are not linked from any
public page.

**None of that is access control.** Those three measures keep the pages out of
search results; they do not stop anyone who knows or guesses a URL from reading
the prospect list, the subcontractor records, and the pricing. Anyone who can
reach the site can reach `/internal/pricing/`. If that matters — and once real
records land, it does — put a real control in front of it: Netlify's
password protection or role-based access on the `/internal/*` path, or an edge
function that checks a header, are the smallest changes that would actually
restrict it. Until then, treat everything on `/internal/` as published.

### Cross-linking

One footer link to tdrealtyohio.com and one paragraph on `/about/` explaining
the relationship. No shared navigation between the two sites. A test asserts
that exactly one link to the brokerage exists on each public page.

---

## Accessibility

WCAG 2.2 AA, checked with axe in CI across desktop and mobile viewports:
semantic HTML, a skip link, one h1 per page, visible focus rings, labelled form
fields, underlined links in running text, and sentence case headings. Link text
has to name its destination — `scripts/check-link-text.ts` fails the build on
"click here", "learn more", "read more", and their relatives.

---

## Deploying

Static output to **Netlify**; `netlify.toml` holds the build command, the
publish directory, the Node version, the headers, and the redirects.

Cloudflare Pages can serve the same `dist/`, with two things that do not carry
over, both of which fail silently:

- **`netlify.toml` is ignored.** The security headers and the
  `X-Robots-Tag: noindex` on `/internal/` come with it, so port them to a
  `_headers` file in `public/` before switching.
- **Netlify Forms do not exist there.** Both forms post to their own URL and
  rely on Netlify capturing them at deploy time. On Cloudflare Pages that POST
  hits a static asset and the submission is lost with no error shown to the
  person who filled it in. Set `FORM.action` in `src/lib/site.ts` to a real
  endpoint — a Pages Function, for instance — and set `FORM.netlify` to false
  before moving.

The registered origin is **`https://tdenvironmentalohio.com`**, apex only. It is
the default in `src/lib/site.ts`, so no environment variable is needed for a
normal build; set `SITE_URL` only to build against a different origin.

That value is baked in at build time as the canonical link and `og:url` on every
page, the `Sitemap:` line in `robots.txt`, and every `<loc>` in the sitemap.
`npm run check:data` warns if `SITE_URL` differs from the registered origin, and
fails outright if it carries a `www.` — the site is apex-only, and `netlify.toml`
301s `www` to the apex so only one host is ever canonical.

---

## Layout

```
src/
  data/        YAML research data, one file per domain
  schemas/     Zod schema per data file
  lib/         data loader, site constants, segment copy, prohibited terms
  layouts/     BaseLayout (public), InternalLayout (internal)
  components/  header, footer, forms, tiles, provenance badge
  pages/       routes
  styles/      global.css, Tailwind tokens
scripts/       check-links, check-data, check-orc-4733, check-link-text
tests/         axe and content-rule specs
reports/       broken-links.json, written by the link checker
```
