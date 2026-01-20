/**
 * TD Realty Seller Intelligence - Google Apps Script Web App
 *
 * This script runs inside your Google Sheet and provides a web API
 * that the Python scripts can call. No service account keys needed!
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
    message: 'TD Realty Seller Intelligence API is running'
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
        result = logRun(params.script_name, params.status, params.records, params.errors);
        break;
      case 'update_rows':
        result = updateRows(params.tab_name, params.rows, params.key_column, params.columns);
        break;
      case 'setup_tabs':
        result = setupTabs();
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
 * Get or create a sheet tab
 */
function getOrCreateSheet(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    sheet = ss.insertSheet(tabName);
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
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
    sheet.clear();
    if (header[0].length > 0) {
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

    // Try to convert to number
    if (value !== '' && !isNaN(value)) {
      value = parseFloat(value);
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
function logRun(scriptName, status, records, errors) {
  const timestamp = new Date().toISOString();
  const row = [timestamp, scriptName, status, records, errors || ''];

  appendRows('Run Log', [row]);

  return { logged: true };
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
 * Set up all required tabs with headers
 */
function setupTabs() {
  const tabs = {
    'Master Properties': [
      'parcel_id', 'address', 'city', 'zip', 'county', 'neighborhood',
      'owner_name', 'owner_mailing_address', 'is_owner_occupied',
      'purchase_date', 'purchase_price', 'years_owned',
      'assessed_value', 'estimated_market_value', 'estimated_equity', 'equity_gain_pct',
      'beds', 'baths', 'sqft', 'year_built', 'property_class',
      'propensity_score', 'td_fit_score', 'priority_tier', 'last_updated'
    ],
    'Hot Leads': [
      'parcel_id', 'address', 'city', 'zip', 'county', 'neighborhood',
      'owner_name', 'owner_mailing_address', 'is_owner_occupied',
      'purchase_date', 'purchase_price', 'years_owned',
      'assessed_value', 'estimated_market_value', 'estimated_equity', 'equity_gain_pct',
      'beds', 'baths', 'sqft', 'year_built', 'property_class',
      'propensity_score', 'td_fit_score', 'priority_tier', 'last_updated'
    ],
    'Warm Leads': [
      'parcel_id', 'address', 'city', 'zip', 'county', 'neighborhood',
      'owner_name', 'owner_mailing_address', 'is_owner_occupied',
      'purchase_date', 'purchase_price', 'years_owned',
      'assessed_value', 'estimated_market_value', 'estimated_equity', 'equity_gain_pct',
      'beds', 'baths', 'sqft', 'year_built', 'property_class',
      'propensity_score', 'td_fit_score', 'priority_tier', 'last_updated'
    ],
    'Inbound Leads': [
      'timestamp', 'source', 'name', 'email', 'phone',
      'address_entered', 'matched_parcel_id', 'enrichment_status'
    ],
    'Neighborhood Stats': [
      'neighborhood', 'total_properties', 'avg_years_owned', 'avg_equity',
      'avg_propensity_score', 'hot_lead_count', 'warm_lead_count',
      'turnover_rate_12mo', 'last_updated'
    ],
    'Config': ['setting_name', 'value', 'description'],
    'Run Log': ['timestamp', 'script_name', 'status', 'records_processed', 'errors']
  };

  // Create each tab with headers
  Object.keys(tabs).forEach(tabName => {
    const sheet = getOrCreateSheet(tabName);
    const headers = tabs[tabName];

    // Check if headers already exist
    const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const hasHeaders = existingHeaders.some(h => h !== '');

    if (!hasHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });

  // Add default config if Config tab is empty
  const configSheet = getOrCreateSheet('Config');
  if (configSheet.getLastRow() <= 1) {
    const defaultConfig = [
      ['market_value_multiplier', '1.1', 'Multiply assessed value by this for market estimate'],
      ['hot_threshold', '80', 'Propensity score >= this = HOT'],
      ['warm_threshold', '50', 'Propensity score >= this (and < hot) = WARM'],
      ['min_years_owned', '3', 'Only score properties owned at least this long'],
      ['min_equity', '30000', 'Only score properties with at least this much equity'],
      ['target_price_min', '200000', 'Ideal price range minimum'],
      ['target_price_max', '750000', 'Ideal price range maximum'],
      ['weight_years_owned', '0.25', 'Scoring weight for years owned'],
      ['weight_equity_gain', '0.25', 'Scoring weight for equity gain'],
      ['weight_neighborhood_turnover', '0.15', 'Scoring weight for neighborhood turnover'],
      ['weight_owner_occupied', '0.10', 'Scoring weight for owner occupied status'],
      ['weight_price_tier', '0.15', 'Scoring weight for price tier'],
      ['weight_home_age', '0.10', 'Scoring weight for home age'],
    ];

    defaultConfig.forEach(row => {
      configSheet.appendRow(row);
    });
  }

  return { tabs_created: Object.keys(tabs) };
}

/**
 * Menu for manual setup
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('TD Realty')
    .addItem('Setup All Tabs', 'setupTabs')
    .addItem('Test API', 'testApi')
    .addToUi();
}

/**
 * Test function
 */
function testApi() {
  const result = setupTabs();
  SpreadsheetApp.getUi().alert('Setup complete! Created tabs: ' + result.tabs_created.join(', '));
}
