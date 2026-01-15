/**
 * TD Realty Ohio - Analytics & Attribution Utilities
 * Handles anonymous tracking, session management, and UTM capture
 */

// =============================================================================
// ANONYMOUS ID (Persistent across sessions)
// =============================================================================

/**
 * Gets or creates an anonymous ID stored in localStorage
 * @returns {string} UUID v4
 */
function getAnonymousId() {
  const key = 'td_anonymous_id';
  let id = localStorage.getItem(key);

  if (!id) {
    id = generateUUID();
    localStorage.setItem(key, id);
  }

  return id;
}

// =============================================================================
// SESSION ID (Cleared on browser close)
// =============================================================================

/**
 * Gets or creates a session ID stored in sessionStorage
 * @returns {string} UUID v4
 */
function getSessionId() {
  const key = 'td_session_id';
  let id = sessionStorage.getItem(key);

  if (!id) {
    id = generateUUID();
    sessionStorage.setItem(key, id);
  }

  return id;
}

// =============================================================================
// UTM CAPTURE (First touch + last touch)
// =============================================================================

/**
 * Captures UTM parameters from URL and stores in localStorage
 * First touch: Never overwritten (unless cleared)
 * Last touch: Updated on every visit with UTM params
 */
function captureUTM() {
  const params = new URLSearchParams(window.location.search);

  const utm = {
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    term: params.get('utm_term'),
    content: params.get('utm_content'),
  };

  // Only capture if at least one UTM param present
  const hasUTM = Object.values(utm).some(v => v !== null);

  if (!hasUTM) return;

  const timestamp = new Date().toISOString();
  utm.captured_at = timestamp;
  utm.page = window.location.pathname;

  // First touch: Set once, never overwrite
  if (!localStorage.getItem('td_first_touch')) {
    localStorage.setItem('td_first_touch', JSON.stringify(utm));
  }

  // Last touch: Always update
  localStorage.setItem('td_last_touch', JSON.stringify(utm));
}

/**
 * Gets first touch UTM data
 * @returns {Object|null}
 */
function getFirstTouch() {
  const data = localStorage.getItem('td_first_touch');
  return data ? JSON.parse(data) : null;
}

/**
 * Gets last touch UTM data
 * @returns {Object|null}
 */
function getLastTouch() {
  const data = localStorage.getItem('td_last_touch');
  return data ? JSON.parse(data) : null;
}

// =============================================================================
// REFERRER CAPTURE
// =============================================================================

/**
 * Captures referrer on first page load
 */
function captureReferrer() {
  if (!sessionStorage.getItem('td_referrer') && document.referrer) {
    const referrer = {
      url: document.referrer,
      captured_at: new Date().toISOString(),
    };
    sessionStorage.setItem('td_referrer', JSON.stringify(referrer));
  }
}

/**
 * Gets captured referrer
 * @returns {Object|null}
 */
function getReferrer() {
  const data = sessionStorage.getItem('td_referrer');
  return data ? JSON.parse(data) : null;
}

// =============================================================================
// EVENT TRACKING
// =============================================================================

/**
 * Sends event to POST /api/events
 * @param {string} eventName - Event name (e.g., 'net_sheet_viewed')
 * @param {Object} data - Event data (no PII!)
 * @param {string} page - Page path (defaults to current)
 * @returns {Promise<boolean>} Success status
 */
async function sendEvent(eventName, data = {}, page = null) {
  try {
    const payload = {
      event_name: eventName,
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      page: page || window.location.pathname,
      timestamp: new Date().toISOString(),
      data: data,

      // Include attribution context
      first_touch: getFirstTouch(),
      last_touch: getLastTouch(),
      referrer: getReferrer(),
    };

    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Event tracking failed:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Event tracking error:', error);
    return false;
  }
}

// =============================================================================
// PRICE BAND DERIVATION
// =============================================================================

/**
 * Derives price band from sale price
 * @param {number} price - Sale price
 * @returns {string} Price band: 'low' | 'mid' | 'high' | 'lux'
 */
function getPriceBand(price) {
  if (price < 200000) return 'low';    // < $200k
  if (price < 400000) return 'mid';    // $200k - $400k
  if (price < 750000) return 'high';   // $400k - $750k
  return 'lux';                         // $750k+
}

// =============================================================================
// UUID GENERATION
// =============================================================================

/**
 * Generates a UUID v4
 * @returns {string}
 */
function generateUUID() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Auto-capture on page load
if (typeof window !== 'undefined') {
  // Capture UTM params
  captureUTM();

  // Capture referrer
  captureReferrer();

  // Initialize IDs (creates if don't exist)
  getAnonymousId();
  getSessionId();
}

// =============================================================================
// EXPORTS (for use in other scripts)
// =============================================================================

// Make functions available globally
if (typeof window !== 'undefined') {
  window.TDAnalytics = {
    getAnonymousId,
    getSessionId,
    captureUTM,
    getFirstTouch,
    getLastTouch,
    getReferrer,
    sendEvent,
    getPriceBand,
  };
}
