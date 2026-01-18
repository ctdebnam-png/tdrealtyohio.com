# Vendor Review Requests for Trust Warnings

Use this guide when tdrealtyohio.com is incorrectly flagged as "deceptive" or "unsafe" by security vendors after fixing all in-code issues.

**IMPORTANT:** Only submit review requests AFTER:
1. All technical fixes are deployed (see /ops/site-trust-warning-triage.md "What We Can Fix In-Code")
2. Site has been live for 24-48 hours to allow crawler re-scans
3. You've confirmed the warning persists

---

## Google Safe Browsing (Powers Chrome, Safari, Firefox)

### Check Current Status
**URL:** https://transparencyreport.google.com/safe-browsing/search?url=tdrealtyohio.com

Enter `tdrealtyohio.com` in the search box to see if Google has flagged the domain.

### Request Review

**If flagged as phishing or malware:**

1. **Via Google Search Console (Recommended if you have access):**
   - Go to: https://search.google.com/search-console
   - Navigate to Security & Manual Actions → Security Issues
   - Click "Request Review" button
   - Explain that the site is a legitimate licensed Ohio real estate brokerage
   - Include: "TD Realty Ohio, LLC. Ohio Brokerage License #2023006602. Broker Travis Debnam, License #2023006467."

2. **Via Safe Browsing Site Status:**
   - Go to: https://transparencyreport.google.com/safe-browsing/search
   - Search for `https://tdrealtyohio.com`
   - If flagged, there should be a "Request a review" link
   - Click it and follow the form

**Review submission text:**

```
TD Realty Ohio (tdrealtyohio.com) is a licensed real estate brokerage operating in Central Ohio.

Business Details:
- Legal Name: TD Realty Ohio, LLC
- Ohio Brokerage License: #2023006602
- Broker: Travis Debnam
- Ohio Broker License: #2023006467
- Phone: (614) 392-8858
- Email: info@tdrealtyohio.com
- Location: Westerville, Ohio

The website provides legitimate real estate services with transparent pricing (1% commission when buying and selling, 2% for sell-only). All content is self-hosted, HTTPS-enforced, and contains no third-party scripts or tracking.

This appears to be a false positive. The domain has never been used for phishing, malware, or deceptive purposes.

Please re-scan and remove any security warnings. Thank you.
```

**Response Time:** Typically 1-3 business days. Check status daily at the transparency report URL above.

---

## Microsoft Defender SmartScreen (Powers Edge, IE, Windows Defender)

### Check Current Status
**URL:** https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site

There's no public lookup tool, but if Edge shows warnings, you can submit via the form.

### Request Review

1. Go to: https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site-guest
2. Select: **"I believe this is a safe site that was incorrectly blocked"**
3. Fill out the form:
   - **URL:** https://tdrealtyohio.com
   - **Category:** Select "Incorrectly blocked as phishing or unsafe"
   - **Your relationship:** Site owner or authorized representative
   - **Email:** info@tdrealtyohio.com (use business email)

**Submission text:**

```
TD Realty Ohio (tdrealtyohio.com) is a licensed Ohio real estate brokerage and has been incorrectly flagged.

Business Information:
- Legal Name: TD Realty Ohio, LLC
- Ohio Brokerage License: #2023006602
- Broker: Travis Debnam, Ohio Broker License #2023006467
- Phone: (614) 392-8858
- Email: info@tdrealtyohio.com
- Location: Westerville, Ohio
- Established: 2017

The website:
- Uses HTTPS with valid SSL certificate (Cloudflare)
- Contains no malware, phishing content, or deceptive practices
- Hosts no third-party scripts or tracking (all resources self-hosted)
- Provides legitimate real estate brokerage services
- Has security headers (CSP, HSTS, X-Content-Type-Options, etc.)

This is a false positive. Please re-review and remove the warning.

Thank you.
```

**Response Time:** Typically 3-7 business days. You may receive an email confirmation.

---

## Norton Safe Web

### Check Current Status
**URL:** https://safeweb.norton.com/

Enter `tdrealtyohio.com` in the search box to see Norton's rating.

### Request Review

**If rated as unsafe or untrusted:**

1. On the Norton Safe Web report page for your site, look for a link that says **"Dispute this rating"** or **"Report an error"**
2. Click it and fill out the form
3. If no link appears, use the Norton Community forum: https://community.norton.com/

**Forum post template:**

```
Subject: False Positive - tdrealtyohio.com Incorrectly Rated

Norton Safe Web has incorrectly rated tdrealtyohio.com as unsafe or untrustworthy.

TD Realty Ohio is a licensed real estate brokerage:
- Legal Name: TD Realty Ohio, LLC
- Ohio Brokerage License: #2023006602
- Broker: Travis Debnam, Ohio Broker License #2023006467
- Phone: (614) 392-8858
- Email: info@tdrealtyohio.com
- Founded: 2017
- Location: Westerville, Ohio

The website is HTTPS-only, has strong security headers (CSP, HSTS), and contains no third-party scripts, malware, or deceptive content. All business facts are verifiable through the Ohio Department of Commerce Division of Real Estate.

Please re-scan and update the rating to Safe/Trusted.

Thank you.
```

**Response Time:** Norton can take 1-2 weeks. Check status periodically.

---

## McAfee WebAdvisor / SiteAdvisor

### Check Current Status
**URL:** https://www.siteadvisor.com/

Enter `tdrealtyohio.com` in the search box.

### Request Review

**If rated as risky or untrustworthy:**

1. On the SiteAdvisor report page, scroll to the bottom
2. Look for **"Is this your site?"** or **"Report an Issue"**
3. Click it and fill out the form

**Alternatively, use the McAfee TechMaster contact:**
- https://www.mcafee.com/enterprise/en-us/support/contact-technical-support.html
- Select "WebAdvisor" or "SiteAdvisor" as the product

**Submission text:**

```
McAfee SiteAdvisor has incorrectly classified tdrealtyohio.com as risky or untrustworthy.

Business Details:
- Legal Name: TD Realty Ohio, LLC
- Ohio Brokerage License: #2023006602
- Broker: Travis Debnam, Ohio Broker License #2023006467
- Phone: (614) 392-8858
- Email: info@tdrealtyohio.com
- Website: https://tdrealtyohio.com
- Established: 2017

This is a legitimate, licensed real estate brokerage serving Central Ohio. The website:
- Uses HTTPS with valid SSL
- Contains no malware, phishing, or spam
- Has no third-party trackers or suspicious scripts
- Implements security headers (CSP, HSTS, etc.)
- Provides verifiable business information

This is a false positive. Please re-scan and update the site rating.

Thank you.
```

**Response Time:** Can take 1-2 weeks. Check status at siteadvisor.com/sitereport.html?url=tdrealtyohio.com

---

## VirusTotal Multi-Vendor Check

### Check Current Status
**URL:** https://www.virustotal.com/gui/home/url

Enter `https://tdrealtyohio.com` and click "Search" or "Scan URL"

VirusTotal aggregates results from 70+ security vendors. If any vendor flags the site, you can see which ones.

### Request Review

VirusTotal itself doesn't host the data - it aggregates from other vendors. If VirusTotal shows vendors flagging your site:
1. **Identify which specific vendor flagged it** (e.g., "Forcepoint ThreatSeeker", "Fortinet", "Sophos")
2. **Submit a review request directly to that vendor** using their own review process
3. **Re-scan on VirusTotal after 72 hours** to see if the flag is cleared

**Common vendors and their review URLs:**
- **Forcepoint ThreatSeeker:** https://csi.forcepoint.com/
- **Fortinet:** https://www.fortiguard.com/faq/wfratingsubmit
- **Sophos:** https://secure2.sophos.com/en-us/support/contact-support.aspx
- **Comodo:** https://siteinspector.comodo.com/
- **Kaspersky:** https://opentip.kaspersky.com/

**Note:** Most false positives on VirusTotal clear automatically within 7 days once Google/Microsoft clears the site.

---

## Cloudflare Security Center (For Cloudflare Pages users)

If you're using Cloudflare Pages (which you are), check:

### Cloudflare Dashboard Security Events

1. Log in to Cloudflare: https://dash.cloudflare.com/
2. Select your domain: `tdrealtyohio.com`
3. Navigate to **Security → Events**
4. Check for:
   - Firewall blocks
   - Rate limiting triggers
   - Bot fight mode false positives
   - WAF rules blocking legitimate traffic

**If you see unexpected blocks:**
- Review WAF rules and create exceptions if needed
- Check "Security Level" setting (Medium is usually best)
- Review Bot Fight Mode settings
- Add trusted IPs to allow list if you're testing from same IP repeatedly

### Cloudflare SSL/TLS Check

1. In Cloudflare dashboard → SSL/TLS
2. Ensure mode is set to: **Full (strict)** or **Full**
3. Check Edge Certificates → Status should be "Active Certificate"
4. Verify HTTPS Rewrites is enabled
5. Enable "Always Use HTTPS"

**If SSL warnings appear in browsers:**
- Wait 15 minutes for Cloudflare certificate provisioning
- Check that DNS is pointed correctly to Cloudflare Pages
- Verify no CNAME/A record conflicts

---

## Google Search Console Security Issues

**Only if you have access to Google Search Console for tdrealtyohio.com:**

1. Go to: https://search.google.com/search-console
2. Select property: `https://tdrealtyohio.com`
3. Navigate to: **Security & Manual Actions → Security Issues**

**If Security Issues are reported:**
- Click **Request Review** button
- Explain that all issues have been fixed
- Provide details about what was changed (removed old scripts, fixed mixed content, etc.)

**If no issues are shown but Safe Browsing still flags:**
- Safe Browsing warnings can exist without Search Console issues
- Use the Safe Browsing review process above instead

---

## After Submitting Reviews

### What to Monitor

1. **Check vendor status pages daily** for the first week
2. **Test in different browsers:**
   - Chrome (incognito mode)
   - Safari (private browsing)
   - Edge (InPrivate mode)
   - Firefox (private window)
3. **Test on different devices:** Desktop, mobile, tablet
4. **Test on different networks:** Home WiFi, mobile data, different ISPs

### Timeline Expectations

| Vendor | Typical Response Time | How to Check |
|--------|----------------------|--------------|
| Google Safe Browsing | 1-3 business days | https://transparencyreport.google.com/safe-browsing/search |
| Microsoft SmartScreen | 3-7 business days | Test in Edge browser |
| Norton Safe Web | 1-2 weeks | https://safeweb.norton.com/ |
| McAfee SiteAdvisor | 1-2 weeks | https://www.siteadvisor.com/ |

### If Review Is Denied

1. **Don't resubmit immediately** - wait 7 days minimum
2. **Make additional technical improvements:**
   - Add more verifiable business information
   - Add SSL certificate transparency logs
   - Ensure all external links are to reputable sites
   - Add schema.org structured data (already done)
3. **Gather evidence of legitimacy:**
   - Ohio Division of Real Estate license verification URL
   - Business registration documents
   - Google Business Profile link (if exists)
4. **Resubmit with additional evidence**

---

## Long-Term Trust Building

Even after warnings are cleared:

1. **Keep the site active** - Regular content updates signal legitimacy
2. **Maintain security headers** - Don't remove CSP, HSTS, etc.
3. **Monitor uptime** - Use uptime monitoring (UptimeRobot, Pingdom free tier)
4. **Avoid sudden changes** - Major redesigns or domain changes can retrigger scans
5. **Build backlinks** - Links from trusted sites (NAR, local associations) improve domain reputation
6. **Claim business listings:**
   - Google Business Profile
   - Bing Places
   - Yelp (if desired)
   - Better Business Bureau (if member)

---

## Emergency Contact (If Site Is Inaccessible)

If the site is completely blocked by ISPs or browsers and review requests aren't working:

1. **Contact Cloudflare Support** (if using Cloudflare):
   - https://support.cloudflare.com/hc/en-us/requests/new
   - Explain the false positive issue
   - They may be able to provide additional context or help

2. **Check with domain registrar** (Namecheap, GoDaddy, etc.):
   - Ensure domain hasn't been flagged or suspended
   - Verify WHOIS records are accurate

3. **Legal options (last resort):**
   - Send DMCA-style counter-notice to vendor if flagging is defamatory
   - Contact vendor's abuse team directly
   - Consult with internet law attorney if business is significantly harmed

---

## Document Your Fixes

When submitting review requests, it helps to provide a timeline:

**Example timeline to include in submissions:**

```
Remediation Timeline for tdrealtyohio.com:

2026-01-XX: Identified false positive warning in [Browser]
2026-01-XX: Removed all third-party scripts (analytics, chat widgets)
2026-01-XX: Implemented security headers (CSP, HSTS, X-Content-Type-Options)
2026-01-XX: Added structured data (Schema.org Organization)
2026-01-XX: Fixed all mixed content (HTTPS-only)
2026-01-XX: Added favicon, manifest, canonical URLs
2026-01-XX: Verified footer displays licenses and contact info on all pages
2026-01-XX: All changes deployed and live

The site is now fully compliant with web security best practices and contains only legitimate business information for a licensed Ohio real estate brokerage.
```

---

## Verification URLs for Ohio Business Licenses

Include these in your review requests as proof of legitimacy:

**Ohio Division of Real Estate - License Lookup:**
https://elicense.ohio.gov/oh_verifylicense

Search for:
- **Brokerage:** TD Realty Ohio, LLC (License #2023006602)
- **Broker:** Travis Debnam (License #2023006467)

These licenses are publicly verifiable and demonstrate the business is legitimate and state-regulated.

---

**Last Updated:** 2026-01-18
**Maintained by:** TD Realty Ohio technical operations
