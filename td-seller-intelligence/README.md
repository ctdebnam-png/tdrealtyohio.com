# TD Realty Seller Intelligence System

Automated seller lead intelligence system for TD Realty Ohio. This system pulls public property data from county auditor websites, calculates propensity-to-sell scores, and syncs everything to Google Sheets for easy lead management.

## Overview

TD Realty Ohio is a 1% commission brokerage (vs. traditional 3%) serving the Columbus/Central Ohio metro area. This system identifies homeowners who are likely to sell in the next 6-12 months, with a focus on high-equity homeowners who save the most with TD Realty's pricing model.

### Service Area

- **Franklin County**: Westerville, Dublin, Powell, Gahanna, New Albany, Hilliard, Upper Arlington, Worthington, Grove City, Pickerington, Blacklick, Clintonville
- **Delaware County**: Delaware, Lewis Center, Powell, Sunbury
- **Future**: Licking County, Fairfield County

## Features

- **Automated Data Ingestion**: Nightly pulls from county auditor websites
- **Propensity Scoring**: Machine-learning-inspired scoring to identify likely sellers
- **TD Fit Scoring**: Identifies properties that match TD Realty's ideal customer profile
- **Google Sheets Integration**: All data synced to a central spreadsheet
- **Priority Tiers**: HOT, WARM, and COLD lead classification
- **Neighborhood Analytics**: Track market trends by ZIP code

## Setup (5 Minutes)

This system uses Google Apps Script for simple, secure Google Sheets access. No service accounts or complex authentication needed!

### Step 1: Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "TD Realty Seller Intelligence"
3. Note the spreadsheet URL - you'll need it later

### Step 2: Add the Apps Script

1. In your new spreadsheet, go to **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `google-apps-script/Code.gs` from this repo
4. Paste it into the Apps Script editor
5. **Important**: Change the `AUTH_TOKEN` constant to a random string:
   ```javascript
   const AUTH_TOKEN = 'your-random-secret-token-here';
   ```
   (Generate one with: `openssl rand -hex 32`)
6. Click **Save** (Ctrl+S)

### Step 3: Deploy the Apps Script

1. Click **Deploy > New deployment**
2. Click the gear icon and select **Web app**
3. Set **Description**: "TD Realty API v1"
4. Set **Execute as**: "Me"
5. Set **Who has access**: "Anyone"
6. Click **Deploy**
7. Click **Authorize access** and allow the permissions
8. **Copy the Web app URL** - you'll need this!

### Step 4: Initialize the Spreadsheet

1. Go back to your Google Sheet
2. Refresh the page
3. You should see a new menu: **TD Realty**
4. Click **TD Realty > Setup All Tabs**
5. This creates all the required tabs with headers and default config

### Step 5: Add GitHub Secrets

Go to your GitHub repository > Settings > Secrets and variables > Actions, and add:

| Secret Name | Value |
|-------------|-------|
| `APPS_SCRIPT_URL` | The Web app URL from Step 3 |
| `APPS_SCRIPT_TOKEN` | The AUTH_TOKEN you set in Step 2 |

### Step 6: Test It!

Trigger the workflow manually:
1. Go to your repo > Actions > "Nightly Property Ingestion"
2. Click "Run workflow"
3. Check the Google Sheet for results

## Local Development

```bash
# Clone and setup
git clone https://github.com/your-org/tdrealtyohio.com.git
cd tdrealtyohio.com/td-seller-intelligence

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN
```

### Running Locally

```bash
# Run Franklin County ingestion
python -m scripts.ingest_franklin

# Run Delaware County ingestion
python -m scripts.ingest_delaware

# Calculate scores for all properties
python -m scripts.calculate_scores

# Dry run (no writes to Sheets)
python -m scripts.ingest_franklin --dry-run

# Ingest a specific ZIP code only
python -m scripts.ingest_franklin --zip 43081
```

## Automated Workflows

The system runs automatically via GitHub Actions:

- **Nightly Ingestion** (5 AM UTC / Midnight EST): Fetches new property data and updates scores
- **Weekly Full Scoring** (Monday 6 AM UTC): Complete recalculation of all scores

Trigger workflows manually from the GitHub Actions tab anytime.

## Google Sheets Tabs

| Tab | Description |
|-----|-------------|
| **Master Properties** | All property data with scores |
| **Hot Leads** | Properties with propensity_score >= 80 |
| **Warm Leads** | Properties with propensity_score >= 50-79 |
| **Inbound Leads** | Website/calculator submissions |
| **Enriched Leads** | Inbound leads matched with property data |
| **Neighborhood Stats** | Aggregate statistics by ZIP |
| **Config** | Tunable scoring parameters |
| **Run Log** | History of script executions |

## Scoring System

### Propensity Score (0-100)

How likely is this owner to sell in the next 12 months?

| Factor | Weight | Logic |
|--------|--------|-------|
| Years Owned | 25% | 5-10 years = highest score (prime moving window) |
| Equity Gain | 25% | 50-100% gain = highest score |
| Neighborhood Turnover | 15% | Higher turnover = more likely to sell |
| Owner Occupied | 10% | Investors score slightly higher |
| Price Tier | 15% | In target range ($200K-$750K) = highest |
| Home Age | 10% | 15-30 years = highest (may need updates) |

### TD Fit Score (0-100)

How well does this property match TD Realty's ideal customer?

| Factor | Weight | Logic |
|--------|--------|-------|
| Price Tier | 25% | $200K-$750K optimal |
| Equity Position | 35% | Higher equity = more commission savings |
| Owner Occupied | 20% | Primary customer is homeowners |
| Service Area | 20% | Primary ZIP codes score highest |

### Priority Tiers

- **HOT**: propensity_score >= 80
- **WARM**: propensity_score >= 50
- **COLD**: propensity_score < 50

## Configuration

Adjust scoring in the **Config** tab of your Google Sheet:

| Setting | Default | Description |
|---------|---------|-------------|
| market_value_multiplier | 1.1 | Assessed value × this = market estimate |
| hot_threshold | 80 | Score >= this = HOT |
| warm_threshold | 50 | Score >= this = WARM |
| min_years_owned | 3 | Minimum ownership for scoring |
| min_equity | 30000 | Minimum equity for scoring |
| target_price_min | 200000 | Ideal price range minimum |
| target_price_max | 750000 | Ideal price range maximum |

Changes take effect on the next scoring run.

## Project Structure

```
td-seller-intelligence/
├── google-apps-script/
│   └── Code.gs                    # Apps Script for Google Sheets
├── scripts/
│   ├── sheets_sync.py             # Sheets API client
│   ├── utils.py                   # Helper functions
│   ├── ingest_franklin.py         # Franklin County ingester
│   ├── ingest_delaware.py         # Delaware County ingester
│   └── calculate_scores.py        # Scoring engine
├── config/
│   ├── scoring_weights.json       # Default scoring config
│   └── counties.json              # County data sources
├── requirements.txt
├── README.md
└── .env.example
```

## Troubleshooting

### "No Apps Script URL provided" error
- Ensure `APPS_SCRIPT_URL` environment variable is set
- Make sure you copied the full URL from the deployment

### "Unauthorized" error from Apps Script
- Verify `APPS_SCRIPT_TOKEN` matches the AUTH_TOKEN in your Apps Script
- Make sure you saved and redeployed after changing the token

### "API error" or timeout
- Google Apps Script has execution time limits
- For large data sets, the script may need multiple runs
- Check the Run Log tab for details

### Empty data returned
- County GIS APIs may be temporarily unavailable
- The system will fall back to web scraping
- Check the Run Log tab for specific error messages

## Adding New Counties

1. Add county configuration to `config/counties.json`
2. Create new ingester script in `scripts/` (copy existing as template)
3. Add ZIP codes to `scripts/utils.py` NEIGHBORHOOD_MAP
4. Update GitHub Actions workflow to include new county

## License

Internal use only - TD Realty Ohio
