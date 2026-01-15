# Secrets Configuration - Intelligent Media System

**Status:** ✅ Configured to use GitHub Secrets
**Date:** 2026-01-15

---

## 🔐 Overview

The intelligent media system is now configured to load API keys from **GitHub Secrets** automatically. No `.env` file is needed when running in GitHub Actions.

---

## ✅ What Was Done

### 1. **Created Centralized Secret Management**

**File:** `scripts/intelligent-media/api-config.js`

This module:
- ✅ Loads API keys from `process.env` (GitHub Secrets)
- ✅ Validates all 3 API keys (Pexels, Pixabay, Unsplash)
- ✅ Shows which secrets are available (masked for security)
- ✅ Detects GitHub Actions vs local environment
- ✅ Provides clear error messages

### 2. **Created Secret Testing Scripts**

**`test-api-access.js`** - Check if secrets are accessible:
```bash
npm run test:secrets
```

**`test-api-connections.js`** - Verify API keys work:
```bash
npm run test:connections
```

### 3. **Updated All Scripts**

- Removed `require('dotenv').config()`
- Updated to use centralized `api-config.js`
- All scripts now load from secrets automatically

### 4. **Created GitHub Actions Test Workflow**

**File:** `.github/workflows/test-intelligent-media.yml`

This workflow:
- ✅ Tests secret access
- ✅ Tests API connections
- ✅ Validates system
- ✅ Runs a small test (1 image)
- ✅ Can be triggered manually or on push

---

## 🎯 How It Works

### **In GitHub Actions** (Your Primary Use Case)

```yaml
# In your GitHub Actions workflow
steps:
  - name: Run intelligent media system
    env:
      PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
      PIXABAY_API_KEY: ${{ secrets.PIXABAY_API_KEY }}
      UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
    run: npm run intelligent:test
```

**How secrets flow:**
1. GitHub Secrets → `process.env` (automatically)
2. `api-config.js` → Loads from `process.env`
3. All scripts → Use `api-config.js`

**No .env file needed!**

---

## 📋 Required Secrets

Your repository needs these secrets configured:

| Secret Name | Purpose | Get From |
|-------------|---------|----------|
| `PEXELS_API_KEY` | Pexels image API | https://www.pexels.com/api/ |
| `PIXABAY_API_KEY` | Pixabay image API | https://pixabay.com/api/docs/ |
| `UNSPLASH_ACCESS_KEY` | Unsplash image API | https://unsplash.com/developers |

**You mentioned these are already configured!** ✅

---

## 🧪 Testing

### **Test 1: Check Secret Access**

This verifies that secrets are loaded into `process.env`:

```bash
npm run test:secrets
```

**Expected output in GitHub Actions:**
```
✅ SUCCESS: All 3 API keys loaded from secrets

Next step: Run test-api-connections.js to verify keys work
   npm run test:connections
```

**Expected output locally (no secrets):**
```
⚠️  WARNING: Only 0/3 API keys found

💡 How to fix:
You are running locally. Export environment variables:
   export PEXELS_API_KEY="your-key-here"
   ...
```

### **Test 2: Test API Connections**

This makes real API requests to verify keys work:

```bash
npm run test:connections
```

**Expected output:**
```
════════════════════════════════════════════════════════════
🌐 TESTING API CONNECTIONS
════════════════════════════════════════════════════════════

Testing Pexels API...
✅ Pexels API: Connected successfully
   - Total results available: 1,234,567
   - Photos returned: 1
   - Rate limit remaining: 199

Testing Pixabay API...
✅ Pixabay API: Connected successfully
   - Total results available: 987,654
   - Images returned: 3

Testing Unsplash API...
✅ Unsplash API: Connected successfully
   - Total results available: 543,210
   - Photos returned: 1
   - Rate limit remaining: 49

════════════════════════════════════════════════════════════
📊 RESULTS
════════════════════════════════════════════════════════════

3/3 APIs connected successfully

✅ Pexels     - Working
✅ Pixabay    - Working
✅ Unsplash   - Working

✅ SUCCESS: All APIs are working correctly!
Your system is ready to fetch images.
```

### **Test 3: Run Full System Test**

This tests the entire intelligent media system:

```bash
npm run intelligent:test
```

This will:
- Validate API keys
- Fetch ~20 images from all 3 sources
- Score and select best candidates
- Optimize to WebP
- Generate sitemaps
- Save to database

---

## 🚀 Using in GitHub Actions

### **Manual Test Workflow**

I created a test workflow that you can trigger manually:

**File:** `.github/workflows/test-intelligent-media.yml`

**To run:**
1. Go to: https://github.com/ctdebnam-png/tdrealtyohio.com/actions
2. Click "Test Intelligent Media System" workflow
3. Click "Run workflow"
4. Select branch: `claude/automated-media-management-CCrSl`
5. Click "Run workflow"

This will:
1. ✅ Test secret access
2. ✅ Test API connections
3. ✅ Validate system
4. ✅ Run small test (1 image)
5. ✅ Upload artifacts (images, database, gallery)

### **Example: Full Batch Workflow**

Create a workflow to process all images:

```yaml
name: Generate All Images

on:
  workflow_dispatch:
  schedule:
    - cron: '0 2 * * 0' # Every Sunday at 2 AM

jobs:
  generate-images:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Test API connections
        env:
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
          PIXABAY_API_KEY: ${{ secrets.PIXABAY_API_KEY }}
          UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
        run: npm run test:connections

      - name: Generate all images (~70 images)
        env:
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
          PIXABAY_API_KEY: ${{ secrets.PIXABAY_API_KEY }}
          UNSPLASH_ACCESS_KEY: ${{ secrets.UNSPLASH_ACCESS_KEY }}
        run: npm run intelligent:batch

      - name: Upload generated images
        uses: actions/upload-artifact@v3
        with:
          name: intelligent-media
          path: |
            assets/media/intelligent/**
            data/intelligent-media.db
            images-sitemap.xml
            image-gallery.html

      - name: Commit and push changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add assets/media/intelligent/ data/ images-sitemap.xml image-gallery.html
          git commit -m "Auto-generate intelligent media images" || echo "No changes"
          git push
```

---

## 🔍 Troubleshooting

### **Problem: "Missing API keys in secrets"**

**Cause:** Secrets not configured or wrong names

**Fix:**
1. Go to: https://github.com/ctdebnam-png/tdrealtyohio.com/settings/secrets/actions
2. Verify these secrets exist:
   - `PEXELS_API_KEY`
   - `PIXABAY_API_KEY`
   - `UNSPLASH_ACCESS_KEY`
3. Check for typos in secret names

### **Problem: "API connection failed - 401 Unauthorized"**

**Cause:** Invalid API key

**Fix:**
1. Test your API keys manually:
   ```bash
   # Pexels
   curl -H "Authorization: YOUR_KEY" \
     "https://api.pexels.com/v1/search?query=house&per_page=1"

   # Pixabay
   curl "https://pixabay.com/api/?key=YOUR_KEY&q=house&per_page=3"

   # Unsplash
   curl -H "Authorization: Client-ID YOUR_KEY" \
     "https://api.unsplash.com/search/photos?query=house&per_page=1"
   ```
2. If they don't work, regenerate keys on the API websites
3. Update secrets in GitHub

### **Problem: "API connection failed - 429 Rate Limit"**

**Cause:** Too many requests

**Fix:**
- Wait 1 hour for rate limit reset
- Reduce `candidatesPerSource` in `config.json`
- The system has automatic rate limiting, but manual testing can exceed limits

### **Problem: Works in GitHub Actions but not locally**

**Expected!** Secrets are only available in GitHub Actions.

**To test locally:**
```bash
export PEXELS_API_KEY="your-key"
export PIXABAY_API_KEY="your-key"
export UNSPLASH_ACCESS_KEY="your-key"

npm run test:connections
```

---

## 📊 Secret Status Check

Run this to see current status:

```bash
npm run test:secrets
```

This will show:
- ✅ Which secrets are available
- ✅ Key length and masked preview
- ❌ Which secrets are missing
- 💡 How to fix missing secrets

---

## 🎯 Next Steps

### 1. **Verify Secrets in GitHub Actions**

Trigger the test workflow manually:
```
Actions → Test Intelligent Media System → Run workflow
```

### 2. **Check Output**

The workflow will show:
- ✅ Secret access test results
- ✅ API connection test results
- ✅ System validation results
- ✅ Test run results (1 image)

### 3. **Run Full Batch**

If tests pass, run the full batch:
```bash
npm run intelligent:batch
```

This generates ~70 images for your entire site.

---

## 📝 Summary

| Aspect | Status |
|--------|--------|
| **Secret Loading** | ✅ Configured via `api-config.js` |
| **No .env Needed** | ✅ Uses GitHub Secrets |
| **Test Scripts** | ✅ `test:secrets`, `test:connections` |
| **GitHub Actions Workflow** | ✅ Test workflow created |
| **All Scripts Updated** | ✅ Use centralized api-config |
| **Error Messages** | ✅ Clear and actionable |
| **Security** | ✅ Keys are masked in logs |

---

## 🔐 Security Notes

1. **Keys are never logged** - All preview/debug output masks keys
2. **Keys are never committed** - No .env file in git
3. **Keys are in GitHub Secrets** - Encrypted and secure
4. **Access is controlled** - Only authorized workflows can access

---

**Status:** ✅ **SYSTEM READY FOR TESTING IN GITHUB ACTIONS**

Your secrets are already configured. Just trigger the test workflow to verify everything works!
