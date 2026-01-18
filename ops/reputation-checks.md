# TD Realty Ohio - Reputation & Security Checks

This document contains the exact steps to verify the site's reputation across major security and trust vendors.

## Google Search Console - Security Issues

**Purpose:** Check for malware, hacking, or deceptive content warnings

**Steps:**
1. Go to Google Search Console (search.google.com/search-console)
2. Log in with the Google account that has verified ownership of tdrealtyohio.com
3. Select the tdrealtyohio.com property from the property selector
4. Navigate to Security & Manual Actions > Security Issues
5. Check for any security warnings or manual actions
6. If warnings exist, follow the remediation steps provided by Google
7. Request a review after fixing issues

## Google Safe Browsing Transparency Report

**Purpose:** Check if the domain is flagged as unsafe by Google Safe Browsing

**Steps:**
1. Go to Google Transparency Report (transparencyreport.google.com/safe-browsing/search)
2. Enter "tdrealtyohio.com" in the search box
3. Review the status report
4. If flagged, the report will show:
   - Type of threat detected
   - Detection date
   - Current status
5. If flagged as unsafe, file a review request through Search Console

## Cloudflare Security Events

**Purpose:** Monitor firewall events, bot traffic, and security threats

**Steps:**
1. Log in to Cloudflare dashboard (dash.cloudflare.com)
2. Select the tdrealtyohio.com zone
3. Navigate to Security > Events
4. Review the security events log for:
   - Blocked requests
   - Challenge responses
   - Bot detection patterns
5. Navigate to Security > WAF (Web Application Firewall)
6. Check WAF rules and managed rulesets
7. Review any triggered firewall rules in the Analytics tab
8. Check Security > Bots to monitor bot traffic patterns

## Norton Safe Web

**Purpose:** Check Norton SafeWeb rating for the domain

**Steps:**
1. Go to Norton Safe Web (safeweb.norton.com)
2. Enter "tdrealtyohio.com" in the search box
3. Review the safety rating and any warnings
4. If rated as unsafe or suspicious:
   - Click "Report an Error" or "Dispute this rating"
   - Provide evidence that the site is legitimate
   - Include business license numbers and contact information
   - Submit the review request

## McAfee WebAdvisor

**Purpose:** Check McAfee SiteAdvisor rating

**Steps:**
1. Go to McAfee SiteAdvisor (siteadvisor.com)
2. Enter "tdrealtyohio.com" in the search box
3. Review the site rating (green/yellow/red)
4. If rated as risky or suspicious:
   - Click "Report an Issue" or "Test This Site"
   - Select "This is my site" and request a re-rating
   - Provide business verification details
   - Submit the re-rating request

## Microsoft Defender SmartScreen

**Purpose:** Check if the domain is blocked by Microsoft SmartScreen

**Steps:**
1. Go to Microsoft Security Intelligence (microsoft.com/wdsi/support/report-unsafe-site)
2. Check if tdrealtyohio.com is flagged by visiting it in Edge browser
3. If blocked, you'll see a warning page
4. To request review:
   - Click "Report a false positive" on the warning page, or
   - Go to Microsoft Security Intelligence submission form
   - Select "I believe this is a false positive"
   - Provide site URL and business details
   - Submit the review request

## Cloudflare SSL/TLS Configuration

**Purpose:** Ensure HTTPS is properly configured and HSTS is enabled

**Steps:**
1. Log in to Cloudflare dashboard
2. Select tdrealtyohio.com zone
3. Navigate to SSL/TLS
4. Verify encryption mode is set to "Full" or "Full (strict)"
5. Navigate to SSL/TLS > Edge Certificates
6. Verify:
   - Always Use HTTPS is enabled
   - Minimum TLS Version is 1.2 or higher
   - Automatic HTTPS Rewrites is enabled
7. Check that a valid SSL certificate is active

## Domain Reputation Check - Multiple Vendors

**Purpose:** Check reputation across multiple security vendors at once

**Steps:**
1. Go to VirusTotal (virustotal.com)
2. Click on "URL" tab
3. Enter "https://tdrealtyohio.com" and search
4. Review results from 70+ security vendors
5. If any vendors flag the site:
   - Click on the vendor name for details
   - Visit that vendor's site to request a review
   - Provide evidence of legitimacy

## WHOIS Privacy and Contact Verification

**Purpose:** Ensure domain registration shows legitimate business contact

**Steps:**
1. Go to ICANN WHOIS lookup (lookup.icann.org)
2. Enter "tdrealtyohio.com"
3. Verify registrant contact information matches business details
4. If using privacy protection:
   - Ensure it's from a reputable provider
   - Consider adding business contact to public record for trust
5. Verify registration is current and not expiring soon

## Recurring Monitoring

**Schedule:** Perform these checks monthly or immediately if:
- Traffic drops unexpectedly
- Search rankings decline
- Users report security warnings
- Email deliverability issues occur
- Cloudflare reports unusual traffic patterns

**Documentation:** Log all check results and any remediation actions taken.
