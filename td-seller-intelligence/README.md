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

## Setup

### Prerequisites

1. Python 3.11+
2. Google Cloud service account with Sheets API access
3. Google Sheets workbook for data storage

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google Sheets API and Google Drive API
4. Create a service account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file
5. Share your Google Sheet with the service account email (with Editor access)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/tdrealtyohio.com.git
cd tdrealtyohio.com/td-seller-intelligence

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### Environment Variables

Edit `.env` with your credentials:

```bash
# Google Sheets service account credentials (JSON string)
GOOGLE_SHEETS_CREDENTIALS='{"type": "service_account", "project_id": "...", ...}'

# Your Google Sheets document ID (from the URL)
SPREADSHEET_ID=your_spreadsheet_id_here
```

### Initialize Google Sheets

Run the setup script to create all required tabs with headers:

```bash
python -m scripts.sheets_sync --setup
```

This creates the following tabs:
- **Master Properties**: All property data
- **Hot Leads**: Properties with propensity_score >= 80
- **Warm Leads**: Properties with propensity_score >= 50
- **Inbound Leads**: For tracking website/calculator submissions
- **Enriched Leads**: Inbound leads matched with property data
- **Neighborhood Stats**: Aggregate statistics by ZIP
- **Config**: Tunable scoring parameters
- **Run Log**: History of script executions

## Usage

### Manual Execution

```bash
# Run Franklin County ingestion
python -m scripts.ingest_franklin

# Run Delaware County ingestion
python -m scripts.ingest_delaware

# Calculate scores for all properties
python -m scripts.calculate_scores

# Dry run (no writes to Sheets)
python -m scripts.ingest_franklin --dry-run
python -m scripts.calculate_scores --dry-run

# Ingest a specific ZIP code only
python -m scripts.ingest_franklin --zip 43081
```

### GitHub Actions (Automated)

The system runs automatically via GitHub Actions:

- **Nightly Ingestion** (5 AM UTC / Midnight EST): Fetches new property data from both counties and updates scores
- **Weekly Full Scoring** (Monday 6 AM UTC): Complete recalculation of all scores and neighborhood stats

Workflows can also be triggered manually from the GitHub Actions tab.

### Required Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `GOOGLE_SHEETS_CREDENTIALS`: The full JSON content of your service account key
- `SPREADSHEET_ID`: Your Google Sheets document ID

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

All scoring parameters can be adjusted in the **Config** tab of Google Sheets:

| Setting | Default | Description |
|---------|---------|-------------|
| market_value_multiplier | 1.1 | Assessed value × this = market estimate |
| hot_threshold | 80 | Score >= this = HOT |
| warm_threshold | 50 | Score >= this = WARM |
| min_years_owned | 3 | Minimum ownership for scoring |
| min_equity | 30000 | Minimum equity for scoring |
| target_price_min | 200000 | Ideal price range minimum |
| target_price_max | 750000 | Ideal price range maximum |
| weight_* | varies | Individual scoring weights |

Changes to the Config tab take effect on the next scoring run.

## Data Sources

### Franklin County

- **Primary**: Franklin County GIS ArcGIS REST API
- **Fallback**: Franklin County Auditor property search scraping
- **URL**: https://apps.franklincountyauditor.com/

### Delaware County

- **Primary**: Delaware County GIS ArcGIS REST API
- **Fallback**: Delaware County Auditor property search scraping
- **URL**: https://www.co.delaware.oh.us/auditor/

## Project Structure

```
td-seller-intelligence/
├── .github/
│   └── workflows/
│       ├── nightly_ingest.yml     # Daily data ingestion
│       └── weekly_scoring.yml     # Weekly full recalculation
├── scripts/
│   ├── __init__.py
│   ├── sheets_sync.py             # Google Sheets operations
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

### Common Issues

**"No credentials provided" error**
- Ensure `GOOGLE_SHEETS_CREDENTIALS` environment variable is set
- Check that the JSON is valid (no extra quotes or escaping issues)

**"Spreadsheet not found" error**
- Verify `SPREADSHEET_ID` is correct (from the URL between /d/ and /edit)
- Ensure the service account email has Editor access to the sheet

**"GIS API request failed"**
- County GIS APIs may be temporarily unavailable
- The system will automatically fall back to web scraping
- Check the Run Log tab for specific error messages

**Empty data returned**
- The county website structure may have changed
- Check if the target ZIPs are valid
- Try running with `--dry-run` to see what data is being fetched

### Checking Logs

- GitHub Actions logs: Repository > Actions > Select workflow run
- Run Log tab in Google Sheets: Shows status of each script execution
- Local logs: Output to console when running manually

## Adding New Counties

1. Add county configuration to `config/counties.json`
2. Create new ingester script in `scripts/` (use existing as template)
3. Add ZIP codes to `scripts/utils.py` NEIGHBORHOOD_MAP
4. Update GitHub Actions workflow to include new county

## License

Internal use only - TD Realty Ohio

## Support

For issues or questions, contact the development team or check the GitHub Issues.
