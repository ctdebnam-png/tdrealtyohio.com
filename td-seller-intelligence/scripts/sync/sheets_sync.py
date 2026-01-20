"""
Google Sheets Sync Module for TD Realty Seller Intelligence

Connects to Google Sheets via a Google Apps Script Web App.
No service account keys needed - just deploy the Apps Script and use the URL.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    """Client for interacting with Google Sheets via Apps Script Web App."""

    def __init__(self, apps_script_url: Optional[str] = None, auth_token: Optional[str] = None):
        """
        Initialize the Sheets client.

        Args:
            apps_script_url: URL of the deployed Apps Script Web App.
                            Falls back to APPS_SCRIPT_URL env var.
            auth_token: Auth token configured in the Apps Script.
                       Falls back to APPS_SCRIPT_TOKEN env var.
        """
        self.apps_script_url = apps_script_url or os.getenv('APPS_SCRIPT_URL')
        self.auth_token = auth_token or os.getenv('APPS_SCRIPT_TOKEN')

        if not self.apps_script_url:
            raise ValueError("No Apps Script URL provided. Set APPS_SCRIPT_URL env var or pass apps_script_url.")
        if not self.auth_token:
            raise ValueError("No auth token provided. Set APPS_SCRIPT_TOKEN env var or pass auth_token.")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _call_api(self, action: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Call the Apps Script Web App API.

        Args:
            action: The action to perform.
            params: Parameters for the action.

        Returns:
            Response data from the API.
        """
        payload = {
            'token': self.auth_token,
            'action': action,
            'params': params or {}
        }

        try:
            response = requests.post(
                self.apps_script_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=120
            )
            response.raise_for_status()

            data = response.json()

            if 'error' in data:
                raise Exception(f"API error: {data['error']}")

            return data.get('data', {})

        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise

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

        Returns:
            Data from the sheet as list of dicts or list of lists.
        """
        result = self._call_api('read_sheet', {
            'tab_name': tab_name,
            'range': range_notation
        })

        if as_dicts:
            return result.get('rows', [])
        else:
            return result.get('raw', [])

    def write_sheet(
        self,
        tab_name: str,
        data: List[List[Any]],
        start_cell: str = "A1"
    ) -> int:
        """
        Write data to a sheet tab, overwriting existing content.

        Args:
            tab_name: Name of the tab to write to.
            data: List of lists representing rows.
            start_cell: Starting cell for write (default A1).

        Returns:
            Number of rows written.
        """
        if not data:
            logger.warning(f"No data to write to {tab_name}")
            return 0

        result = self._call_api('write_sheet', {
            'tab_name': tab_name,
            'data': data,
            'start_cell': start_cell
        })

        rows_written = result.get('rows_written', 0)
        logger.info(f"Wrote {rows_written} rows to {tab_name}")
        return rows_written

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
            return self.write_sheet(tab_name, [columns], start_cell)

        rows = [columns]  # Header row
        for item in data:
            row = []
            for col in columns:
                val = item.get(col, '')
                # Convert booleans to strings
                if isinstance(val, bool):
                    val = str(val)
                row.append(val)
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

        result = self._call_api('append_rows', {
            'tab_name': tab_name,
            'rows': rows
        })

        rows_appended = result.get('rows_appended', 0)
        logger.info(f"Appended {rows_appended} rows to {tab_name}")
        return rows_appended

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
        result = self._call_api('update_rows', {
            'tab_name': tab_name,
            'rows': rows,
            'key_column': key_column,
            'columns': columns
        })

        logger.info(f"Updated {result.get('updated', 0)}, inserted {result.get('inserted', 0)} rows in {tab_name}")
        return result

    def clear_sheet(self, tab_name: str, keep_header: bool = True) -> None:
        """
        Clear all data from a sheet tab.

        Args:
            tab_name: Name of the tab to clear.
            keep_header: If True, preserves the first row (header).
        """
        self._call_api('clear_sheet', {
            'tab_name': tab_name,
            'keep_header': keep_header
        })
        logger.info(f"Cleared {tab_name} (keep_header={keep_header})")

    def get_config(self) -> Dict[str, Any]:
        """
        Read configuration values from the Config tab.

        Returns:
            Dictionary of setting_name -> value.
        """
        return self._call_api('get_config')

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
        self._call_api('log_run', {
            'script_name': script_name,
            'status': status,
            'records': records_processed,
            'errors': errors
        })
        logger.info(f"Logged run: {script_name} - {status} ({records_processed} records)")

    def setup_tabs(self) -> Dict[str, Any]:
        """
        Initialize all required tabs with headers and default config.

        Returns:
            Dict with list of created tabs.
        """
        result = self._call_api('setup_tabs')
        logger.info(f"Setup complete: {result}")
        return result


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


def get_sheets_client() -> SheetsClient:
    """
    Get a configured SheetsClient using environment variables.

    Returns:
        Configured SheetsClient instance.
    """
    return SheetsClient()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--setup':
        print("Setting up spreadsheet tabs and default config...")
        client = get_sheets_client()
        result = client.setup_tabs()
        print(f"Setup complete! Created tabs: {result.get('tabs_created', [])}")
    else:
        print("Testing Google Sheets connection...")
        client = get_sheets_client()
        config = client.get_config()
        print(f"Connected! Config: {config}")
