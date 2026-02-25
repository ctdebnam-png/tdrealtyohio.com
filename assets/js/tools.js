/**
 * TD Realty Ohio - Interactive Tools Library
 * Shared infrastructure for all 9 lead-magnet tool pages.
 * Requires main.js to be loaded first (TD_CONFIG, formatCurrency, trackEvent, getUTMData).
 */

/* ===== TOOL DEFINITIONS ===== */
var TD_TOOLS = {
  'seller-net-proceeds': {
    name: 'Seller Net Proceeds Estimate',
    slug: 'seller-net-proceeds',
    intent: 'seller',
    related: ['seller-documents', 'sell-buy-timing', 'repair-vs-credit']
  },
  'seller-documents': {
    name: 'Seller Preparation Readiness Checklist',
    slug: 'seller-documents',
    intent: 'seller',
    related: ['seller-net-proceeds', 'seller-documents', 'repair-vs-credit']
  },
  'sell-buy-timing': {
    name: 'Sell & Buy Timing Planner',
    slug: 'sell-buy-timing',
    intent: 'seller',
    related: ['seller-net-proceeds', 'sell-now-vs-wait', 'move-up-plan']
  },
  'sell-now-vs-wait': {
    name: 'Sell Now vs Wait Planner',
    slug: 'sell-now-vs-wait',
    intent: 'seller',
    related: ['sell-buy-timing', 'seller-net-proceeds', 'seller-documents']
  },
  'repair-vs-credit': {
    name: 'Repair vs Credit Decision Helper',
    slug: 'repair-vs-credit',
    intent: 'seller',
    related: ['seller-documents', 'seller-net-proceeds', 'seller-documents']
  },
  'seller-documents': {
    name: 'Seller Document Organizer',
    slug: 'seller-documents',
    intent: 'seller',
    related: ['seller-documents', 'seller-net-proceeds', 'sell-buy-timing']
  },
  'buyer-offer-readiness': {
    name: 'Buyer Offer Readiness Pack',
    slug: 'buyer-offer-readiness',
    intent: 'buyer',
    related: ['buyer-closing-costs', 'move-up-plan', 'sell-buy-timing']
  },
  'buyer-closing-costs': {
    name: 'Buyer Closing Cost Estimator',
    slug: 'buyer-closing-costs',
    intent: 'buyer',
    related: ['buyer-offer-readiness', 'move-up-plan', 'seller-net-proceeds']
  },
  'move-up-plan': {
    name: 'Move-Up Plan Generator',
    slug: 'move-up-plan',
    intent: 'buyer',
    related: ['sell-buy-timing', 'buyer-closing-costs', 'buyer-offer-readiness']
  }
};

/* ===== SPAM CONTROLS ===== */
var ToolSpam = {
  RATE_KEY: 'td_tool_submissions',
  MAX_SUBMISSIONS: 5,
  WINDOW_MS: 10 * 60 * 1000,

  canSubmit: function() {
    try {
      var data = JSON.parse(localStorage.getItem(this.RATE_KEY) || '{"times":[]}');
      var now = Date.now();
      data.times = data.times.filter(function(t) { return now - t < ToolSpam.WINDOW_MS; });
      return data.times.length < this.MAX_SUBMISSIONS;
    } catch(e) { return true; }
  },

  recordSubmission: function() {
    try {
      var data = JSON.parse(localStorage.getItem(this.RATE_KEY) || '{"times":[]}');
      var now = Date.now();
      data.times = data.times.filter(function(t) { return now - t < ToolSpam.WINDOW_MS; });
      data.times.push(now);
      localStorage.setItem(this.RATE_KEY, JSON.stringify(data));
    } catch(e) { /* storage unavailable */ }
  },

  isHoneypotFilled: function(formEl) {
    var hp = formEl ? formEl.querySelector('[name="website_url"]') : null;
    return hp && hp.value.length > 0;
  },

  validateEmail: function(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  validatePhone: function(phone) {
    var digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
  }
};

/* ===== SHAREABLE LINK ===== */
var ToolShare = {
  encode: function(inputs) {
    try {
      return btoa(JSON.stringify(inputs));
    } catch(e) { return ''; }
  },

  decode: function() {
    try {
      var params = new URLSearchParams(window.location.search);
      var s = params.get('s');
      if (!s) return null;
      return JSON.parse(atob(s));
    } catch(e) { return null; }
  },

  getLink: function(inputs) {
    var encoded = this.encode(inputs);
    if (!encoded) return '';
    return window.location.origin + window.location.pathname + '?s=' + encoded;
  }
};

/* ===== LEAD SUBMISSION ===== */
function submitToolLead(payload) {
  var utm = typeof getUTMData === 'function' ? getUTMData() : {};
  var data = {
    name: payload.name || '',
    email: payload.email || '',
    phone: payload.phone || '',
    consent_to_contact: true,
    consent_text_version: '2025-01-28',
    privacy_ack: true,
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer,
    intent_type: payload.intent_type || '',
    event_name: payload.event_name || 'tool_lead',
    utm_source: utm.utm_source || '',
    utm_medium: utm.utm_medium || '',
    utm_campaign: utm.utm_campaign || '',
    extra: payload.extra || {}
  };

  return fetch('/api/lead', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }).then(function(r) { return r.ok; }).catch(function() { return false; });
}

/* ===== MODAL SYSTEM ===== */
function createModal(id, title, bodyHtml) {
  var existing = document.getElementById(id);
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'tool-modal-overlay';
  overlay.innerHTML =
    '<div class="tool-modal">' +
      '<div class="tool-modal-header">' +
        '<h3>' + title + '</h3>' +
        '<button type="button" class="tool-modal-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="tool-modal-body">' + bodyHtml + '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  var closeBtn = overlay.querySelector('.tool-modal-close');
  closeBtn.addEventListener('click', function() { overlay.remove(); });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  return overlay;
}

/* ===== ACTION BUTTONS ===== */
function initToolActions(toolSlug, getResultsText, getInputs) {
  var toolDef = TD_TOOLS[toolSlug];
  if (!toolDef) return;

  // Copy This
  var copyBtn = document.getElementById('action-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      var text = getResultsText();
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          copyBtn.textContent = 'Copied!';
          setTimeout(function() { copyBtn.textContent = 'Copy This'; }, 2000);
        }).catch(function() { fallbackCopy(text, copyBtn); });
      } else {
        fallbackCopy(text, copyBtn);
      }
      if (typeof trackEvent === 'function') trackEvent('tool_copy', { label: toolSlug });
    });
  }

  // Email Me This
  var emailBtn = document.getElementById('action-email');
  if (emailBtn) {
    emailBtn.addEventListener('click', function() {
      var modal = createModal('email-modal', 'Email My Results',
        '<form id="email-form">' +
          '<div style="display:none"><input type="text" name="website_url" tabindex="-1" autocomplete="off"></div>' +
          '<div class="form-group"><label for="email-input" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Email Address</label>' +
          '<input type="email" id="email-input" class="form-input" placeholder="your@email.com" required></div>' +
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:1rem;font-size:0.875rem;color:var(--gray-600);cursor:pointer;">' +
            '<input type="checkbox" id="email-consent" checked style="margin-top:3px;"> I agree to be contacted by TD Realty Ohio.' +
          '</label>' +
          '<button type="submit" class="btn btn-primary" style="width:100%;">Send Results</button>' +
          '<div id="email-status" style="margin-top:0.75rem;font-size:0.875rem;"></div>' +
        '</form>'
      );
      var form = document.getElementById('email-form');
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (ToolSpam.isHoneypotFilled(form)) return;
        if (!ToolSpam.canSubmit()) {
          document.getElementById('email-status').textContent = 'Too many requests. Please try again later.';
          return;
        }
        var email = document.getElementById('email-input').value;
        if (!ToolSpam.validateEmail(email)) {
          document.getElementById('email-status').textContent = 'Please enter a valid email.';
          return;
        }
        var statusEl = document.getElementById('email-status');
        statusEl.textContent = 'Sending...';
        ToolSpam.recordSubmission();
        submitToolLead({
          email: email,
          intent_type: toolDef.intent === 'seller' ? 'selling' : 'buying',
          event_name: 'tool_email',
          extra: { tool: toolSlug, results: getResultsText() }
        }).then(function(ok) {
          statusEl.textContent = ok ? 'Sent! Check your records.' : 'Error. Call (614) 392-8858.';
          statusEl.style.color = ok ? 'var(--success)' : 'var(--error)';
          if (ok && typeof trackEvent === 'function') trackEvent('tool_email', { label: toolSlug });
        });
      });
    });
  }

  // Text Me This
  var textBtn = document.getElementById('action-text');
  if (textBtn) {
    textBtn.addEventListener('click', function() {
      var modal = createModal('text-modal', 'Text My Results',
        '<form id="text-form">' +
          '<div style="display:none"><input type="text" name="website_url" tabindex="-1" autocomplete="off"></div>' +
          '<div class="form-group"><label for="phone-input" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Phone Number</label>' +
          '<input type="tel" id="phone-input" class="form-input" placeholder="(614) 555-1234" required></div>' +
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:1rem;font-size:0.875rem;color:var(--gray-600);cursor:pointer;">' +
            '<input type="checkbox" id="text-consent" checked style="margin-top:3px;"> I agree to be contacted by TD Realty Ohio via text message.' +
          '</label>' +
          '<button type="submit" class="btn btn-primary" style="width:100%;">Send Results</button>' +
          '<div id="text-status" style="margin-top:0.75rem;font-size:0.875rem;"></div>' +
        '</form>'
      );
      var form = document.getElementById('text-form');
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (ToolSpam.isHoneypotFilled(form)) return;
        if (!ToolSpam.canSubmit()) {
          document.getElementById('text-status').textContent = 'Too many requests. Please try again later.';
          return;
        }
        var phone = document.getElementById('phone-input').value;
        if (!ToolSpam.validatePhone(phone)) {
          document.getElementById('text-status').textContent = 'Please enter a valid phone number.';
          return;
        }
        var statusEl = document.getElementById('text-status');
        statusEl.textContent = 'Sending...';
        ToolSpam.recordSubmission();
        submitToolLead({
          phone: phone,
          intent_type: toolDef.intent === 'seller' ? 'selling' : 'buying',
          event_name: 'tool_text',
          extra: { tool: toolSlug, results: getResultsText() }
        }).then(function(ok) {
          statusEl.textContent = ok ? 'Sent! We\'ll text you shortly.' : 'Error. Call (614) 392-8858.';
          statusEl.style.color = ok ? 'var(--success)' : 'var(--error)';
          if (ok && typeof trackEvent === 'function') trackEvent('tool_text', { label: toolSlug });
        });
      });
    });
  }

  // Send to TD Realty
  var sendBtn = document.getElementById('action-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', function() {
      var modal = createModal('send-modal', 'Send to TD Realty',
        '<form id="send-form">' +
          '<div style="display:none"><input type="text" name="website_url" tabindex="-1" autocomplete="off"></div>' +
          '<div class="form-group"><label for="send-name" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Name</label>' +
          '<input type="text" id="send-name" class="form-input" placeholder="Your name" required></div>' +
          '<div class="form-group"><label for="send-email" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Email</label>' +
          '<input type="email" id="send-email" class="form-input" placeholder="your@email.com" required></div>' +
          '<div class="form-group"><label for="send-phone" style="font-weight:600;color:var(--navy);display:block;margin-bottom:0.5rem;">Phone</label>' +
          '<input type="tel" id="send-phone" class="form-input" placeholder="(614) 555-1234"></div>' +
          '<label style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:1rem;font-size:0.875rem;color:var(--gray-600);cursor:pointer;">' +
            '<input type="checkbox" id="send-consent" checked style="margin-top:3px;"> I agree to be contacted by TD Realty Ohio.' +
          '</label>' +
          '<button type="submit" class="btn btn-primary" style="width:100%;">Send My Results</button>' +
          '<div id="send-status" style="margin-top:0.75rem;font-size:0.875rem;"></div>' +
        '</form>'
      );
      var form = document.getElementById('send-form');
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (ToolSpam.isHoneypotFilled(form)) return;
        if (!ToolSpam.canSubmit()) {
          document.getElementById('send-status').textContent = 'Too many requests. Please try again later.';
          return;
        }
        var email = document.getElementById('send-email').value;
        if (!ToolSpam.validateEmail(email)) {
          document.getElementById('send-status').textContent = 'Please enter a valid email.';
          return;
        }
        var statusEl = document.getElementById('send-status');
        statusEl.textContent = 'Sending...';
        ToolSpam.recordSubmission();
        submitToolLead({
          name: document.getElementById('send-name').value,
          email: email,
          phone: document.getElementById('send-phone').value,
          intent_type: toolDef.intent === 'seller' ? 'selling' : 'buying',
          event_name: 'tool_lead',
          extra: { tool: toolSlug, results: getResultsText() }
        }).then(function(ok) {
          statusEl.textContent = ok ? 'Sent! We\'ll be in touch soon.' : 'Error. Call (614) 392-8858.';
          statusEl.style.color = ok ? 'var(--success)' : 'var(--error)';
          if (ok && typeof trackEvent === 'function') trackEvent('tool_lead', { label: toolSlug });
        });
      });
    });
  }

  // Share Link
  var shareBtn = document.getElementById('action-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      var inputs = getInputs();
      var link = ToolShare.getLink(inputs);
      if (!link) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(function() {
          shareBtn.textContent = 'Link Copied!';
          setTimeout(function() { shareBtn.textContent = 'Share Link'; }, 2000);
        }).catch(function() { prompt('Copy this link:', link); });
      } else {
        prompt('Copy this link:', link);
      }
      if (typeof trackEvent === 'function') trackEvent('tool_share_link', { label: toolSlug });
    });
  }
}

function fallbackCopy(text, btn) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy This'; }, 2000);
  } catch(e) { /* */ }
  document.body.removeChild(ta);
}

/* ===== PDF EXPORT ===== */
function exportToPDF(title, contentHtml) {
  var printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(
    '<!DOCTYPE html><html><head><title>' + title + '</title>' +
    '<style>body{font-family:Arial,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;color:#333;line-height:1.6;}' +
    'h1{color:#1a2e44;font-size:1.5rem;border-bottom:2px solid #c9a227;padding-bottom:0.5rem;}' +
    'h2{color:#1a2e44;font-size:1.2rem;margin-top:1.5rem;}' +
    '.item{padding:0.5rem 0;border-bottom:1px solid #eee;}' +
    '.label{font-weight:600;color:#1a2e44;}.value{float:right;font-weight:600;}' +
    '.highlight{color:#c9a227;}.footer{margin-top:2rem;padding-top:1rem;border-top:2px solid #1a2e44;font-size:0.8rem;color:#666;}' +
    '@media print{body{margin:0;padding:1rem;}}</style></head><body>' +
    '<h1>' + title + '</h1>' + contentHtml +
    '<div class="footer"><p>Generated by TD Realty Ohio | tdrealtyohio.com | (614) 392-8858</p>' +
    '<p>TD Realty Ohio, LLC | Broker License #2023006467 | Brokerage License #2023006602</p>' +
    '<p>This is an estimate only. Actual costs will vary. Consult with your agent and attorney.</p></div>' +
    '</body></html>'
  );
  printWindow.document.close();
  printWindow.print();
}

/* ===== SLIDER HELPERS ===== */
function initToolSlider(sliderId, displayId, opts) {
  var slider = document.getElementById(sliderId);
  var display = document.getElementById(displayId);
  if (!slider || !display) return null;

  var format = opts && opts.format === 'percent' ? function(v) { return v + '%'; } :
               opts && opts.format === 'number' ? function(v) { return parseInt(v).toLocaleString(); } :
               function(v) { return typeof formatCurrency === 'function' ? formatCurrency(parseInt(v)) : '$' + parseInt(v).toLocaleString(); };

  function update() {
    display.textContent = format(slider.value);
    slider.setAttribute('aria-valuetext', format(slider.value));
    if (typeof updateSliderTrack === 'function') updateSliderTrack(slider);
    if (opts && opts.onChange) opts.onChange(parseInt(slider.value));
  }

  slider.addEventListener('input', update);
  update();
  return slider;
}

/* ===== TOOL CALCULATORS ===== */

// 1. Seller Net Proceeds
function calcSellerNetProceeds() {
  var salePrice = parseInt(document.getElementById('snp-price').value) || 400000;
  var feeMode = document.querySelector('[name="snp-fee-mode"]:checked');
  var listingRate = feeMode && feeMode.value === '2' ? 0.02 : 0.01;
  var buyerCompEl = document.getElementById('snp-buyer-comp');
  var buyerComp = buyerCompEl ? parseFloat(buyerCompEl.value) / 100 || 0.025 : 0.025;
  var closingPctEl = document.getElementById('snp-closing-pct');
  var closingPct = closingPctEl ? parseFloat(closingPctEl.value) / 100 || 0.015 : 0.015;
  var creditsEl = document.getElementById('snp-credits');
  var credits = creditsEl ? parseInt(creditsEl.value) || 0 : 0;

  var listingFee = Math.round(salePrice * listingRate);
  var buyerAgentFee = Math.round(salePrice * buyerComp);
  var closingCosts = Math.round(salePrice * closingPct);
  var totalCosts = listingFee + buyerAgentFee + closingCosts + credits;
  var netProceeds = salePrice - totalCosts;

  var fc = typeof formatCurrency === 'function' ? formatCurrency : function(v) { return '$' + v.toLocaleString(); };

  setResult('snp-sale-price', fc(salePrice));
  setResult('snp-listing-fee', '-' + fc(listingFee));
  setResult('snp-listing-rate', (listingRate * 100) + '%');
  setResult('snp-buyer-fee', '-' + fc(buyerAgentFee));
  setResult('snp-closing-costs', '-' + fc(closingCosts));
  setResult('snp-credits', credits > 0 ? '-' + fc(credits) : '$0');
  setResult('snp-total-costs', '-' + fc(totalCosts));
  setResult('snp-net-proceeds', fc(netProceeds));

  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';

  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'seller-net-proceeds' });
}

// 2. Pre-Listing Checklist
function calcPreListingChecklist() {
  var propertyType = getSelected('plc-property-type');
  var homeAge = getSelected('plc-home-age');
  var issues = getCheckedValues('plc-issues');
  var timeline = getSelected('plc-timeline');

  var checklist = [];

  // Exterior
  var exterior = { title: 'Exterior & Curb Appeal', items: [] };
  exterior.items.push('Clean gutters and downspouts');
  exterior.items.push('Power wash siding, driveway, and walkways');
  exterior.items.push('Touch up exterior paint');
  exterior.items.push('Ensure front door hardware works and looks fresh');
  if (homeAge === '20+' || homeAge === '30+') exterior.items.push('Inspect roof for damaged shingles');
  if (propertyType === 'single-family') exterior.items.push('Trim trees and shrubs away from the house');
  checklist.push(exterior);

  // Interior
  var interior = { title: 'Interior Prep', items: [] };
  interior.items.push('Deep clean all rooms including carpets');
  interior.items.push('Declutter closets, counters, and storage areas');
  interior.items.push('Touch up interior paint — neutral tones preferred');
  interior.items.push('Fix any running toilets, dripping faucets, or sticking doors');
  if (issues.indexOf('cosmetic') >= 0) interior.items.push('Address cosmetic issues: patch nail holes, fix scratched floors');
  checklist.push(interior);

  // Systems
  var systems = { title: 'Major Systems', items: [] };
  systems.items.push('Replace HVAC filters and test system');
  if (homeAge === '20+' || homeAge === '30+') {
    systems.items.push('Have water heater inspected — note age and condition');
    systems.items.push('Check electrical panel for outdated wiring');
  }
  if (issues.indexOf('hvac') >= 0) systems.items.push('Get HVAC serviced or get quotes for replacement');
  if (issues.indexOf('plumbing') >= 0) systems.items.push('Address known plumbing issues or get repair quotes');
  if (issues.indexOf('electrical') >= 0) systems.items.push('Address known electrical issues or get repair quotes');
  if (issues.indexOf('roof') >= 0) systems.items.push('Get roof inspection and repair quotes');
  checklist.push(systems);

  // Documentation
  var docs = { title: 'Documentation', items: [] };
  docs.items.push('Gather receipts for recent repairs and upgrades');
  docs.items.push('Locate warranty info for appliances, roof, HVAC');
  docs.items.push('Prepare property disclosure form');
  if (propertyType === 'condo') docs.items.push('Obtain HOA documents, rules, and recent meeting minutes');
  checklist.push(docs);

  // Timeline
  var timelineNote = '';
  if (timeline === 'asap') timelineNote = 'With your ASAP timeline, focus on the highest-impact items first: deep cleaning, decluttering, and any safety issues.';
  else if (timeline === '1-3') timelineNote = 'With 1-3 months, you have time to address most items systematically. Start with major systems first, then cosmetic.';
  else if (timeline === '3-6') timelineNote = 'With 3-6 months, you can address everything on this list thoroughly, including larger projects.';
  else timelineNote = 'With 6+ months, you have ample time to plan and budget for all prep work.';

  // Render
  var resultsDiv = document.getElementById('tool-results');
  var contentDiv = document.getElementById('plc-results-content');
  if (!contentDiv) return;

  var html = '<p style="color:var(--gray-600);margin-bottom:1.5rem;">' + timelineNote + '</p>';
  checklist.forEach(function(group) {
    html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">' + group.title + '</h4>';
    html += '<ul class="benefits-list">';
    group.items.forEach(function(item) {
      html += '<li>' + item + '</li>';
    });
    html += '</ul>';
  });

  contentDiv.innerHTML = html;
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'seller-documents' });
}

// 3. Sell & Buy Timing
function calcSellBuyTiming() {
  var sellMonth = getSelected('sbt-sell-month');
  var buyMonth = getSelected('sbt-buy-month');
  var contingency = getSelected('sbt-contingency');
  var tempHousing = getSelected('sbt-temp-housing');
  var financing = getSelected('sbt-financing');

  var options = [];

  // Sell-First
  var sellFirst = {
    title: 'Sell First, Then Buy',
    pros: ['Stronger negotiating position when buying — no contingency', 'Know your exact budget from sale proceeds', 'No risk of owning two homes at once'],
    cons: ['May need temporary housing between homes', 'Have to move twice unless timing aligns', 'Could miss out on a great buy opportunity while selling']
  };
  if (tempHousing === 'yes') sellFirst.pros.push('You\'re open to temporary housing, which makes this option more flexible');
  if (financing === 'cash') sellFirst.pros.push('Cash from sale eliminates financing uncertainty');
  options.push(sellFirst);

  // Buy-First
  var buyFirst = {
    title: 'Buy First, Then Sell',
    pros: ['Move once — directly from old home to new home', 'No time pressure to find your next home', 'Can stage your current home while empty for better showings'],
    cons: ['May carry two mortgages temporarily', 'Bridge financing may be needed', 'Less negotiating leverage if buyers know you already bought']
  };
  if (financing === 'bridge-loan') buyFirst.pros.push('Bridge loan can cover the gap between buying and selling');
  if (contingency === 'comfortable') buyFirst.pros.push('Your comfort with contingencies helps — your buy offer can include a sale contingency');
  options.push(buyFirst);

  // Simultaneous
  var simultaneous = {
    title: 'Simultaneous Close (Sell & Buy Same Day)',
    pros: ['Move once', 'No double mortgage payments', 'Use sale proceeds directly for purchase'],
    cons: ['Requires precise coordination — dates must align', 'Higher stress if either transaction has delays', 'May need a seller willing to match your timeline']
  };
  if (contingency === 'uncomfortable') simultaneous.cons.push('Since you prefer low-contingency deals, this option\'s coordination risk may be stressful');
  options.push(simultaneous);

  var contentDiv = document.getElementById('sbt-results-content');
  if (!contentDiv) return;

  var html = '';
  options.forEach(function(opt, i) {
    html += '<div style="background:var(--off-white);padding:1.5rem;border-radius:var(--radius-md);margin-bottom:1rem;">';
    html += '<h4 style="color:var(--navy);margin-bottom:0.75rem;">Option ' + (i + 1) + ': ' + opt.title + '</h4>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';
    html += '<div><strong style="color:var(--success);">Pros</strong><ul style="margin:0.5rem 0 0 1rem;color:var(--gray-700);">';
    opt.pros.forEach(function(p) { html += '<li style="margin-bottom:0.25rem;">' + p + '</li>'; });
    html += '</ul></div>';
    html += '<div><strong style="color:var(--error);">Cons</strong><ul style="margin:0.5rem 0 0 1rem;color:var(--gray-700);">';
    opt.cons.forEach(function(c) { html += '<li style="margin-bottom:0.25rem;">' + c + '</li>'; });
    html += '</ul></div></div></div>';
  });

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'sell-buy-timing' });
}

// 4. Sell Now vs Wait
function calcSellNowVsWait() {
  var urgency = getSelected('snw-urgency');
  var reason = getSelected('snw-reason');
  var flexibility = getSelected('snw-flexibility');
  var nextHome = getSelected('snw-next-home');
  var risk = getSelected('snw-risk');

  var scenarios = [];

  // Sell Now
  var sellNow = {
    title: 'Sell Now',
    description: 'List your home in the current market and move forward with your plans.',
    tradeoffs: [],
    nextSteps: []
  };
  if (urgency === 'high' || reason === 'relocation') {
    sellNow.tradeoffs.push('Your timeline or relocation needs make waiting risky');
  }
  sellNow.tradeoffs.push('Current market conditions apply — no speculation on future changes');
  sellNow.tradeoffs.push('Faster path to your next home or next chapter');
  if (reason === 'financial') sellNow.tradeoffs.push('Addresses financial needs sooner');
  sellNow.nextSteps.push('Get a free home value estimate');
  sellNow.nextSteps.push('Schedule a seller preparation');
  sellNow.nextSteps.push('Discuss pricing strategy with your agent');
  sellNow.nextSteps.push('Begin decluttering and basic prep');
  scenarios.push(sellNow);

  // Wait & Prepare
  if (flexibility !== 'none') {
    var waitPrep = {
      title: 'Wait & Prepare (1-3 Months)',
      description: 'Take a short preparation period to maximize your home\'s market appeal.',
      tradeoffs: [],
      nextSteps: []
    };
    waitPrep.tradeoffs.push('Time to complete strategic improvements');
    waitPrep.tradeoffs.push('Potentially better seasonal timing if listing in spring/summer');
    waitPrep.tradeoffs.push('Market could shift in either direction during wait');
    waitPrep.nextSteps.push('Complete a seller checklist');
    waitPrep.nextSteps.push('Address highest-impact repairs');
    waitPrep.nextSteps.push('Deep clean and stage the home');
    waitPrep.nextSteps.push('Get pre-approved for your next purchase if buying');
    scenarios.push(waitPrep);
  }

  // Wait Longer
  if (flexibility === 'high' && risk === 'high') {
    var waitLong = {
      title: 'Wait Longer (3-6+ Months)',
      description: 'Take more time if your situation allows for patience and market observation.',
      tradeoffs: [],
      nextSteps: []
    };
    waitLong.tradeoffs.push('More time for major improvements or market changes');
    waitLong.tradeoffs.push('Carrying costs continue (mortgage, taxes, maintenance)');
    waitLong.tradeoffs.push('Market direction is unpredictable — could help or hurt');
    waitLong.nextSteps.push('Monitor local market trends monthly');
    waitLong.nextSteps.push('Make strategic upgrades with clear ROI');
    waitLong.nextSteps.push('Set a firm decision date to avoid indefinite waiting');
    waitLong.nextSteps.push('Stay in touch with an agent for market updates');
    scenarios.push(waitLong);
  }

  var contentDiv = document.getElementById('snw-results-content');
  if (!contentDiv) return;

  var html = '';
  scenarios.forEach(function(s) {
    html += '<div style="background:var(--off-white);padding:1.5rem;border-radius:var(--radius-md);margin-bottom:1rem;">';
    html += '<h4 style="color:var(--navy);margin-bottom:0.5rem;">' + s.title + '</h4>';
    html += '<p style="color:var(--gray-600);margin-bottom:1rem;">' + s.description + '</p>';
    html += '<strong style="color:var(--navy);">Key Considerations</strong>';
    html += '<ul style="margin:0.5rem 0 1rem 1rem;color:var(--gray-700);">';
    s.tradeoffs.forEach(function(t) { html += '<li style="margin-bottom:0.25rem;">' + t + '</li>'; });
    html += '</ul>';
    html += '<strong style="color:var(--navy);">Next Steps</strong>';
    html += '<ul style="margin:0.5rem 0 0 1rem;color:var(--gray-700);">';
    s.nextSteps.forEach(function(n) { html += '<li style="margin-bottom:0.25rem;">' + n + '</li>'; });
    html += '</ul></div>';
  });

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'sell-now-vs-wait' });
}

// 5. Repair vs Credit
function calcRepairVsCredit() {
  var repairType = getSelected('rvc-repair-type');
  var costRange = getSelected('rvc-cost-range');
  var visibility = getSelected('rvc-visibility');
  var sellerGoal = getSelected('rvc-seller-goal');
  var willingness = getSelected('rvc-willingness');

  var approaches = [];

  // Make the Repair
  var repair = {
    title: 'Complete the Repair Before Listing',
    when: [],
    considerations: []
  };
  repair.when.push('The issue is visible and impacts first impressions');
  repair.when.push('The repair is relatively straightforward and affordable');
  repair.when.push('Fixing it could prevent buyer requests for larger credits');
  if (visibility === 'visible') repair.when.push('Since this is a visible issue, repairing it can improve showing appeal');
  if (willingness === 'yes') repair.when.push('You\'re willing to handle the repair — this gives you control over quality and cost');
  repair.considerations.push('Get 2-3 quotes from licensed contractors');
  repair.considerations.push('Keep all receipts for disclosure and buyer confidence');
  repair.considerations.push('Completed repairs can be highlighted in marketing');
  approaches.push(repair);

  // Offer Credit
  var credit = {
    title: 'Offer a Credit at Closing',
    when: [],
    considerations: []
  };
  credit.when.push('The buyer may have their own contractor preferences');
  credit.when.push('You want to avoid the time and hassle of managing repairs');
  credit.when.push('The issue is cosmetic or non-urgent');
  if (sellerGoal === 'fast-sale') credit.when.push('A credit can speed up the transaction by avoiding repair delays');
  if (willingness === 'no') credit.when.push('Since you\'d prefer not to handle repairs, a credit keeps things simpler');
  credit.considerations.push('Credit amount may be negotiated — buyers sometimes request more than repair cost');
  credit.considerations.push('Some loan programs limit seller credits (typically 3-6% of sale price)');
  credit.considerations.push('Document the issue clearly for the purchase agreement');
  approaches.push(credit);

  // Price Adjustment
  var adjust = {
    title: 'Adjust List Price to Reflect Condition',
    when: [],
    considerations: []
  };
  adjust.when.push('Multiple issues exist and individual credits are complex');
  adjust.when.push('The market is strong enough that a slight price reduction still attracts offers');
  if (costRange === 'high' || costRange === 'major') adjust.when.push('For higher-cost issues, a price adjustment may be cleaner than a large credit');
  adjust.considerations.push('Work with your agent to determine the right adjustment amount');
  adjust.considerations.push('Clearly disclose known issues in the listing');
  adjust.considerations.push('Some buyers prefer this transparency over discovering issues in inspection');
  approaches.push(adjust);

  var contentDiv = document.getElementById('rvc-results-content');
  if (!contentDiv) return;

  var html = '';
  approaches.forEach(function(a) {
    html += '<div style="background:var(--off-white);padding:1.5rem;border-radius:var(--radius-md);margin-bottom:1rem;">';
    html += '<h4 style="color:var(--navy);margin-bottom:0.75rem;">' + a.title + '</h4>';
    html += '<strong>Works well when:</strong>';
    html += '<ul style="margin:0.5rem 0 1rem 1rem;color:var(--gray-700);">';
    a.when.forEach(function(w) { html += '<li style="margin-bottom:0.25rem;">' + w + '</li>'; });
    html += '</ul>';
    html += '<strong>What to gather:</strong>';
    html += '<ul style="margin:0.5rem 0 0 1rem;color:var(--gray-700);">';
    a.considerations.forEach(function(c) { html += '<li style="margin-bottom:0.25rem;">' + c + '</li>'; });
    html += '</ul></div>';
  });

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'repair-vs-credit' });
}

// 6. Seller Documents
function calcSellerDocuments() {
  var propertyType = getSelected('sd-property-type');
  var yearBuilt = getSelected('sd-year-built');
  var updates = getCheckedValues('sd-updates');
  var hoa = getSelected('sd-hoa');

  var categories = [];

  // Required Disclosures
  var disclosures = { title: 'Required Disclosures', items: [] };
  disclosures.items.push('Ohio Residential Property Disclosure Form');
  disclosures.items.push('Lead-based paint disclosure (if built before 1978)');
  disclosures.items.push('Known material defects disclosure');
  if (yearBuilt === 'pre-1978') disclosures.items.push('EPA pamphlet: "Protect Your Family From Lead in Your Home"');
  categories.push(disclosures);

  // Ownership & Title
  var ownership = { title: 'Ownership & Title', items: [] };
  ownership.items.push('Copy of current deed');
  ownership.items.push('Mortgage payoff statement (request from lender)');
  ownership.items.push('Title insurance policy from when you purchased');
  ownership.items.push('Property survey (if available)');
  categories.push(ownership);

  // Systems & Maintenance
  var systems = { title: 'Systems & Maintenance Records', items: [] };
  if (updates.indexOf('hvac') >= 0) systems.items.push('HVAC installation/service records');
  if (updates.indexOf('roof') >= 0) systems.items.push('Roof replacement/repair documentation');
  if (updates.indexOf('water-heater') >= 0) systems.items.push('Water heater installation date and warranty');
  if (updates.indexOf('electrical') >= 0) systems.items.push('Electrical upgrade permits and inspection records');
  if (updates.indexOf('plumbing') >= 0) systems.items.push('Plumbing repair or replacement records');
  if (updates.indexOf('windows') >= 0) systems.items.push('Window replacement records and warranties');
  systems.items.push('Appliance manuals and warranty cards');
  systems.items.push('Pest inspection or treatment history');
  categories.push(systems);

  // Tax & Financial
  var financial = { title: 'Tax & Financial', items: [] };
  financial.items.push('Most recent property tax bill');
  financial.items.push('Utility bills (12-month history helps buyers estimate costs)');
  financial.items.push('Home improvement receipts (for cost basis documentation)');
  categories.push(financial);

  // HOA
  if (hoa === 'yes' || propertyType === 'condo') {
    var hoaDocs = { title: 'HOA / Condo Association', items: [] };
    hoaDocs.items.push('HOA bylaws and CC&Rs');
    hoaDocs.items.push('Current HOA fee schedule');
    hoaDocs.items.push('Recent HOA meeting minutes');
    hoaDocs.items.push('HOA financial statements and reserve fund status');
    hoaDocs.items.push('Any pending special assessments');
    hoaDocs.items.push('HOA contact information');
    categories.push(hoaDocs);
  }

  // Permits & Inspections
  var permits = { title: 'Permits & Inspections', items: [] };
  permits.items.push('Building permits for any additions or major work');
  permits.items.push('Certificate of occupancy (if applicable)');
  permits.items.push('Pre-listing inspection report (included free with TD Realty listing)');
  permits.items.push('Any past inspection reports');
  categories.push(permits);

  var contentDiv = document.getElementById('sd-results-content');
  if (!contentDiv) return;

  var html = '<p style="color:var(--gray-600);margin-bottom:1.5rem;">Start gathering these documents early. Having them organized before listing shows buyers you\'re prepared and builds confidence in the transaction.</p>';
  categories.forEach(function(cat) {
    html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">' + cat.title + '</h4>';
    html += '<ul class="benefits-list">';
    cat.items.forEach(function(item) {
      html += '<li>' + item + '</li>';
    });
    html += '</ul>';
  });

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'seller-documents' });
}

// 7. Buyer Offer Readiness
function calcBuyerOfferReadiness() {
  var targetPrice = parseInt(document.getElementById('bor-price').value) || 400000;
  var downPctEl = document.getElementById('bor-down-pct');
  var downPct = downPctEl ? parseFloat(downPctEl.value) || 20 : 20;
  var lenderStatus = getSelected('bor-lender');
  var closingWindow = getSelected('bor-closing');
  var mustHaves = getCheckedValues('bor-must-haves');

  var fc = typeof formatCurrency === 'function' ? formatCurrency : function(v) { return '$' + v.toLocaleString(); };
  var downPayment = Math.round(targetPrice * downPct / 100);
  var cashBack = Math.round(targetPrice * 0.01);

  var readiness = [];
  var lenderQuestions = [];
  var timeline = [];

  // Readiness Checklist
  if (lenderStatus === 'pre-approved') {
    readiness.push({ item: 'Pre-approval letter', status: 'ready', note: 'You\'re pre-approved — strong position.' });
  } else if (lenderStatus === 'pre-qualified') {
    readiness.push({ item: 'Pre-approval letter', status: 'action', note: 'Upgrade from pre-qualified to pre-approved for stronger offers.' });
  } else {
    readiness.push({ item: 'Pre-approval letter', status: 'action', note: 'Get pre-approved before making offers. This is step one.' });
  }

  readiness.push({ item: 'Down payment funds: ' + fc(downPayment) + ' (' + downPct + '%)', status: 'info', note: 'Verify funds are in an accessible account.' });
  readiness.push({ item: 'Proof of funds documentation', status: 'info', note: 'Recent bank statement showing down payment + reserves.' });
  readiness.push({ item: 'Earnest money ready', status: 'info', note: 'Typically 1-2% of purchase price (' + fc(Math.round(targetPrice * 0.01)) + '-' + fc(Math.round(targetPrice * 0.02)) + ').' });

  if (mustHaves.length > 0) {
    readiness.push({ item: 'Must-haves prioritized', status: 'ready', note: 'Your priorities: ' + mustHaves.join(', ') + '.' });
  }

  // Lender Questions
  lenderQuestions.push('What is the current interest rate for my loan type and credit score?');
  lenderQuestions.push('What are the total estimated closing costs?');
  lenderQuestions.push('How long will the loan process take from contract to close?');
  lenderQuestions.push('Are there any conditions that could delay or deny the loan?');
  if (downPct < 20) lenderQuestions.push('What will my PMI (private mortgage insurance) cost?');
  lenderQuestions.push('Can closing costs be rolled into the loan or covered by seller credits?');

  // Timeline
  timeline.push({ step: 'Tour homes and identify your top choice', days: '1-14 days' });
  timeline.push({ step: 'Submit offer with pre-approval letter', days: 'Day 1' });
  timeline.push({ step: 'Negotiation and acceptance', days: '1-3 days' });
  timeline.push({ step: 'Home inspection', days: 'Days 5-10' });
  timeline.push({ step: 'Appraisal ordered', days: 'Days 7-14' });
  if (closingWindow === '30') timeline.push({ step: 'Target closing', days: 'Day 30' });
  else if (closingWindow === '45') timeline.push({ step: 'Target closing', days: 'Day 45' });
  else timeline.push({ step: 'Target closing', days: 'Day 60' });

  var contentDiv = document.getElementById('bor-results-content');
  if (!contentDiv) return;

  var html = '<h4 style="color:var(--navy);margin-bottom:0.75rem;">Readiness Checklist</h4>';
  readiness.forEach(function(r) {
    var icon = r.status === 'ready' ? '<span style="color:var(--success);">&#10003;</span>' :
               r.status === 'action' ? '<span style="color:var(--gold);">&#9888;</span>' :
               '<span style="color:var(--navy);">&#8226;</span>';
    html += '<div class="result-row"><span class="result-label">' + icon + ' ' + r.item + '</span></div>';
    html += '<p style="font-size:0.875rem;color:var(--gray-600);margin:-0.5rem 0 0.75rem 1.5rem;">' + r.note + '</p>';
  });

  html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">Questions for Your Lender</h4>';
  html += '<ul style="margin:0 0 0 1rem;color:var(--gray-700);">';
  lenderQuestions.forEach(function(q) { html += '<li style="margin-bottom:0.5rem;">' + q + '</li>'; });
  html += '</ul>';

  html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">Tour-to-Offer Timeline</h4>';
  timeline.forEach(function(t) {
    html += '<div class="result-row"><span class="result-label">' + t.step + '</span><span class="result-value" style="font-size:1rem;">' + t.days + '</span></div>';
  });

  html += '<div style="background:linear-gradient(135deg,#1a2e44,#2d4a7c);color:white;padding:1.5rem;border-radius:var(--radius-md);margin-top:1.5rem;text-align:center;">';
  html += '<p style="margin-bottom:0.5rem;">First-time buyer? You could receive</p>';
  html += '<div style="font-size:2rem;font-weight:700;color:var(--gold);font-family:\'DM Serif Display\',serif;">' + fc(cashBack) + ' cash back</div>';
  html += '<p style="opacity:0.8;margin-top:0.5rem;font-size:0.875rem;">1% cash back at closing with TD Realty Ohio. Subject to lender approval.</p></div>';

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'buyer-offer-readiness' });
}

// 8. Buyer Closing Costs
function calcBuyerClosingCosts() {
  var purchasePrice = parseInt(document.getElementById('bcc-price').value) || 400000;
  var downPctEl = document.getElementById('bcc-down-pct');
  var downPct = downPctEl ? parseFloat(downPctEl.value) || 20 : 20;
  var countyEl = document.getElementById('bcc-county');
  var county = countyEl ? countyEl.value : 'Franklin';
  var firstTimeEl = document.getElementById('bcc-first-time');
  var firstTime = firstTimeEl ? firstTimeEl.checked : false;

  var fc = typeof formatCurrency === 'function' ? formatCurrency : function(v) { return '$' + v.toLocaleString(); };
  var loanAmount = Math.round(purchasePrice * (1 - downPct / 100));
  var downPayment = Math.round(purchasePrice * downPct / 100);

  // Cost items with ranges
  var items = [];
  items.push({ label: 'Loan Origination Fee', low: Math.round(loanAmount * 0.005), high: Math.round(loanAmount * 0.01) });
  items.push({ label: 'Appraisal', low: 400, high: 600 });
  items.push({ label: 'Home Inspection', low: 350, high: 500 });
  items.push({ label: 'Title Search & Insurance', low: Math.round(purchasePrice * 0.003), high: Math.round(purchasePrice * 0.005) });
  items.push({ label: 'Recording Fees', low: 100, high: 250 });
  items.push({ label: 'Attorney / Settlement Fee', low: 500, high: 1000 });

  // County-specific property transfer tax
  var transferRate = county === 'Delaware' ? 0.003 : county === 'Licking' ? 0.003 : county === 'Fairfield' ? 0.003 : 0.004;
  items.push({ label: 'Transfer Tax (' + county + ' County)', low: Math.round(purchasePrice * transferRate * 0.8), high: Math.round(purchasePrice * transferRate) });

  // Prepaid items
  items.push({ label: 'Prepaid Property Tax (2-6 months)', low: Math.round(purchasePrice * 0.018 / 12 * 2), high: Math.round(purchasePrice * 0.018 / 12 * 6) });
  items.push({ label: 'Prepaid Homeowners Insurance', low: 800, high: 2000 });
  items.push({ label: 'Prepaid Interest', low: Math.round(loanAmount * 0.065 / 365 * 5), high: Math.round(loanAmount * 0.065 / 365 * 25) });

  if (downPct < 20) {
    items.push({ label: 'PMI (first year estimate)', low: Math.round(loanAmount * 0.005), high: Math.round(loanAmount * 0.015) });
  }

  var totalLow = 0, totalHigh = 0;
  items.forEach(function(item) { totalLow += item.low; totalHigh += item.high; });

  var cashBack = firstTime ? Math.round(purchasePrice * 0.01) : 0;

  var contentDiv = document.getElementById('bcc-results-content');
  if (!contentDiv) return;

  var html = '<div class="result-row" style="border-bottom:2px solid var(--navy);"><span class="result-label" style="font-weight:700;">Purchase Price</span><span class="result-value">' + fc(purchasePrice) + '</span></div>';
  html += '<div class="result-row"><span class="result-label">Down Payment (' + downPct + '%)</span><span class="result-value">' + fc(downPayment) + '</span></div>';
  html += '<div class="result-row"><span class="result-label">Loan Amount</span><span class="result-value">' + fc(loanAmount) + '</span></div>';

  html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">Estimated Closing Costs</h4>';
  items.forEach(function(item) {
    html += '<div class="result-row"><span class="result-label">' + item.label + '</span><span class="result-value" style="font-size:1rem;">' + fc(item.low) + ' - ' + fc(item.high) + '</span></div>';
  });

  html += '<div class="result-row" style="border-top:2px solid var(--navy);margin-top:0.75rem;padding-top:0.75rem;"><span class="result-label" style="font-weight:700;">Total Estimated Closing Costs</span><span class="result-value highlight">' + fc(totalLow) + ' - ' + fc(totalHigh) + '</span></div>';

  if (firstTime && cashBack > 0) {
    html += '<div style="background:linear-gradient(135deg,#1a2e44,#2d4a7c);color:white;padding:1.5rem;border-radius:var(--radius-md);margin-top:1.5rem;text-align:center;">';
    html += '<p style="margin-bottom:0.5rem;">First-time buyer cash back with TD Realty</p>';
    html += '<div style="font-size:2rem;font-weight:700;color:var(--gold);font-family:\'DM Serif Display\',serif;">' + fc(cashBack) + '</div>';
    html += '<p style="opacity:0.8;margin-top:0.5rem;font-size:0.875rem;">1% of purchase price back at closing. May be applied to closing costs. Subject to lender approval.</p></div>';
  }

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'buyer-closing-costs' });
}

// 9. Move-Up Plan
function calcMoveUpPlan() {
  var currentValue = parseInt(document.getElementById('mup-current-value').value) || 400000;
  var targetPrice = parseInt(document.getElementById('mup-target-price').value) || 500000;
  var cashEl = document.getElementById('mup-cash');
  var cashAvailable = cashEl ? parseInt(cashEl.value) || 0 : 0;
  var financing = getSelected('mup-financing');
  var sellFirst = getSelected('mup-sell-first');
  var contingency = getSelected('mup-contingency');

  var fc = typeof formatCurrency === 'function' ? formatCurrency : function(v) { return '$' + v.toLocaleString(); };

  // Estimated equity (assume 1% listing fee + ~2.5% buyer agent + ~1.5% closing)
  var sellingCosts = Math.round(currentValue * 0.05);
  var estimatedEquity = currentValue - sellingCosts;
  var gapAmount = targetPrice - estimatedEquity - cashAvailable;

  var recommendation = '';
  var lenderQuestions = [];
  var timelineSteps = [];

  if (sellFirst === 'yes' || (gapAmount > 0 && financing !== 'approved')) {
    recommendation = 'Sell First';
    timelineSteps.push({ step: 'List current home', timing: 'Month 1' });
    timelineSteps.push({ step: 'Accept offer and begin closing', timing: 'Month 1-2' });
    timelineSteps.push({ step: 'Close on sale and secure proceeds', timing: 'Month 2-3' });
    timelineSteps.push({ step: 'Begin home search with full buying power', timing: 'Month 3' });
    timelineSteps.push({ step: 'Make offer and close on new home', timing: 'Month 4-5' });
  } else if (sellFirst === 'no' && (financing === 'approved' || cashAvailable > targetPrice * 0.2)) {
    recommendation = 'Buy First';
    timelineSteps.push({ step: 'Get pre-approved for new home purchase', timing: 'Month 1' });
    timelineSteps.push({ step: 'Find and close on new home', timing: 'Month 1-3' });
    timelineSteps.push({ step: 'Move into new home', timing: 'Month 3' });
    timelineSteps.push({ step: 'List current home (empty staging)', timing: 'Month 3-4' });
    timelineSteps.push({ step: 'Close on sale of current home', timing: 'Month 4-5' });
  } else {
    recommendation = 'Simultaneous or Contingent';
    timelineSteps.push({ step: 'Get pre-approved and list current home', timing: 'Month 1' });
    timelineSteps.push({ step: 'Accept offer with contingency window', timing: 'Month 1-2' });
    timelineSteps.push({ step: 'Find new home and make contingent offer', timing: 'Month 2-3' });
    timelineSteps.push({ step: 'Coordinate both closings', timing: 'Month 3-4' });
  }

  lenderQuestions.push('Can I qualify for a new mortgage while still owning my current home?');
  lenderQuestions.push('What bridge loan or HELOC options are available?');
  lenderQuestions.push('How will carrying two mortgages affect my debt-to-income ratio?');
  lenderQuestions.push('What is the maximum purchase price I qualify for?');
  if (gapAmount > 0) lenderQuestions.push('I have an estimated gap of ' + fc(gapAmount) + ' — what financing covers this?');

  var contentDiv = document.getElementById('mup-results-content');
  if (!contentDiv) return;

  var html = '<div style="background:linear-gradient(135deg,#1a2e44,#2d4a7c);color:white;padding:1.5rem;border-radius:var(--radius-md);margin-bottom:1.5rem;text-align:center;">';
  html += '<p style="opacity:0.8;margin-bottom:0.5rem;">Recommended Approach</p>';
  html += '<div style="font-size:1.75rem;font-weight:700;font-family:\'DM Serif Display\',serif;">' + recommendation + '</div></div>';

  html += '<h4 style="color:var(--navy);margin-bottom:0.75rem;">Financial Snapshot</h4>';
  html += '<div class="result-row"><span class="result-label">Current Home Value</span><span class="result-value">' + fc(currentValue) + '</span></div>';
  html += '<div class="result-row"><span class="result-label">Est. Selling Costs (5%)</span><span class="result-value">-' + fc(sellingCosts) + '</span></div>';
  html += '<div class="result-row"><span class="result-label">Est. Net Equity</span><span class="result-value highlight">' + fc(estimatedEquity) + '</span></div>';
  html += '<div class="result-row"><span class="result-label">Cash Available</span><span class="result-value">' + fc(cashAvailable) + '</span></div>';
  html += '<div class="result-row"><span class="result-label">Target Purchase Price</span><span class="result-value">' + fc(targetPrice) + '</span></div>';
  if (gapAmount > 0) {
    html += '<div class="result-row"><span class="result-label">Financing Needed</span><span class="result-value" style="color:var(--error);">' + fc(gapAmount) + '</span></div>';
  }

  html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">Estimated Timeline</h4>';
  timelineSteps.forEach(function(t) {
    html += '<div class="result-row"><span class="result-label">' + t.step + '</span><span class="result-value" style="font-size:1rem;">' + t.timing + '</span></div>';
  });

  html += '<h4 style="color:var(--navy);margin:1.5rem 0 0.75rem;">Questions for Your Lender</h4>';
  html += '<ul style="margin:0 0 0 1rem;color:var(--gray-700);">';
  lenderQuestions.forEach(function(q) { html += '<li style="margin-bottom:0.5rem;">' + q + '</li>'; });
  html += '</ul>';

  html += '<div style="background:var(--off-white);padding:1rem;border-radius:var(--radius-md);margin-top:1.5rem;">';
  html += '<p style="color:var(--navy);font-weight:600;margin-bottom:0.25rem;">TD Realty Ohio: 1% Listing Fee</p>';
  html += '<p style="color:var(--gray-600);font-size:0.9375rem;margin:0;">When you sell and buy with us, your listing fee is just 1%. On your ' + fc(currentValue) + ' home, that saves you ' + fc(Math.round(currentValue * 0.02)) + ' compared to a traditional 3% listing fee.</p></div>';

  contentDiv.innerHTML = html;
  var resultsDiv = document.getElementById('tool-results');
  if (resultsDiv) resultsDiv.style.display = 'block';
  if (typeof trackEvent === 'function') trackEvent('tool_calculate', { label: 'move-up-plan' });
}

/* ===== HELPER FUNCTIONS ===== */
function setResult(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getSelected(name) {
  var el = document.getElementById(name);
  if (el) return el.value;
  var radio = document.querySelector('[name="' + name + '"]:checked');
  if (radio) return radio.value;
  return '';
}

function getCheckedValues(name) {
  var checkboxes = document.querySelectorAll('[name="' + name + '"]:checked');
  var values = [];
  checkboxes.forEach(function(cb) { values.push(cb.value); });
  return values;
}

/* ===== RELATED TOOLS RENDERER ===== */
function renderRelatedTools(toolSlug) {
  var container = document.getElementById('related-tools');
  if (!container) return;
  var toolDef = TD_TOOLS[toolSlug];
  if (!toolDef || !toolDef.related) return;

  var html = '';
  toolDef.related.forEach(function(slug) {
    var related = TD_TOOLS[slug];
    if (!related) return;
    html += '<a href="/tools/' + slug + '/" class="feature-card" style="text-decoration:none;display:block;">';
    html += '<h4 class="feature-card-title">' + related.name + '</h4>';
    html += '<span class="feature-card-link">Try this tool &rarr;</span></a>';
  });

  container.innerHTML = html;
}

/* ===== INIT ON LOAD ===== */
function initTool(toolSlug) {
  // Track page view
  if (typeof trackEvent === 'function') trackEvent('tool_view', { label: toolSlug });

  // Check for shared link
  var shared = ToolShare.decode();
  if (shared) {
    // Pre-fill inputs from shared state
    Object.keys(shared).forEach(function(key) {
      var el = document.getElementById(key);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = shared[key];
      } else if (el.type === 'range') {
        el.value = shared[key];
        if (typeof updateSliderTrack === 'function') updateSliderTrack(el);
        // Update display
        var displayEl = document.getElementById(key + '-display');
        if (displayEl) {
          var val = parseInt(shared[key]);
          displayEl.textContent = typeof formatCurrency === 'function' ? formatCurrency(val) : '$' + val.toLocaleString();
        }
      } else {
        el.value = shared[key];
      }
    });
    // Auto-calculate after brief delay for DOM
    setTimeout(function() {
      var calcBtn = document.getElementById('tool-calculate-btn');
      if (calcBtn) calcBtn.click();
    }, 100);
  }

  // Render related tools
  renderRelatedTools(toolSlug);
}
