/**
 * TD Realty Seller Intelligence - Google Apps Script Web App (v2.0)
 *
 * Complete automated platform for seller lead intelligence, life event
 * monitoring, skip tracing, and automated outreach.
 *
 * SETUP:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click Deploy > New Deployment
 * 5. Select "Web app"
 * 6. Set "Execute as" to "Me"
 * 7. Set "Who has access" to "Anyone" (the secret URL provides security)
 * 8. Click Deploy and copy the Web App URL
 * 9. Add that URL as APPS_SCRIPT_URL secret in GitHub
 */

// Secret token for basic auth (change this to something random!)
const AUTH_TOKEN = 'CHANGE_THIS_TO_A_RANDOM_STRING';

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'TD Realty Seller Intelligence API v2.0 is running',
    tabs: Object.keys(TAB_SCHEMAS)
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests (main API)
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);

    // Verify auth token
    if (request.token !== AUTH_TOKEN) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const action = request.action;
    const params = request.params || {};

    let result;

    switch (action) {
      case 'read_sheet':
        result = readSheet(params.tab_name, params.range);
        break;
      case 'write_sheet':
        result = writeSheet(params.tab_name, params.data, params.start_cell);
        break;
      case 'append_rows':
        result = appendRows(params.tab_name, params.rows);
        break;
      case 'clear_sheet':
        result = clearSheet(params.tab_name, params.keep_header);
        break;
      case 'get_config':
        result = getConfig();
        break;
      case 'log_run':
        result = logRun(params.script_name, params.status, params.records, params.errors, params.duration);
        break;
      case 'update_rows':
        result = updateRows(params.tab_name, params.rows, params.key_column, params.columns);
        break;
      case 'setup_tabs':
        result = setupTabs();
        break;
      case 'add_life_event':
        result = addLifeEvent(params.event);
        break;
      case 'queue_outreach':
        result = queueOutreach(params.outreach);
        break;
      case 'get_outreach_queue':
        result = getOutreachQueue();
        break;
      case 'update_outreach_status':
        result = updateOutreachStatus(params.queue_id, params.status, params.details);
        break;
      case 'get_daily_summary':
        result = getDailySummary();
        break;
      case 'send_notification':
        result = sendNotification(params.type, params.data);
        break;
      default:
        return jsonResponse({ error: 'Unknown action: ' + action }, 400);
    }

    return jsonResponse({ success: true, data: result });

  } catch (error) {
    return jsonResponse({ error: error.toString() }, 500);
  }
}

/**
 * Helper to create JSON response
 */
function jsonResponse(data, code) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Tab schemas - defines all sheets and their columns
 */
const TAB_SCHEMAS = {
  'Master Properties': [
    'parcel_id', 'address', 'unit', 'city', 'state', 'zip', 'county', 'neighborhood',
    'property_type', 'beds', 'baths', 'sqft', 'lot_sqft', 'year_built',
    'owner_name', 'owner_first_name', 'owner_last_name',
    'owner_mailing_address', 'owner_mailing_city', 'owner_mailing_state', 'owner_mailing_zip',
    'is_owner_occupied', 'is_likely_investor',
    'purchase_date', 'purchase_price', 'years_owned',
    'assessed_value_land', 'assessed_value_building', 'assessed_value_total',
    'estimated_market_value', 'estimated_equity', 'equity_gain_percent', 'mortgage_balance_estimate',
    'propensity_score', 'td_fit_score', 'timing_score', 'priority_tier',
    'life_event_flags', 'last_life_event_date',
    'phone_1', 'phone_2', 'email_1', 'email_2',
    'skip_trace_date', 'skip_trace_status',
    'outreach_status', 'last_outreach_date', 'last_outreach_type',
    'do_not_contact', 'notes', 'created_at', 'updated_at'
  ],

  'Life Events': [
    'event_id', 'event_type', 'event_date', 'case_number', 'court', 'parties',
    'address', 'matched_parcel_id', 'match_confidence', 'source_url', 'raw_data',
    'outreach_triggered', 'outreach_date', 'created_at'
  ],

  'Hot Leads': [
    'parcel_id', 'address', 'city', 'zip', 'county', 'neighborhood',
    'owner_name', 'phone_1', 'email_1',
    'estimated_market_value', 'estimated_equity', 'years_owned',
    'propensity_score', 'td_fit_score', 'priority_tier',
    'life_event_flags', 'outreach_status', 'last_updated'
  ],

  'Warm Leads': [
    'parcel_id', 'address', 'city', 'zip', 'county', 'neighborhood',
    'owner_name', 'phone_1', 'email_1',
    'estimated_market_value', 'estimated_equity', 'years_owned',
    'propensity_score', 'td_fit_score', 'priority_tier',
    'life_event_flags', 'outreach_status', 'last_updated'
  ],

  'Life Event Alerts': [
    'event_date', 'event_type', 'address', 'owner_name',
    'propensity_score', 'estimated_equity', 'recommended_action',
    'outreach_status', 'case_number'
  ],

  'Inbound Leads': [
    'lead_id', 'timestamp', 'source', 'ip_address', 'user_agent',
    'address_entered', 'name', 'email', 'phone', 'message',
    'matched_parcel_id', 'match_status', 'enrichment_status', 'lead_score',
    'assigned_to', 'status', 'notes'
  ],

  'Enriched Leads': [
    'lead_id', 'timestamp', 'source', 'name', 'email', 'phone', 'address_entered',
    'matched_parcel_id', 'match_status', 'lead_score', 'status',
    'parcel_id', 'address', 'city', 'zip', 'county',
    'owner_name', 'estimated_market_value', 'estimated_equity',
    'propensity_score', 'td_fit_score', 'priority_tier', 'life_event_flags'
  ],

  'Outreach Queue': [
    'queue_id', 'parcel_id', 'owner_name', 'address',
    'outreach_type', 'trigger_reason', 'template_id', 'personalization_data',
    'scheduled_date', 'status', 'sent_date', 'delivery_status',
    'response_received', 'cost', 'created_at'
  ],

  'Outreach History': [
    'queue_id', 'parcel_id', 'owner_name', 'address',
    'outreach_type', 'trigger_reason', 'template_id',
    'sent_date', 'delivery_status', 'cost',
    'opened', 'clicked', 'response_date', 'response_type', 'outcome'
  ],

  'Neighborhood Stats': [
    'neighborhood', 'county', 'total_properties', 'owner_occupied_count', 'investor_owned_count',
    'avg_home_value', 'median_home_value', 'avg_years_owned', 'avg_equity',
    'avg_propensity_score', 'hot_lead_count', 'warm_lead_count',
    'life_events_30d', 'sales_last_12mo', 'turnover_rate', 'avg_dom', 'last_updated'
  ],

  'Facebook Audiences': [
    'audience_name', 'last_sync_date', 'record_count', 'audience_id', 'status'
  ],

  'Config': ['setting_name', 'value', 'description'],

  'Run Log': [
    'run_id', 'timestamp', 'workflow', 'script', 'status',
    'records_processed', 'records_created', 'records_updated',
    'errors', 'duration_seconds', 'notes'
  ],

  'Daily Summary': [
    'date', 'new_properties_added', 'properties_updated', 'new_life_events',
    'divorce_events', 'probate_events', 'foreclosure_events',
    'new_hot_leads', 'skip_traces_completed', 'outreach_sent',
    'inbound_leads', 'total_hot_leads', 'total_warm_leads'
  ]
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = [
  ['market_value_multiplier', '1.1', 'Multiply assessed value by this for market estimate'],
  ['hot_threshold', '80', 'Propensity score >= this = HOT'],
  ['warm_threshold', '50', 'Propensity score >= this and < hot = WARM'],
  ['min_equity_for_outreach', '50000', 'Only outreach if equity >= this'],
  ['min_home_value', '200000', 'Minimum property value to track'],
  ['max_home_value', '1000000', 'Maximum property value to track'],
  ['skip_trace_hot_leads', 'true', 'Auto skip trace HOT leads'],
  ['skip_trace_life_events', 'true', 'Auto skip trace life event matches'],
  ['auto_outreach_enabled', 'true', 'Enable automated outreach'],
  ['outreach_delay_days', '2', 'Days to wait after trigger before outreach'],
  ['max_outreach_per_day', '50', 'Rate limit on outreach'],
  ['divorce_letter_template', 'divorce_v1', 'Template for divorce outreach'],
  ['probate_letter_template', 'probate_v1', 'Template for probate outreach'],
  ['foreclosure_letter_template', 'foreclosure_v1', 'Template for foreclosure outreach'],
  ['high_score_letter_template', 'high_score_v1', 'Template for score-based outreach'],
  ['facebook_sync_enabled', 'true', 'Enable Facebook audience sync'],
  ['notification_email', '', 'Where to send alerts'],
  ['notification_phone', '', 'SMS alerts for hot triggers'],
  ['weight_years_owned', '0.25', 'Scoring weight for years owned'],
  ['weight_equity_gain', '0.25', 'Scoring weight for equity gain'],
  ['weight_neighborhood_turnover', '0.15', 'Scoring weight for neighborhood turnover'],
  ['weight_owner_occupied', '0.10', 'Scoring weight for owner occupied status'],
  ['weight_price_tier', '0.15', 'Scoring weight for price tier'],
  ['weight_home_age', '0.10', 'Scoring weight for home age']
];

/**
 * Get or create a sheet tab
 */
function getOrCreateSheet(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    // Add headers if we have a schema
    if (TAB_SCHEMAS[tabName]) {
      sheet.getRange(1, 1, 1, TAB_SCHEMAS[tabName].length).setValues([TAB_SCHEMAS[tabName]]);
    }
  }

  return sheet;
}

/**
 * Read data from a sheet
 */
function readSheet(tabName, range) {
  const sheet = getOrCreateSheet(tabName);

  let data;
  if (range) {
    data = sheet.getRange(range).getValues();
  } else {
    data = sheet.getDataRange().getValues();
  }

  // Convert to list of dicts using first row as headers
  if (data.length > 1) {
    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    return { headers: headers, rows: rows, raw: data };
  }

  return { headers: data[0] || [], rows: [], raw: data };
}

/**
 * Write data to a sheet (overwrites existing)
 */
function writeSheet(tabName, data, startCell) {
  const sheet = getOrCreateSheet(tabName);
  startCell = startCell || 'A1';

  if (!data || data.length === 0) {
    return { rows_written: 0 };
  }

  // Expand sheet if needed
  const numRows = data.length;
  const numCols = Math.max(...data.map(row => row.length));

  if (sheet.getMaxRows() < numRows + 10) {
    sheet.insertRows(sheet.getMaxRows(), numRows + 100 - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < numCols + 5) {
    sheet.insertColumns(sheet.getMaxColumns(), numCols + 10 - sheet.getMaxColumns());
  }

  const range = sheet.getRange(startCell).offset(0, 0, numRows, numCols);
  range.setValues(data);

  return { rows_written: numRows };
}

/**
 * Append rows to end of sheet
 */
function appendRows(tabName, rows) {
  const sheet = getOrCreateSheet(tabName);

  if (!rows || rows.length === 0) {
    return { rows_appended: 0 };
  }

  rows.forEach(row => {
    sheet.appendRow(row);
  });

  return { rows_appended: rows.length };
}

/**
 * Clear sheet data
 */
function clearSheet(tabName, keepHeader) {
  const sheet = getOrCreateSheet(tabName);

  if (keepHeader) {
    const lastCol = sheet.getLastColumn() || 1;
    const header = sheet.getRange(1, 1, 1, lastCol).getValues();
    sheet.clear();
    if (header[0].length > 0 && header[0][0] !== '') {
      sheet.getRange(1, 1, 1, header[0].length).setValues(header);
    }
  } else {
    sheet.clear();
  }

  return { cleared: true };
}

/**
 * Get configuration from Config tab
 */
function getConfig() {
  const data = readSheet('Config');
  const config = {};

  data.rows.forEach(row => {
    const name = row['setting_name'];
    let value = row['value'];

    // Convert to appropriate type
    if (value !== '' && !isNaN(value)) {
      value = parseFloat(value);
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }

    if (name) {
      config[name] = value;
    }
  });

  return config;
}

/**
 * Log a script run
 */
function logRun(scriptName, status, records, errors, duration) {
  const runId = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  const row = [
    runId, timestamp, '', scriptName, status,
    records || 0, 0, 0, errors || '', duration || 0, ''
  ];

  appendRows('Run Log', [row]);

  return { logged: true, run_id: runId };
}

/**
 * Update rows by matching on key column
 */
function updateRows(tabName, rows, keyColumn, columns) {
  const sheet = getOrCreateSheet(tabName);
  const existingData = readSheet(tabName);

  // Create lookup of existing rows by key
  const existingByKey = {};
  existingData.rows.forEach((row, index) => {
    const key = row[keyColumn];
    if (key) {
      existingByKey[key] = index + 2; // +2 for header and 1-based index
    }
  });

  let updated = 0;
  let inserted = 0;
  const toInsert = [];

  rows.forEach(row => {
    const key = row[keyColumn];
    const rowData = columns.map(col => {
      const val = row[col];
      // Convert booleans to strings
      if (typeof val === 'boolean') return val.toString();
      return val !== undefined ? val : '';
    });

    if (key && existingByKey[key]) {
      // Update existing row
      const rowNum = existingByKey[key];
      sheet.getRange(rowNum, 1, 1, columns.length).setValues([rowData]);
      updated++;
    } else {
      // Queue for insert
      toInsert.push(rowData);
      inserted++;
    }
  });

  // Batch insert new rows
  if (toInsert.length > 0) {
    toInsert.forEach(row => {
      sheet.appendRow(row);
    });
  }

  return { updated: updated, inserted: inserted };
}

/**
 * Add a life event
 */
function addLifeEvent(event) {
  const eventId = event.event_id || Utilities.getUuid();
  const row = [
    eventId,
    event.event_type,
    event.event_date,
    event.case_number || '',
    event.court || '',
    event.parties || '',
    event.address || '',
    event.matched_parcel_id || '',
    event.match_confidence || 'UNMATCHED',
    event.source_url || '',
    JSON.stringify(event.raw_data || {}),
    false,
    '',
    new Date().toISOString()
  ];

  appendRows('Life Events', [row]);

  // Also add to alerts if matched
  if (event.matched_parcel_id && event.match_confidence !== 'UNMATCHED') {
    const alertRow = [
      event.event_date,
      event.event_type,
      event.address,
      event.owner_name || '',
      event.propensity_score || '',
      event.estimated_equity || '',
      getRecommendedAction(event.event_type),
      'pending',
      event.case_number || ''
    ];
    appendRows('Life Event Alerts', [alertRow]);
  }

  return { event_id: eventId, added: true };
}

/**
 * Get recommended action based on event type
 */
function getRecommendedAction(eventType) {
  const actions = {
    'DIVORCE': 'Send divorce letter in 3 days',
    'PROBATE': 'Send probate letter in 7 days',
    'FORECLOSURE': 'Send foreclosure letter ASAP',
    'EVICTION': 'Add to investor outreach list',
    'TAX_DELINQUENT': 'Send tax delinquent letter'
  };
  return actions[eventType] || 'Review manually';
}

/**
 * Queue an outreach action
 */
function queueOutreach(outreach) {
  const queueId = outreach.queue_id || Utilities.getUuid();
  const row = [
    queueId,
    outreach.parcel_id,
    outreach.owner_name,
    outreach.address,
    outreach.outreach_type,
    outreach.trigger_reason,
    outreach.template_id,
    JSON.stringify(outreach.personalization_data || {}),
    outreach.scheduled_date || new Date().toISOString().split('T')[0],
    'queued',
    '',
    '',
    false,
    0,
    new Date().toISOString()
  ];

  appendRows('Outreach Queue', [row]);

  return { queue_id: queueId, queued: true };
}

/**
 * Get pending outreach items
 */
function getOutreachQueue() {
  const data = readSheet('Outreach Queue');
  const pending = data.rows.filter(row => row.status === 'queued');
  return { items: pending, count: pending.length };
}

/**
 * Update outreach status and move to history if complete
 */
function updateOutreachStatus(queueId, status, details) {
  const sheet = getOrCreateSheet('Outreach Queue');
  const data = readSheet('Outreach Queue');

  // Find the row
  let rowIndex = -1;
  let outreachRow = null;
  data.rows.forEach((row, index) => {
    if (row.queue_id === queueId) {
      rowIndex = index + 2; // +2 for header and 1-based
      outreachRow = row;
    }
  });

  if (rowIndex === -1) {
    return { updated: false, error: 'Queue item not found' };
  }

  // Update status
  const statusCol = TAB_SCHEMAS['Outreach Queue'].indexOf('status') + 1;
  sheet.getRange(rowIndex, statusCol).setValue(status);

  // If sent or completed, move to history
  if (status === 'sent' || status === 'delivered' || status === 'failed') {
    const historyRow = [
      outreachRow.queue_id,
      outreachRow.parcel_id,
      outreachRow.owner_name,
      outreachRow.address,
      outreachRow.outreach_type,
      outreachRow.trigger_reason,
      outreachRow.template_id,
      details.sent_date || new Date().toISOString(),
      status,
      details.cost || 0,
      false,
      false,
      '',
      '',
      ''
    ];
    appendRows('Outreach History', [historyRow]);
  }

  return { updated: true };
}

/**
 * Get daily summary data
 */
function getDailySummary() {
  const today = new Date().toISOString().split('T')[0];

  const properties = readSheet('Master Properties');
  const lifeEvents = readSheet('Life Events');
  const outreachHistory = readSheet('Outreach History');
  const inboundLeads = readSheet('Inbound Leads');

  // Count today's events
  const todayEvents = lifeEvents.rows.filter(e =>
    e.event_date && e.event_date.toString().startsWith(today)
  );

  const hotLeads = properties.rows.filter(p => p.priority_tier === 'HOT');
  const warmLeads = properties.rows.filter(p => p.priority_tier === 'WARM');

  const todayOutreach = outreachHistory.rows.filter(o =>
    o.sent_date && o.sent_date.toString().startsWith(today)
  );

  const todayInbound = inboundLeads.rows.filter(l =>
    l.timestamp && l.timestamp.toString().startsWith(today)
  );

  return {
    date: today,
    total_properties: properties.rows.length,
    total_hot_leads: hotLeads.length,
    total_warm_leads: warmLeads.length,
    new_life_events: todayEvents.length,
    divorce_events: todayEvents.filter(e => e.event_type === 'DIVORCE').length,
    probate_events: todayEvents.filter(e => e.event_type === 'PROBATE').length,
    foreclosure_events: todayEvents.filter(e => e.event_type === 'FORECLOSURE').length,
    outreach_sent: todayOutreach.length,
    inbound_leads: todayInbound.length
  };
}

/**
 * Send a notification (placeholder - implement based on your notification service)
 */
function sendNotification(type, data) {
  // This would integrate with email/SMS service
  // For now, just log it
  const config = getConfig();

  if (type === 'email' && config.notification_email) {
    // Would send email here
    return { sent: true, method: 'email', to: config.notification_email };
  }

  if (type === 'sms' && config.notification_phone) {
    // Would send SMS here
    return { sent: true, method: 'sms', to: config.notification_phone };
  }

  return { sent: false, reason: 'No notification endpoint configured' };
}

/**
 * Set up all required tabs with headers
 */
function setupTabs() {
  const createdTabs = [];

  // Create each tab with headers from schema
  Object.keys(TAB_SCHEMAS).forEach(tabName => {
    const sheet = getOrCreateSheet(tabName);
    const headers = TAB_SCHEMAS[tabName];

    // Check if headers already exist
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
    const hasHeaders = existingHeaders.some(h => h !== '');

    if (!hasHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      createdTabs.push(tabName);
    }
  });

  // Add default config if Config tab is empty
  const configSheet = getOrCreateSheet('Config');
  if (configSheet.getLastRow() <= 1) {
    DEFAULT_CONFIG.forEach(row => {
      configSheet.appendRow(row);
    });
  }

  return { tabs_created: createdTabs, total_tabs: Object.keys(TAB_SCHEMAS).length };
}

/**
 * Menu for manual operations
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('TD Realty Intelligence')
    .addItem('Setup All Tabs', 'setupTabs')
    .addItem('View Daily Summary', 'showDailySummary')
    .addItem('Test API Connection', 'testApi')
    .addSeparator()
    .addItem('Clear Run Log', 'clearRunLog')
    .addToUi();
}

/**
 * Show daily summary in a dialog
 */
function showDailySummary() {
  const summary = getDailySummary();
  const message = `
TD Realty Intelligence - Daily Summary
Date: ${summary.date}

📊 PIPELINE
Total Properties: ${summary.total_properties}
Hot Leads: ${summary.total_hot_leads}
Warm Leads: ${summary.total_warm_leads}

🔥 TODAY'S ACTIVITY
New Life Events: ${summary.new_life_events}
- Divorces: ${summary.divorce_events}
- Probates: ${summary.probate_events}
- Foreclosures: ${summary.foreclosure_events}

Outreach Sent: ${summary.outreach_sent}
Inbound Leads: ${summary.inbound_leads}
  `;
  SpreadsheetApp.getUi().alert('Daily Summary', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Clear run log (keep last 100 entries)
 */
function clearRunLog() {
  const sheet = getOrCreateSheet('Run Log');
  const lastRow = sheet.getLastRow();
  if (lastRow > 101) {
    sheet.deleteRows(2, lastRow - 101);
  }
  SpreadsheetApp.getUi().alert('Run log trimmed to last 100 entries.');
}

/**
 * Test function
 */
function testApi() {
  const result = setupTabs();
  SpreadsheetApp.getUi().alert(
    'API Test',
    'Setup complete!\n\nCreated ' + result.tabs_created.length + ' new tabs.\nTotal tabs: ' + result.total_tabs,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
