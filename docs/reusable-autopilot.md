# Reusable SEO Autopilot Action

This repo packages the SEO autopilot pipeline as a composite GitHub Action that can be copied to other repositories.

## What to copy

1. **`.github/actions/seo-autopilot/`** — the composite action
2. **`seo-autopilot/config/run-contract.json`** — tells the action which command to run
3. **`seo-autopilot/lib/should-commit.mjs`** — commit-worthiness gate

## Per-repo edits

| File | What to change |
|------|---------------|
| `run-contract.json` | Set `command` to your repo's autopilot entry point |
| `run-contract.json` | Set `node` to the required Node.js version |
| Workflow YAML | Adjust the `cron` schedule |
| Workflow YAML | Add any repo-specific secrets as env vars |

## Allowed triggers

Only these triggers are permitted:

- `schedule` — daily/weekly cron
- `workflow_dispatch` — manual runs

Never add `push`, `pull_request`, or event-based triggers. The autopilot must not create noise on every commit.

## Example workflow

```yaml
name: SEO Autopilot

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: seo-autopilot
  cancel-in-progress: false

jobs:
  autopilot:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: ./.github/actions/seo-autopilot
        with:
          node_version: '20'
          debug: '0'
        env:
          GSC_SITE_URL: ${{ secrets.GSC_SITE_URL }}
          GSC_CLIENT_ID: ${{ secrets.GSC_CLIENT_ID }}
          GSC_CLIENT_SECRET: ${{ secrets.GSC_CLIENT_SECRET }}
          GSC_REFRESH_TOKEN: ${{ secrets.GSC_REFRESH_TOKEN }}

      - name: Force success
        if: always()
        run: echo "done"
```

## Secrets

All secrets are optional. If missing, the autopilot skips dependent collectors (GSC, Cloudflare KV) without failing.
