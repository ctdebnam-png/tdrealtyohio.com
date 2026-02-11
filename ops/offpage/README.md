# Off-Page SEO Ops Workflow

This workflow maps priority local landing pages to off-page authority actions and records completion over time.

## Artifacts

- `ops/reports/offpage-ops-workflow.json`
  - Source of truth for URL -> off-page action mapping.
- `ops/checklists/offpage-actions-checklist-<timestamp>.md`
  - Human checklist artifact for weekly execution.
- `ops/logs/offpage/<timestamp>-offpage-actions.jsonl`
  - Timestamped status logs used to correlate authority actions with ranking/traffic outcomes.

## Generate a fresh run

```bash
node scripts/generate-offpage-ops-workflow.mjs
```

## Logging standard

Each JSONL row represents a URL-level execution state at a point in time.

Recommended status progression:

- `planned`
- `in_progress`
- `completed`

Update `tasks.gbpPost`, `tasks.citationCheck`, `tasks.reviewPrompt`, and `tasks.partnershipOutreach` per URL as actions ship.
