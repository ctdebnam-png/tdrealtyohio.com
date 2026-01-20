"""
Google Sheets Sync Module for TD Realty Seller Intelligence

Provides reusable functions for reading/writing data to Google Sheets
using a service account for authentication.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Google Sheets API scopes
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# Tab names as constants
TAB_MASTER_PROPERTIES = "Master Properties"
TAB_HOT_LEADS = "Hot Leads"
TAB_WARM_LEADS = "Warm Leads"
TAB_INBOUND_LEADS = "Inbound Leads"
TAB_ENRICHED_LEADS = "Enriched Leads"
TAB_NEIGHBORHOOD_STATS = "Neighborhood Stats"
TAB_CONFIG = "Config"
TAB_RUN_LOG = "Run Log"


class SheetsClient:
    """Client for interacting with Google Sheets."""

    def __init__(self, credentials_json: Optional[str] = None, spreadsheet_id: Optional[str] = None):
        """
        Initialize the Sheets client.

        Args:
            credentials_json: JSON string of service account credentials.
                             Falls back to GOOGLE_SHEETS_CREDENTIALS env var.
            spreadsheet_id: The Google Sheets document ID.
                           Falls back to SPREADSHEET_ID env var.
        """
        self.credentials_json = credentials_json or os.getenv('GOOGLE_SHEETS_CREDENTIALS')
        self.spreadsheet_id = spreadsheet_id or os.getenv('SPREADSHEET_ID')
        self._client = None
        self._spreadsheet = None

        if not self.credentials_json:
            raise ValueError("No credentials provided. Set GOOGLE_SHEETS_CREDENTIALS env var or pass credentials_json.")
        if not self.spreadsheet_id:
            raise ValueError("No spreadsheet ID provided. Set SPREADSHEET_ID env var or pass spreadsheet_id.")

    def authenticate(self) -> gspread.Client:
        """
        Authenticate with Google Sheets using service account credentials.

        Returns:
            Authenticated gspread client.
        """
        if self._client:
            return self._client

        try:
            # Parse credentials from JSON string
            creds_dict = json.loads(self.credentials_json)
            credentials = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            self._client = gspread.authorize(credentials)
            logger.info("Successfully authenticated with Google Sheets")
            return self._client
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse credentials JSON: {e}")
            raise
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            raise

    def get_spreadsheet(self) -> gspread.Spreadsheet:
        """
        Get the spreadsheet object.

        Returns:
            gspread Spreadsheet object.
        """
        if self._spreadsheet:
            return self._spreadsheet

        client = self.authenticate()
        self._spreadsheet = client.open_by_key(self.spreadsheet_id)
        logger.info(f"Opened spreadsheet: {self._spreadsheet.title}")
        return self._spreadsheet

    def get_worksheet(self, tab_name: str) -> gspread.Worksheet:
        """
        Get a worksheet by name, creating it if it doesn't exist.

        Args:
            tab_name: Name of the tab/worksheet.

        Returns:
            gspread Worksheet object.
        """
        spreadsheet = self.get_spreadsheet()
        try:
            worksheet = spreadsheet.worksheet(tab_name)
        except gspread.WorksheetNotFound:
            logger.info(f"Creating new worksheet: {tab_name}")
            worksheet = spreadsheet.add_worksheet(title=tab_name, rows=1000, cols=30)
        return worksheet

    def read_sheet(
        self,
        tab_name: str,
        range_notation: Optional[str] = None,
        as_dicts: bool = True
    ) -> List[Dict[str, Any]] | List[List[Any]]:
        """
        Read data from a sheet tab.

        Args:
            tab_name: Name of the tab to read from.
            range_notation: Optional A1 notation range (e.g., "A1:D10").
            as_dicts: If True, return list of dicts with header row as keys.
                     If False, return list of lists.

        Returns:
            Data from the sheet as list of dicts or list of lists.
        """
        worksheet = self.get_worksheet(tab_name)

        if range_notation:
            data = worksheet.get(range_notation)
        else:
            data = worksheet.get_all_values()

        if not data:
            return []

        if as_dicts and len(data) > 1:
            headers = data[0]
            return [dict(zip(headers, row + [''] * (len(headers) - len(row)))) for row in data[1:]]

        return data

    def write_sheet(
        self,
        tab_name: str,
        data: List[List[Any]],
        start_cell: str = "A1",
        include_header: bool = True
    ) -> int:
        """
        Write data to a sheet tab, overwriting existing content.

        Args:
            tab_name: Name of the tab to write to.
            data: List of lists representing rows.
            start_cell: Starting cell for write (default A1).
            include_header: If True, first row is treated as header.

        Returns:
            Number of rows written.
        """
        if not data:
            logger.warning(f"No data to write to {tab_name}")
            return 0

        worksheet = self.get_worksheet(tab_name)

        # Expand worksheet if needed
        num_rows = len(data)
        num_cols = max(len(row) for row in data) if data else 0

        if worksheet.row_count < num_rows:
            worksheet.add_rows(num_rows - worksheet.row_count + 100)
        if worksheet.col_count < num_cols:
            worksheet.add_cols(num_cols - worksheet.col_count + 5)

        worksheet.update(start_cell, data)
        logger.info(f"Wrote {num_rows} rows to {tab_name}")
        return num_rows

    def write_sheet_from_dicts(
        self,
        tab_name: str,
        data: List[Dict[str, Any]],
        columns: List[str],
        start_cell: str = "A1"
    ) -> int:
        """
        Write data from list of dicts to a sheet.

        Args:
            tab_name: Name of the tab to write to.
            data: List of dictionaries.
            columns: Ordered list of column names (also used as header).
            start_cell: Starting cell for write.

        Returns:
            Number of rows written (including header).
        """
        if not data:
            # Still write header
            return self.write_sheet(tab_name, [columns], start_cell)

        rows = [columns]  # Header row
        for item in data:
            row = [item.get(col, '') for col in columns]
            rows.append(row)

        return self.write_sheet(tab_name, rows, start_cell)

    def append_rows(self, tab_name: str, rows: List[List[Any]]) -> int:
        """
        Append rows to the end of a sheet tab.

        Args:
            tab_name: Name of the tab.
            rows: List of lists representing rows to append.

        Returns:
            Number of rows appended.
        """
        if not rows:
            return 0

        worksheet = self.get_worksheet(tab_name)
        worksheet.append_rows(rows, value_input_option='USER_ENTERED')
        logger.info(f"Appended {len(rows)} rows to {tab_name}")
        return len(rows)

    def update_rows(
        self,
        tab_name: str,
        rows: List[Dict[str, Any]],
        key_column: str,
        columns: List[str]
    ) -> Dict[str, int]:
        """
        Update existing rows by matching on a key column.

        Args:
            tab_name: Name of the tab.
            rows: List of dicts with data to update.
            key_column: Column name to match on (e.g., "parcel_id").
            columns: Ordered list of all columns.

        Returns:
            Dict with 'updated' and 'inserted' counts.
        """
        worksheet = self.get_worksheet(tab_name)
        existing_data = self.read_sheet(tab_name, as_dicts=True)

        # Create lookup of existing rows by key
        existing_by_key = {}
        for i, row in enumerate(existing_data):
            key = row.get(key_column)
            if key:
                existing_by_key[key] = i + 2  # +2 for header row and 1-based index

        updates = []
        inserts = []

        for row in rows:
            key = row.get(key_column)
            if key in existing_by_key:
                row_num = existing_by_key[key]
                row_data = [row.get(col, '') for col in columns]
                updates.append({
                    'range': f'A{row_num}:{chr(64 + len(columns))}{row_num}',
                    'values': [row_data]
                })
            else:
                inserts.append([row.get(col, '') for col in columns])

        # Perform batch update
        if updates:
            worksheet.batch_update(updates)
            logger.info(f"Updated {len(updates)} rows in {tab_name}")

        # Append new rows
        if inserts:
            self.append_rows(tab_name, inserts)
            logger.info(f"Inserted {len(inserts)} new rows in {tab_name}")

        return {'updated': len(updates), 'inserted': len(inserts)}

    def clear_sheet(self, tab_name: str, keep_header: bool = True) -> None:
        """
        Clear all data from a sheet tab.

        Args:
            tab_name: Name of the tab to clear.
            keep_header: If True, preserves the first row (header).
        """
        worksheet = self.get_worksheet(tab_name)

        if keep_header:
            # Get header, clear all, write header back
            header = worksheet.row_values(1)
            worksheet.clear()
            if header:
                worksheet.update('A1', [header])
            logger.info(f"Cleared {tab_name} (kept header)")
        else:
            worksheet.clear()
            logger.info(f"Cleared {tab_name} completely")

    def batch_update(self, updates: List[Dict[str, Any]]) -> None:
        """
        Perform multiple updates efficiently in a single API call.

        Args:
            updates: List of update specifications, each containing:
                     - tab_name: Name of the tab
                     - range: A1 notation range
                     - values: Data to write
        """
        spreadsheet = self.get_spreadsheet()

        batch_data = []
        for update in updates:
            worksheet = self.get_worksheet(update['tab_name'])
            batch_data.append({
                'range': f"'{update['tab_name']}'!{update['range']}",
                'values': update['values']
            })

        spreadsheet.values_batch_update(body={
            'valueInputOption': 'USER_ENTERED',
            'data': batch_data
        })
        logger.info(f"Performed batch update with {len(updates)} operations")

    def get_config(self) -> Dict[str, Any]:
        """
        Read configuration values from the Config tab.

        Returns:
            Dictionary of setting_name -> value.
        """
        config_data = self.read_sheet(TAB_CONFIG, as_dicts=True)
        config = {}

        for row in config_data:
            name = row.get('setting_name', '')
            value = row.get('value', '')

            # Try to convert numeric values
            if name:
                try:
                    if '.' in str(value):
                        config[name] = float(value)
                    else:
                        config[name] = int(value)
                except (ValueError, TypeError):
                    config[name] = value

        return config

    def log_run(
        self,
        script_name: str,
        status: str,
        records_processed: int,
        errors: str = ""
    ) -> None:
        """
        Log a script run to the Run Log tab.

        Args:
            script_name: Name of the script that ran.
            status: Status of the run ("success", "error", "partial").
            records_processed: Number of records processed.
            errors: Any error messages.
        """
        timestamp = datetime.now().isoformat()
        row = [timestamp, script_name, status, records_processed, errors]
        self.append_rows(TAB_RUN_LOG, [row])
        logger.info(f"Logged run: {script_name} - {status} ({records_processed} records)")


# Column definitions for each tab
MASTER_PROPERTIES_COLUMNS = [
    'parcel_id', 'address', 'city', 'zip', 'county', 'neighborhood',
    'owner_name', 'owner_mailing_address', 'is_owner_occupied',
    'purchase_date', 'purchase_price', 'years_owned',
    'assessed_value', 'estimated_market_value', 'estimated_equity', 'equity_gain_pct',
    'beds', 'baths', 'sqft', 'year_built', 'property_class',
    'propensity_score', 'td_fit_score', 'priority_tier', 'last_updated'
]

INBOUND_LEADS_COLUMNS = [
    'timestamp', 'source', 'name', 'email', 'phone',
    'address_entered', 'matched_parcel_id', 'enrichment_status'
]

ENRICHED_LEADS_COLUMNS = INBOUND_LEADS_COLUMNS + MASTER_PROPERTIES_COLUMNS

NEIGHBORHOOD_STATS_COLUMNS = [
    'neighborhood', 'total_properties', 'avg_years_owned', 'avg_equity',
    'avg_propensity_score', 'hot_lead_count', 'warm_lead_count',
    'turnover_rate_12mo', 'last_updated'
]

CONFIG_COLUMNS = ['setting_name', 'value', 'description']

RUN_LOG_COLUMNS = ['timestamp', 'script_name', 'status', 'records_processed', 'errors']


def setup_spreadsheet_tabs(client: SheetsClient) -> None:
    """
    Initialize all required tabs with headers.

    Args:
        client: Authenticated SheetsClient instance.
    """
    tabs_config = [
        (TAB_MASTER_PROPERTIES, MASTER_PROPERTIES_COLUMNS),
        (TAB_HOT_LEADS, MASTER_PROPERTIES_COLUMNS),
        (TAB_WARM_LEADS, MASTER_PROPERTIES_COLUMNS),
        (TAB_INBOUND_LEADS, INBOUND_LEADS_COLUMNS),
        (TAB_ENRICHED_LEADS, ENRICHED_LEADS_COLUMNS),
        (TAB_NEIGHBORHOOD_STATS, NEIGHBORHOOD_STATS_COLUMNS),
        (TAB_CONFIG, CONFIG_COLUMNS),
        (TAB_RUN_LOG, RUN_LOG_COLUMNS),
    ]

    for tab_name, columns in tabs_config:
        worksheet = client.get_worksheet(tab_name)
        existing = worksheet.row_values(1)
        if not existing:
            worksheet.update('A1', [columns])
            logger.info(f"Initialized headers for {tab_name}")


def setup_default_config(client: SheetsClient) -> None:
    """
    Initialize the Config tab with default values.

    Args:
        client: Authenticated SheetsClient instance.
    """
    default_config = [
        ['setting_name', 'value', 'description'],
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
    ]

    client.write_sheet(TAB_CONFIG, default_config)
    logger.info("Initialized default configuration")


# Convenience function for quick operations
def get_sheets_client() -> SheetsClient:
    """
    Get a configured SheetsClient using environment variables.

    Returns:
        Authenticated SheetsClient instance.
    """
    return SheetsClient()


if __name__ == "__main__":
    # Test connection and setup
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--setup':
        print("Setting up spreadsheet tabs and default config...")
        client = get_sheets_client()
        setup_spreadsheet_tabs(client)
        setup_default_config(client)
        print("Setup complete!")
    else:
        print("Testing Google Sheets connection...")
        client = get_sheets_client()
        spreadsheet = client.get_spreadsheet()
        print(f"Connected to: {spreadsheet.title}")
        print(f"Available tabs: {[ws.title for ws in spreadsheet.worksheets()]}")
