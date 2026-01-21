# TD Realty Ohio Social Media Caption Tool

A Node.js CLI tool that generates ready-to-post social media captions from photos and videos. Designed for a workflow where media is uploaded from iPhone to a cloud-synced folder, and this tool processes whatever appears there.

## What This Tool Does

- Scans a local folder for new media files (jpg, jpeg, png, mp4, mov)
- Creates editable brief files for each media item
- Generates platform-specific captions using Claude AI (Anthropic)
- Ensures compliance with real estate marketing guidelines
- Creates scheduling queue suggestions (CSV file)
- Generates copy-paste packets for easy posting to Buffer/Hootsuite

## What This Tool Does NOT Do

- Does NOT post directly to any social media platform
- Does NOT store media files in git (they live in your cloud-synced folder)
- Does NOT require any cloud API access (works entirely with local synced folders)

## Prerequisites

- Node.js 18 or higher
- An Anthropic API key (get one at https://console.anthropic.com)
- A cloud-synced folder on your computer (Google Drive, OneDrive, iCloud, or Dropbox)

## Setup

### 1. Install dependencies

From the `social-ops` directory:

```bash
cd social-ops
npm install
```

### 2. Set your Anthropic API key

The tool requires the `ANTHROPIC_API_KEY` environment variable.

**macOS/Linux (temporary):**
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

**macOS/Linux (permanent - add to ~/.zshrc or ~/.bashrc):**
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**Windows PowerShell (temporary):**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

**Windows PowerShell (permanent):**
```powershell
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-your-key-here', 'User')
```

**Windows CMD (temporary):**
```cmd
set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Choose your base directory

The tool operates on a "working folder" that should be in a cloud-synced location. By default, it uses `~/TD_Realty_Social` (your home folder).

**Recommended locations:**

| Platform | macOS | Windows |
|----------|-------|---------|
| Google Drive | `/Users/yourname/Google Drive/TD_Realty_Social` | `C:\Users\yourname\Google Drive\TD_Realty_Social` |
| OneDrive | `/Users/yourname/OneDrive/TD_Realty_Social` | `C:\Users\yourname\OneDrive\TD_Realty_Social` |
| iCloud | `/Users/yourname/Library/Mobile Documents/com~apple~CloudDocs/TD_Realty_Social` | N/A |
| Dropbox | `/Users/yourname/Dropbox/TD_Realty_Social` | `C:\Users\yourname\Dropbox\TD_Realty_Social` |

### 4. Run initial setup

The first run creates all necessary subdirectories:

```bash
npm run scan -- --baseDir "/path/to/your/TD_Realty_Social"
```

This creates the following structure in your cloud folder (NOT in git):

```
TD_Realty_Social/
  inbox/         <- Drop media files here from iPhone
  ready/         <- Processed media moves here
  captions/      <- Generated captions and brief files
  scheduled/     <- Queue CSV and packet files
  archive/       <- For archiving old content
  rules/         <- Voice and compliance rules (copied from repo)
```

## Usage

### Scan and generate captions

Process all new media in the inbox:

```bash
npm run scan
```

With a custom base directory:

```bash
npm run scan -- --baseDir "/Users/travis/Google Drive/TD_Realty_Social"
```

Force reprocessing of already-processed files:

```bash
npm run scan -- --force
```

### Watch mode

Continuously watch for new files (useful when actively uploading from iPhone):

```bash
npm run watch
```

Or with options:

```bash
npm run watch -- --baseDir "/path/to/folder" --force
```

Press `Ctrl+C` to stop watching.

### Create copy-paste packet

Generate a single file with all platform captions ready to paste:

```bash
npm run package -- sunset_listing
```

The packet will be saved to `TD_Realty_Social/scheduled/sunset_listing.packet.txt`

## Workflow

### From iPhone

1. Open Google Drive/OneDrive app on your iPhone
2. Navigate to `TD_Realty_Social/inbox/`
3. Upload photos/videos
4. Wait for sync to complete on your laptop

### On Laptop

1. Run `npm run scan` (or `npm run watch` for continuous processing)
2. (Optional) Edit the `.brief.txt` file in `captions/` to customize
3. Re-run scan if you edited the brief
4. Run `npm run package -- <basename>` to create a copy-paste packet
5. Open the packet file and copy captions to Buffer/Hootsuite

## Brief Files

For each media file, the tool creates a brief file in `captions/`:

```
# Brief for: sunset_listing.jpg

location: Central Ohio
postType: listing
localDetail:
doNotMention:
notes:
```

Edit these fields before running scan to customize the caption:

| Field | Description | Example |
|-------|-------------|---------|
| `location` | Neighborhood or area | `German Village`, `Worthington` |
| `postType` | Type of post | `listing`, `sold`, `buyer_tip`, `seller_tip`, `neighborhood`, `brand`, `process_tip`, `market_update`, `open_house`, `general` |
| `localDetail` | A specific detail to highlight | `Near Scioto Trail`, `Updated kitchen` |
| `doNotMention` | Comma-separated list of things to avoid | `price, square footage` |
| `notes` | Any other context | `This is a client testimonial` |

## Generated Output

### Caption Files

For each media item, `captions/<basename>.final.txt` contains:
- Master caption (80-140 words)
- Facebook version
- LinkedIn version
- Instagram version (with line breaks and up to 8 hashtags)
- Google Business Profile version (under 1500 characters)

### Scheduling Queue

`scheduled/queue.csv` tracks all processed items with columns:
- `basename` - Media file name without extension
- `mediaPath` - Path to media in ready folder
- `suggestedPlatformPrimary` - Suggested primary platform
- `suggestedSecondaryPlatforms` - Other platforms to post to
- `suggestedPostDay` - Suggested day of week
- `suggestedPostTimeLocal` - Suggested time
- `captionFile` - Path to captions

**Weekly cadence:**
- Monday: Process tips, market updates
- Wednesday: Buyer tips
- Friday: Neighborhood highlights, seller tips
- Sunday: Light brand content

### Copy-Paste Packets

`scheduled/<basename>.packet.txt` contains all captions formatted for easy copying, with clear section headers for each platform.

## Compliance

The tool enforces TD Realty Ohio's compliance requirements:
- No invented statistics or guarantees
- No steering or protected-class language
- No superlative claims ("best", "top", "fastest", etc.)
- No claims about pictured homes being our listings
- Required buyer program line in each caption (exactly once)
- Required broker/brokerage footer in each caption (exactly once)

Rules files in `shared/rules/` are copied to your working folder on first run. Edit them in the working folder to customize.

## All Working Files Live Outside Git

This is important: **All media, captions, briefs, queue files, and packets live in your cloud-synced folder, NOT in the git repository.** The git repo only contains:
- Source code (`src/`)
- Brand configuration (`shared/config/brand.json`)
- Rules templates (`shared/rules/`)
- Documentation

This means:
- Your media files are never committed to git
- Your caption outputs are never committed to git
- The working folder path is never hardcoded in the repo
- You can safely share the repo without exposing client content

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is not set"

Make sure you've exported the key in your current terminal session:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Files not being processed

- Check that files are in `inbox/` (not a subfolder)
- Check that files have supported extensions (.jpg, .jpeg, .png, .mp4, .mov)
- Check that files aren't already processed (look for `.final.txt` in `captions/`)
- Use `--force` to reprocess existing files

### Watch mode not detecting files

- Ensure cloud sync has completed before expecting processing
- The tool waits 2 seconds for file write to stabilize
- Check that the watcher is looking at the correct path

### Validation errors

If you see validation errors like "Missing buyer program line" or "Missing required footer":
- The AI didn't include required elements properly
- Run scan again - the AI will regenerate
- The tool will not move media to ready if validation fails

## License

Private - TD Realty Ohio, LLC
