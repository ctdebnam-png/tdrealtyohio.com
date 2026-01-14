# GitHub Actions Setup Guide - Free Automation

This guide walks you through setting up free automated SEO content generation using GitHub Actions.

---

## Prerequisites

- GitHub account (free)
- Claude API key (get from console.anthropic.com)
- Basic understanding of Git (or willingness to learn)

**Total Cost:** $5-15/month for Claude API usage (or free if staying under limits)

---

## Step 1: Create GitHub Repository

### Option A: Via GitHub Website

1. Go to github.com and sign in
2. Click "+" icon → "New repository"
3. Repository name: `td-realty-seo`
4. Description: "SEO automation for TD Realty Ohio"
5. Select "Private" (keep your content private)
6. Check "Add README file"
7. Click "Create repository"

### Option B: Via Command Line

```bash
# Create local directory
mkdir td-realty-seo
cd td-realty-seo

# Initialize Git
git init

# Create basic structure
mkdir -p .github/workflows scripts data drafts reports

# Create README
echo "# TD Realty Ohio SEO Automation" > README.md

# Create first commit
git add .
git commit -m "Initial commit"

# Create GitHub repo and push (replace YOUR-USERNAME)
gh repo create td-realty-seo --private --source=. --push
```

---

## Step 2: Set Up Repository Structure

Create this folder structure:

```
td-realty-seo/
├── .github/
│   └── workflows/
│       ├── daily-scraper.yml
│       ├── weekly-content.yml
│       └── weekly-audit.yml
├── scripts/
│   ├── scrape_market.py
│   ├── generate_content.py
│   └── audit_site.py
├── data/
│   └── (auto-generated files)
├── drafts/
│   └── (auto-generated content)
├── reports/
│   └── (auto-generated audits)
├── requirements.txt
└── README.md
```

---

## Step 3: Add Python Scripts

Copy the Python scripts from the `automation-scripts` folder into your `scripts/` directory:

1. `scrape_market.py` → Market data collection
2. `generate_content.py` → Blog post generation
3. `audit_site.py` → SEO audits

---

## Step 4: Add GitHub Actions Workflows

Copy the `.yml` files from `automation-scripts` into `.github/workflows/`:

1. `daily-scraper.yml`
2. `weekly-content.yml`
3. `weekly-audit.yml`

---

## Step 5: Create requirements.txt

Create `requirements.txt` in root directory:

```
anthropic>=0.18.0
requests>=2.31.0
beautifulsoup4>=4.12.0
```

---

## Step 6: Add Your Claude API Key to GitHub Secrets

### Get Your API Key:

1. Go to console.anthropic.com
2. Sign in
3. Go to "API Keys" section
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)

### Add to GitHub:

1. Go to your GitHub repository
2. Click "Settings" (top right)
3. In left sidebar, click "Secrets and variables" → "Actions"
4. Click "New repository secret"
5. Name: `ANTHROPIC_API_KEY`
6. Value: Paste your API key
7. Click "Add secret"

**Important:** Never commit your API key directly to code!

---

## Step 7: Push Everything to GitHub

```bash
# Add all files
git add .

# Commit
git commit -m "Add SEO automation system"

# Push to GitHub
git push origin main
```

---

## Step 8: Enable GitHub Actions

1. Go to your repository on GitHub
2. Click "Actions" tab
3. If prompted, click "I understand my workflows, go ahead and enable them"

You should see three workflows:
- Daily Market Data Scraper
- Weekly Content Generation
- Weekly SEO Audit

---

## Step 9: Test Your Workflows

### Run Manual Test:

1. Go to "Actions" tab
2. Click "Daily Market Data Scraper"
3. Click "Run workflow" dropdown (right side)
4. Click green "Run workflow" button
5. Wait 30-60 seconds
6. Refresh page to see results

If successful, you'll see a green checkmark ✓

### Check the Results:

1. Go to "Code" tab
2. Look in `data/` folder
3. You should see `market_data.json` (automatically created)

---

## Step 10: Review Weekly Content

When the weekly workflow runs (every Monday):

1. You'll get a **Pull Request** notification
2. Go to "Pull requests" tab
3. Click the PR titled "📝 New Blog Posts & City Pages for Review"
4. Review the files in `drafts/` folder
5. Click through to see the generated content
6. If approved → Click "Merge pull request"
7. If changes needed → Leave comments, wait for next week

---

## Workflow Schedule

### Automatic Runs:

| Workflow | Schedule | What It Does |
|----------|----------|--------------|
| Daily Scraper | Every day, 6 AM EST | Collects market data |
| Weekly Content | Monday, 7 AM EST | Generates 2 blog posts + 1 city page |
| Weekly Audit | Friday, 8 AM EST | Scans site for SEO issues |

### Manual Runs:

All workflows can be triggered manually:
1. Actions tab
2. Select workflow
3. "Run workflow" button

---

## Monitoring & Maintenance

### Check Status Weekly:

**Monday Morning (10 minutes):**
1. Check email for Pull Request notification
2. Review new content in GitHub
3. Approve PR to accept content
4. Download HTML files
5. Upload to your website

**Friday Morning (5 minutes):**
1. Check for SEO audit GitHub Issue
2. Review any critical issues
3. Add items to your to-do list

### View Logs:

If something goes wrong:
1. Actions tab
2. Click the failed workflow
3. Click the red X job
4. Read the logs to see what happened
5. Fix the issue in code
6. Re-run workflow

---

## Customization

### Change Schedule:

Edit the cron schedule in `.yml` files:

```yaml
schedule:
  - cron: '0 10 * * *'  # Daily at 10 AM UTC (6 AM EST)
```

Cron format: `minute hour day month day-of-week`

Examples:
- `0 10 * * *` = Every day at 10 AM UTC
- `0 11 * * 1` = Every Monday at 11 AM UTC
- `0 12 * * 5` = Every Friday at 12 PM UTC

Use [crontab.guru](https://crontab.guru/) to create custom schedules.

### Change Content Topics:

Edit the `topics` list in `scripts/generate_content.py`:

```python
topics = ["market_update", "savings", "guide", "pre_listing"]
```

Add your own topics and configurations.

### Change Cities:

Edit the `cities` list in `scripts/generate_content.py`:

```python
cities = [
    "Westerville", "Dublin", "Gahanna", 
    "New Albany", "Powell", "Lewis Center"
    # Add more cities...
]
```

---

## Troubleshooting

### "No such file or directory: data/market_data.json"

**Fix:** Run the daily scraper workflow manually first to create initial data.

### "API key not found"

**Fix:** 
1. Check GitHub Secrets has `ANTHROPIC_API_KEY`
2. Make sure secret name is exact (case-sensitive)
3. Re-run workflow

### "Permission denied" when pushing

**Fix:**
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

### Workflow not running on schedule

**Fix:**
1. Make sure workflows are enabled (Actions tab)
2. Check cron syntax is correct
3. GitHub Actions can have delays (up to 15 minutes)
4. Use manual trigger to test immediately

### Content quality is poor

**Fix:**
1. Update `market_data.json` with better data
2. Edit prompts in `generate_content.py` to be more specific
3. Add more context about your business

---

## Cost Management

### Free Tier Limits:

- **GitHub Actions:** 2,000 minutes/month (plenty for this)
- **Claude API:** Pay-as-you-go, ~$5-15/month for this usage

### Estimated API Costs:

- Daily scraper: ~$0.10/day = $3/month
- Weekly content (2 posts): ~$2/week = $8/month
- Weekly audit: ~$0.50/week = $2/month
- **Total: ~$13/month**

### Reduce Costs:

1. Run content generation bi-weekly instead of weekly
2. Generate 1 blog post instead of 2
3. Run audit monthly instead of weekly
4. Use manual prompts instead (100% free)

---

## Deployment Options

### Option A: Manual Upload (Simplest)

1. Download HTML files from GitHub
2. FTP to your web host
3. Done

### Option B: Auto-Deploy to Cloudflare Pages (Advanced)

1. Connect GitHub repo to Cloudflare Pages
2. Content auto-publishes when you merge PR
3. Free hosting for blog subdomain

### Option C: GitHub Pages (Free, but limited)

1. Enable GitHub Pages in repo settings
2. Set source to main branch
3. Access at username.github.io/td-realty-seo
4. Good for testing, not main site

---

## Next Steps After Setup

1. **Week 1:** Test all workflows manually
2. **Week 2:** Let it run automatically, monitor results
3. **Week 3:** Start deploying content to your website
4. **Week 4:** Review analytics and adjust strategy

---

## Getting Help

**GitHub Actions Issues:**
- Check Actions log for specific errors
- Search GitHub Community: github.com/community

**Claude API Issues:**
- Check console.anthropic.com for usage
- Review Anthropic docs: docs.anthropic.com

**Git/GitHub Basics:**
- GitHub Learning Lab: lab.github.com
- Git tutorial: git-scm.com/docs/gittutorial

---

## Summary Checklist

- [ ] GitHub repository created
- [ ] Folder structure set up
- [ ] Python scripts added
- [ ] GitHub Actions workflows added
- [ ] `requirements.txt` created
- [ ] Claude API key added to Secrets
- [ ] All files pushed to GitHub
- [ ] GitHub Actions enabled
- [ ] Daily scraper tested manually
- [ ] Weekly content tested manually
- [ ] Monitoring plan in place

**Setup Time:** 30-60 minutes  
**Ongoing Time:** 15 minutes/week (review and approve content)

---

You're ready to automate! 🚀
