# Remove Required Status Checks from Branch Protection

After merging the workflow changes, these check names may still appear as "required" or "expected" in PRs. Remove them from branch protection to stop them from blocking merges.

## Check Names to Remove

| Workflow file | Check name (job) |
|---|---|
| `daily-ads-report.yml` | `Pull Data & Generate Report` |
| `daily-site-optimizer.yml` | `Pull, Analyze, and PR On-Site Changes` |
| `gsc-reports.yml` | `generate-reports` |
| `gsc-weekly-seo.yml` | `weekly-seo` |
| `blog-events-roundup.yml` | `generate` |
| `blog-market-update.yml` | `generate` |
| `weekly-content-freshness.yml` | `Content Freshness Audit` |
| `weekly-search-terms.yml` | `Search Terms -> Content Queue` |

## Steps

1. Go to **github.com/ctdebnam-png/tdrealtyohio.com** → **Settings** → **Branches**
2. Under **Branch protection rules**, click **Edit** next to the rule for `main` (or whichever branch is protected)
3. Scroll to **Require status checks to pass before merging**
4. In the search box under **Status checks that are required**, find each check name listed above
5. Click the **×** next to each one to remove it
6. Click **Save changes**

If no branch protection rule exists, no action is needed.
