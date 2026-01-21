# TD Realty Ohio Social Media Caption Tool

Automation tool that generates ready-to-post social media captions from photos and videos. Designed for a workflow where media is uploaded from iPhone to a cloud-synced folder, and this tool processes whatever appears there.

## Features

- Scans a local folder for new media files (jpg, jpeg, png, mp4, mov)
- Creates editable brief files for each media item
- Generates platform-specific captions using Claude AI
- Ensures compliance with real estate marketing guidelines
- Creates scheduling queue suggestions
- Generates copy-paste packets for easy posting

## Prerequisites

- Node.js 18 or higher
- An Anthropic API key
- A cloud-synced folder (Google Drive, OneDrive, iCloud, Dropbox)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/tdrealtyohio-social-ops.git
cd tdrealtyohio-social-ops
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set your Anthropic API key

**macOS/Linux:**
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY="your-api-key-here"
```

**Windows (CMD):**
```cmd
set ANTHROPIC_API_KEY=your-api-key-here
```

For persistent configuration, add the export to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or use a `.env` file with a tool like `dotenv`.

### 4. Configure the base directory

Edit `config.json` and set `baseDir` to the absolute path where your cloud-synced `TD_Realty_Social` folder will live:

```json
{
  "baseDir": "/Users/yourname/Google Drive/TD_Realty_Social"
}
```

**Example paths:**
- macOS Google Drive: `/Users/travis/Google Drive/TD_Realty_Social`
- macOS OneDrive: `/Users/travis/OneDrive/TD_Realty_Social`
- Windows Google Drive: `C:\\Users\\Travis\\Google Drive\\TD_Realty_Social`
- Windows OneDrive: `C:\\Users\\Travis\\OneDrive\\TD_Realty_Social`

### 5. Run initial setup

The first run will create all necessary subdirectories:

```bash
npm run scan
```

This creates:
```
TD_Realty_Social/
  inbox/         <- Drop media files here
  ready/         <- Processed media moves here
  captions/      <- Generated captions and briefs
  scheduled/     <- Queue file and packets
  archive/       <- For archiving old content
  rules/         <- Voice and compliance rules
```

## Usage

### Scan and generate captions

Process all new media in the inbox once:

```bash
npm run scan
```

### Watch mode

Continuously watch for new files (useful when actively uploading):

```bash
npm run watch
```

Press `Ctrl+C` to stop watching.

### Create copy-paste packet

Generate a single file with all platform captions ready to paste:

```bash
npm run package -- my_photo_name
```

The packet will be saved to `TD_Realty_Social/scheduled/my_photo_name.packet.txt`

## Workflow

### From iPhone

1. Open Google Drive/OneDrive app on your iPhone
2. Upload photos/videos to the `TD_Realty_Social/inbox` folder
3. Wait for sync to complete on your laptop

### On Laptop

1. Run `npm run scan` or `npm run watch`
2. (Optional) Edit the generated `.brief.txt` file in `captions/` to add details
3. Re-run scan if you edited the brief
4. Run `npm run package -- <basename>` to create a copy-paste packet
5. Open the packet file and copy captions to Buffer/Hootsuite

## Brief Files

For each media file, the tool creates a brief file in `captions/` like:

```
# Brief for: sunset_listing.jpg

location: Central Ohio
postType: listing
localDetail:
doNotMention:
notes:
```

Edit these fields before running scan to customize the caption:
- **location**: Neighborhood or area (e.g., "German Village", "Worthington")
- **postType**: listing, sold, market_update, buyer_tip, seller_tip, neighborhood, brand, open_house, general
- **localDetail**: A specific detail to mention (e.g., "Near Scioto Trail")
- **doNotMention**: Comma-separated list of things to avoid (e.g., "price, square footage")
- **notes**: Any other context for the caption writer

## Generated Output

### Caption Files

For each media item, `captions/<basename>.final.txt` contains:
- Master caption (80-140 words)
- Facebook version
- LinkedIn version
- Instagram version (with hashtags)
- Google Business Profile version

### Scheduling Queue

`scheduled/queue.csv` tracks all processed items with suggestions:
- Suggested primary platform
- Suggested posting day and time
- Links to media and caption files

### Copy-Paste Packets

`scheduled/<basename>.packet.txt` contains all captions formatted for easy copying.

## Compliance

The tool enforces TD Realty Ohio's compliance requirements:
- No invented statistics or guarantees
- No steering or protected-class language
- No superlative claims ("best", "top", etc.)
- Required buyer program line in each caption
- Required broker/brokerage footer in each caption

Edit `rules/voice.txt` to adjust tone guidelines.

## Configuration Options

| Field | Description |
|-------|-------------|
| `baseDir` | Absolute path to TD_Realty_Social folder |
| `brandName` | Company name for captions |
| `phone` | Contact phone number |
| `email` | Contact email |
| `brokerageLicense` | Brokerage license number |
| `brokerLicense` | Broker license number |
| `buyerProgramLine` | Text of buyer credit program |
| `defaultLocation` | Default location for briefs |
| `platforms` | List of target platforms |
| `maxHashtagsInstagram` | Max hashtags for Instagram |

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is not set"

Make sure you've exported the key in your current terminal session:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Files not being processed

- Check that files are in `inbox/` (not a subfolder)
- Check that files have supported extensions (.jpg, .jpeg, .png, .mp4, .mov)
- Check that files aren't already processed (check `captions/` for existing `.final.txt`)

### Watch mode not detecting files

- Ensure cloud sync has completed before expecting processing
- Try increasing the `awaitWriteFinish` threshold in `cli.js` if files are being processed before fully synced

## License

Private - TD Realty Ohio, LLC
