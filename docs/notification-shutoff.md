# Account-Level Notification Shutoff

This is a one-time manual configuration guide. A repo cannot fully control whether GitHub emails you — that depends on account notification preferences and repo watching settings.

## Step 1 — Stop watching the repo

1. Open https://github.com/ctdebnam-png/tdrealtyohio.com
2. Click **Watch** (top right)
3. Set to **Participating and @mentions** (or **Ignore** for zero notifications)
4. Repeat for any other repos generating email noise

## Step 2 — Turn off Actions email notifications

1. Go to **GitHub Settings > Notifications**
2. Under **Email notifications**, disable workflow-related categories
3. If a separate **Actions** or **CI** category exists, disable email delivery
4. Keep **Web** notifications enabled if you still want in-UI alerts

## Step 3 — Verify repo-side quiet mode

Confirm these are already in place (done by Chunks 25-29):
- All workflows use `schedule` + `workflow_dispatch` only (no push/PR triggers)
- `seo-autopilot.yml` has a **Force success** step so it never fails
- `should-commit.mjs` gates commits to meaningful changes only
- `workflows-noise.mjs` auditor detects reintroduced push triggers

## Step 4 — Unsubscribe from workflow run threads

If you previously interacted with a workflow run notification:
1. Open the email notification in GitHub web UI
2. Click **Unsubscribe** if present
3. Repeat for any recurring workflow threads

## Step 5 — Keep one repo allowed to email (farming repo)

- Pick the single repo that should send daily emails
- Keep that repo on **Watch: Participating and @mentions** (or **All Activity**)
- Use an explicit email step in that repo's workflow, not failure notifications
- For every other repo, reduce watch level and disable Actions email

## Step 6 — Verify the guard

The `workflows-noise.mjs` auditor (Chunk 27) runs every autopilot cycle and flags:
- Push-triggered workflows
- PR-bot signals
- Failure-prone steps

If someone adds push triggers later, the autopilot detects it and can optionally auto-fix (set `SEO_AUTOPILOT_FIX_WORKFLOWS=1`).
