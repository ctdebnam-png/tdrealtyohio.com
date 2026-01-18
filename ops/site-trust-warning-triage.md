# Site Trust Warning Triage Checklist

Use this checklist to document browser warnings about tdrealtyohio.com so we can triage root causes and track remediation.

## Warning Capture Checklist

When a "deceptive site" or "fake website" warning appears, capture:

### Basic Details
- [ ] **Exact warning text** (screenshot or verbatim copy)
- [ ] **Browser and version** (Safari 17.2, Chrome 120, Edge 119, Firefox 121, etc.)
- [ ] **Operating system** (macOS 14.2, Windows 11, iOS 17, Android 14, etc.)
- [ ] **Device type** (Desktop, iPhone, Android phone, iPad, etc.)
- [ ] **URL that triggered it** (https://tdrealtyohio.com, /buyers/, /sellers/, /contact/, etc.)
- [ ] **Date and time** of warning
- [ ] **Network context** (home WiFi, corporate network, mobile carrier, VPN)

### Safari "Fraudulent Website Warning" (Google Safe Browsing)
- [ ] Did Safari show a red "Deceptive Website Warning" before page load?
- [ ] Did the warning say "This website may be impersonating..." or similar?
- [ ] Was this in Safari desktop (macOS) or Safari mobile (iOS)?
- [ ] Did it block page load or show as interstitial?
- [ ] Copy exact warning text from Safari

**Safari uses Google Safe Browsing.** Check status at:
- https://transparencyreport.google.com/safe-browsing/search?url=tdrealtyohio.com

### Microsoft Edge SmartScreen
- [ ] Did Edge show "This site has been reported as unsafe" or similar?
- [ ] Did it say "Deceptive site" or "Phishing" in the warning?
- [ ] Was page access blocked completely or continuable?
- [ ] Copy exact warning text from Edge

**Edge uses Microsoft Defender SmartScreen.** Check status at:
- https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site

### Chrome Safe Browsing
- [ ] Did Chrome show a red "Deceptive site ahead" page?
- [ ] Did it reference "phishing" or "social engineering"?
- [ ] Copy exact warning text from Chrome

**Check Google Safe Browsing status** (same as Safari):
- https://transparencyreport.google.com/safe-browsing/search?url=tdrealtyohio.com

### Firefox Safe Browsing
- [ ] Did Firefox show "Reported Web Forgery" or "Deceptive Site" warning?
- [ ] Copy exact warning text from Firefox

**Firefox uses Google Safe Browsing** (same endpoint as Chrome/Safari).

### Other Security Tools
- [ ] Norton Safe Web warning (browser extension or search result annotation)
- [ ] McAfee WebAdvisor warning
- [ ] Bitdefender or other AV extension
- [ ] Corporate firewall or proxy warning
- [ ] ISP-injected warning page

---

## What We Can Fix In-Code

These issues can be resolved by changing files in the repository:

### Immediate Code Fixes
- [x] **Remove old phone numbers** from all metadata, OpenGraph tags, JSON-LD (956-8656 purged)
- [x] **Fix blank footer fields** - ensure phone, email, licenses populate on every page
- [x] **Add favicon and apple-touch-icon** - missing icons look unprofessional
- [x] **Add web manifest** - PWA baseline improves trust
- [x] **Ensure HTTPS everywhere** - no mixed content, no http:// asset calls
- [x] **Remove third-party scripts** - analytics, chat widgets, ad pixels can trigger warnings
- [x] **Fix canonical URLs** - every page must have rel=canonical pointing to https://tdrealtyohio.com
- [x] **Consistent metadata** - title, description, OG tags must match across all pages
- [x] **Add structured data** - Organization JSON-LD with licenses and contact info
- [x] **Remove unverified claims** - no "top agent" or "award winning" or membership claims we can't prove

### Security Headers (via _headers file)
- [x] **Content-Security-Policy** - already added, prevents script injection
- [x] **Strict-Transport-Security** - forces HTTPS, already added
- [x] **X-Content-Type-Options** - prevents MIME sniffing, already added
- [x] **Referrer-Policy** - controls referrer leakage, already added

### Content Trust Issues
- [ ] **Placeholder text visible** - "lorem ipsum", "coming soon", empty sections
- [ ] **Broken images** - 404 images look abandoned
- [ ] **Dead links** - links to nonexistent pages
- [ ] **Spelling/grammar errors** - typos reduce trust
- [ ] **Inconsistent branding** - logo, colors, fonts must be consistent
- [ ] **No contact info visible** - footer must always show phone/email/licenses

### Technical Red Flags
- [ ] **Unexpected redirects** - pages that auto-redirect without warning
- [ ] **Popups or interstitials** - aggressive popups trigger warnings
- [ ] **Auto-downloads** - files that download without user action
- [ ] **Obfuscated JavaScript** - minified inline scripts can look malicious
- [ ] **Base64 encoded scripts** - inline base64 blobs are suspicious
- [ ] **External form submissions** - forms that POST to third-party domains
- [ ] **Cryptocurrency miners** - any crypto-related scripts
- [ ] **URL shorteners** - bit.ly or similar in content

---

## What Requires Vendor Review Request

These issues must be resolved by submitting a review request to the security vendor:

### False Positive from Security Vendor
If the site is **incorrectly flagged** by Google Safe Browsing, Microsoft SmartScreen, Norton, or McAfee:
1. **Fix all in-code issues first** (see above)
2. **Wait 24-48 hours** for crawlers to re-scan
3. **Submit review request** if warning persists (see /ops/vendor-review-requests.md)

### Domain Reputation Issues
- **New domain** (less than 6 months old) - builds trust over time
- **Domain history** - previous owner used domain for spam or phishing
- **Shared hosting IP** - other sites on same IP flagged (not applicable for Cloudflare Pages)
- **Similar domain** - confusingly similar to a known scam domain

### External Listing Issues
- **Google Search Console** - security issues reported (requires GSC access)
- **WHOIS privacy** - can look suspicious, but legitimate for privacy
- **SSL certificate** - expired, self-signed, or mismatch (Cloudflare handles this)

### Malware/Phishing False Positives
If vendors detect:
- **Injected scripts** - site was compromised, clean and request re-review
- **Malicious ads** - third-party ad network serving malware
- **Compromised assets** - images or JS files replaced with malicious versions
- **DNS hijacking** - domain resolves to wrong IP

For these, **immediately scan the codebase**, rotate credentials, and submit urgent review request.

---

## Triage Workflow

1. **Capture warning details** using checklist above
2. **Check vendor status** using links provided
3. **Fix all in-code issues** from "What We Can Fix" section
4. **Deploy fixes** and wait 24-48 hours
5. **Re-test** on same browser/device that showed warning
6. **Submit vendor review** if warning persists (see /ops/vendor-review-requests.md)
7. **Document resolution** - note what fixed it for future reference

---

## Notes

- **Google Safe Browsing** powers warnings in Chrome, Safari, Firefox, and some Android browsers
- **Microsoft SmartScreen** powers warnings in Edge and Internet Explorer
- **Norton Safe Web** and **McAfee WebAdvisor** show warnings in search results and via browser extensions
- **Most warnings are false positives** for new or low-traffic domains
- **Fix all technical issues** before requesting review - vendors check harder if you request review
- **Response time varies**: Google 1-3 days, Microsoft 3-7 days, Norton/McAfee up to 2 weeks
