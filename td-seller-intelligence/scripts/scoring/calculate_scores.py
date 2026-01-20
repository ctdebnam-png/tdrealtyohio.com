"""
Propensity-to-Sell Scoring Engine for TD Realty

Calculates two scores for each property:
1. Propensity Score (0-100): How likely is this owner to sell in the next 12 months?
2. TD Fit Score (0-100): How well does this property match TD Realty's ideal customer?

Scoring weights and thresholds are read from the Config tab in Google Sheets.
"""

import os
import sys
import logging
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.utils import (
    get_neighborhood_type,
    parse_date,
    calculate_years_owned,
)
from scripts.sheets_sync import (
    SheetsClient,
    get_sheets_client,
    MASTER_PROPERTIES_COLUMNS,
    NEIGHBORHOOD_STATS_COLUMNS,
    TAB_MASTER_PROPERTIES,
    TAB_HOT_LEADS,
    TAB_WARM_LEADS,
    TAB_NEIGHBORHOOD_STATS,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ScoringEngine:
    """Engine for calculating propensity and fit scores."""

    # Default configuration (overridden by Sheets Config tab)
    DEFAULT_CONFIG = {
        'market_value_multiplier': 1.1,
        'hot_threshold': 80,
        'warm_threshold': 50,
        'min_years_owned': 3,
        'min_equity': 30000,
        'target_price_min': 200000,
        'target_price_max': 750000,
        'weight_years_owned': 0.25,
        'weight_equity_gain': 0.25,
        'weight_neighborhood_turnover': 0.15,
        'weight_owner_occupied': 0.10,
        'weight_price_tier': 0.15,
        'weight_home_age': 0.10,
    }

    def __init__(self, sheets_client: Optional[SheetsClient] = None):
        """
        Initialize the scoring engine.

        Args:
            sheets_client: Optional pre-configured SheetsClient.
        """
        self.sheets_client = sheets_client
        self.config = self.DEFAULT_CONFIG.copy()
        self.neighborhood_stats = {}  # ZIP -> stats
        self.errors = []

    def load_config(self) -> None:
        """Load configuration from Google Sheets."""
        if self.sheets_client:
            try:
                sheets_config = self.sheets_client.get_config()
                # Only update values that exist in sheets
                for key in self.DEFAULT_CONFIG:
                    if key in sheets_config:
                        self.config[key] = sheets_config[key]
                logger.info(f"Loaded config from Sheets: {self.config}")
            except Exception as e:
                logger.warning(f"Could not load config from Sheets, using defaults: {e}")

    def calculate_years_owned_score(self, years_owned: float) -> int:
        """
        Calculate score based on years of ownership.

        The "sweet spot" is 5-10 years when owners are most likely to move.
        Very recent buyers (0-2 years) are unlikely to sell.
        Long-term owners (20+ years) may be more settled.

        Args:
            years_owned: Number of years the property has been owned.

        Returns:
            Score from 0-100.
        """
        if years_owned < 0:
            return 0
        elif years_owned < 2:
            return 10  # Just bought, unlikely to move
        elif years_owned < 4:
            return 40
        elif years_owned < 7:
            return 80  # Prime moving window
        elif years_owned < 10:
            return 100  # Very likely to move
        elif years_owned < 15:
            return 70
        elif years_owned < 20:
            return 50
        else:
            return 40  # Very settled, less likely

    def calculate_equity_gain_score(self, equity_gain_pct: float) -> int:
        """
        Calculate score based on equity gain percentage.

        Homeowners with significant equity gains are motivated sellers.
        Those with very high gains (>100%) might be waiting for more.

        Args:
            equity_gain_pct: Percentage equity gain since purchase.

        Returns:
            Score from 0-100.
        """
        if equity_gain_pct < 0:
            return 10  # Underwater or break-even
        elif equity_gain_pct < 10:
            return 10
        elif equity_gain_pct < 25:
            return 40
        elif equity_gain_pct < 50:
            return 70
        elif equity_gain_pct <= 100:
            return 100  # Significant gains
        else:
            return 85  # Might be holding for more gains

    def calculate_neighborhood_turnover_score(self, zip_code: str) -> int:
        """
        Calculate score based on neighborhood turnover rate.

        Higher turnover indicates an active market where selling is common.

        Args:
            zip_code: Property ZIP code.

        Returns:
            Score from 0-100.
        """
        if zip_code not in self.neighborhood_stats:
            return 50  # Default for unknown neighborhoods

        turnover_rate = self.neighborhood_stats[zip_code].get('turnover_rate_12mo', 5.0)

        if turnover_rate < 3:
            return 30  # Stable neighborhood, low turnover
        elif turnover_rate < 5:
            return 50
        elif turnover_rate < 8:
            return 75
        elif turnover_rate <= 12:
            return 100  # High turnover area
        else:
            return 90  # Very high turnover (might be concerning)

    def calculate_owner_occupied_score(self, is_owner_occupied: bool) -> int:
        """
        Calculate score based on owner-occupied status.

        Investors (non-owner occupied) are generally more likely to sell.
        Owner-occupied properties are the primary target customer though.

        Args:
            is_owner_occupied: True if owner lives at property.

        Returns:
            Score from 0-100.
        """
        return 70 if is_owner_occupied else 90

    def calculate_price_tier_score(self, market_value: float) -> int:
        """
        Calculate score based on price tier alignment with target market.

        Properties within TD Realty's ideal price range score highest.

        Args:
            market_value: Estimated market value.

        Returns:
            Score from 0-100.
        """
        target_min = self.config.get('target_price_min', 200000)
        target_max = self.config.get('target_price_max', 750000)

        if market_value < target_min:
            return 50  # Below target range
        elif market_value <= target_max:
            return 100  # In target range
        else:
            return 60  # Above target range (still good, higher commission savings)

    def calculate_home_age_score(self, year_built: Optional[int]) -> int:
        """
        Calculate score based on home age.

        Mid-age homes (15-30 years) often need updates, motivating sales.
        Very new homes are less likely to sell; very old ones depend on condition.

        Args:
            year_built: Year the home was built.

        Returns:
            Score from 0-100.
        """
        if not year_built or year_built <= 0:
            return 50  # Unknown

        current_year = datetime.now().year
        age = current_year - year_built

        if age < 5:
            return 40  # Very new, unlikely to sell
        elif age < 15:
            return 70
        elif age < 30:
            return 90  # Sweet spot - may need updates
        elif age < 50:
            return 80
        else:
            return 60  # Very old, depends on condition/updates

    def calculate_propensity_score(self, property_data: Dict[str, Any]) -> int:
        """
        Calculate the overall propensity-to-sell score.

        Combines multiple factors using weighted scoring.

        Args:
            property_data: Property record dictionary.

        Returns:
            Propensity score from 0-100.
        """
        # Get individual component scores
        years_owned_score = self.calculate_years_owned_score(
            float(property_data.get('years_owned', 0) or 0)
        )

        equity_gain_score = self.calculate_equity_gain_score(
            float(property_data.get('equity_gain_pct', 0) or 0)
        )

        turnover_score = self.calculate_neighborhood_turnover_score(
            str(property_data.get('zip', ''))
        )

        # Handle boolean string from sheets
        is_owner_occupied = property_data.get('is_owner_occupied')
        if isinstance(is_owner_occupied, str):
            is_owner_occupied = is_owner_occupied.lower() == 'true'
        owner_occupied_score = self.calculate_owner_occupied_score(bool(is_owner_occupied))

        price_tier_score = self.calculate_price_tier_score(
            float(property_data.get('estimated_market_value', 0) or 0)
        )

        home_age_score = self.calculate_home_age_score(
            int(property_data.get('year_built', 0) or 0) if property_data.get('year_built') else None
        )

        # Calculate weighted score
        score = (
            years_owned_score * self.config['weight_years_owned'] +
            equity_gain_score * self.config['weight_equity_gain'] +
            turnover_score * self.config['weight_neighborhood_turnover'] +
            owner_occupied_score * self.config['weight_owner_occupied'] +
            price_tier_score * self.config['weight_price_tier'] +
            home_age_score * self.config['weight_home_age']
        )

        return min(100, max(0, round(score)))

    def calculate_td_fit_score(self, property_data: Dict[str, Any]) -> int:
        """
        Calculate how well the property fits TD Realty's ideal customer profile.

        TD Realty offers 1% commission (vs traditional 3%), so high-equity
        homeowners in the target price range save the most.

        Args:
            property_data: Property record dictionary.

        Returns:
            TD Fit score from 0-100.
        """
        scores = []
        weights = []

        # Price Tier Fit (25% weight)
        price_score = self.calculate_price_tier_score(
            float(property_data.get('estimated_market_value', 0) or 0)
        )
        scores.append(price_score)
        weights.append(0.25)

        # Equity Position (35% weight) - Higher equity = more savings with 1% commission
        equity = float(property_data.get('estimated_equity', 0) or 0)
        if equity < 50000:
            equity_fit = 40
        elif equity < 100000:
            equity_fit = 70
        elif equity < 200000:
            equity_fit = 90
        else:
            equity_fit = 100  # Maximum savings potential
        scores.append(equity_fit)
        weights.append(0.35)

        # Owner Occupied (20% weight) - Primary customers are homeowners
        is_owner_occupied = property_data.get('is_owner_occupied')
        if isinstance(is_owner_occupied, str):
            is_owner_occupied = is_owner_occupied.lower() == 'true'
        owner_fit = 100 if is_owner_occupied else 60
        scores.append(owner_fit)
        weights.append(0.20)

        # Neighborhood/Service Area (20% weight)
        zip_code = str(property_data.get('zip', ''))
        neighborhood_type = get_neighborhood_type(zip_code)
        if neighborhood_type == 'primary':
            neighborhood_fit = 100  # In primary service area
        elif neighborhood_type == 'adjacent':
            neighborhood_fit = 70  # Adjacent areas
        else:
            neighborhood_fit = 40  # Outside primary service area
        scores.append(neighborhood_fit)
        weights.append(0.20)

        # Calculate weighted average
        total_score = sum(s * w for s, w in zip(scores, weights))
        return min(100, max(0, round(total_score)))

    def determine_priority_tier(self, propensity_score: int) -> str:
        """
        Determine priority tier based on propensity score.

        Args:
            propensity_score: Calculated propensity score.

        Returns:
            Priority tier: "HOT", "WARM", or "COLD".
        """
        hot_threshold = self.config.get('hot_threshold', 80)
        warm_threshold = self.config.get('warm_threshold', 50)

        if propensity_score >= hot_threshold:
            return "HOT"
        elif propensity_score >= warm_threshold:
            return "WARM"
        else:
            return "COLD"

    def calculate_neighborhood_stats(self, properties: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Calculate aggregate statistics by neighborhood/ZIP.

        Args:
            properties: List of property records.

        Returns:
            Dictionary of ZIP -> stats.
        """
        stats_by_zip = defaultdict(lambda: {
            'total_properties': 0,
            'years_owned_sum': 0,
            'equity_sum': 0,
            'propensity_score_sum': 0,
            'hot_count': 0,
            'warm_count': 0,
            'recent_sales': 0,  # Sales in last 12 months
        })

        current_date = date.today()

        for prop in properties:
            zip_code = str(prop.get('zip', ''))
            if not zip_code:
                continue

            stats = stats_by_zip[zip_code]
            stats['total_properties'] += 1
            stats['years_owned_sum'] += float(prop.get('years_owned', 0) or 0)
            stats['equity_sum'] += float(prop.get('estimated_equity', 0) or 0)

            propensity = prop.get('propensity_score')
            if propensity:
                stats['propensity_score_sum'] += int(propensity)

            tier = prop.get('priority_tier', '')
            if tier == 'HOT':
                stats['hot_count'] += 1
            elif tier == 'WARM':
                stats['warm_count'] += 1

            # Check for recent sale (within 12 months)
            purchase_date = prop.get('purchase_date')
            if purchase_date:
                if isinstance(purchase_date, str):
                    purchase_date = parse_date(purchase_date)
                if purchase_date:
                    days_since_purchase = (current_date - purchase_date).days
                    if days_since_purchase <= 365:
                        stats['recent_sales'] += 1

        # Calculate averages and turnover rates
        result = {}
        for zip_code, stats in stats_by_zip.items():
            total = stats['total_properties']
            if total > 0:
                result[zip_code] = {
                    'neighborhood': zip_code,  # Could be enhanced with neighborhood names
                    'total_properties': total,
                    'avg_years_owned': round(stats['years_owned_sum'] / total, 2),
                    'avg_equity': round(stats['equity_sum'] / total, 2),
                    'avg_propensity_score': round(stats['propensity_score_sum'] / total, 2) if stats['propensity_score_sum'] else 0,
                    'hot_lead_count': stats['hot_count'],
                    'warm_lead_count': stats['warm_count'],
                    'turnover_rate_12mo': round((stats['recent_sales'] / total) * 100, 2),
                    'last_updated': datetime.now().isoformat(),
                }

        return result

    def score_properties(self, properties: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Score a list of properties.

        Args:
            properties: List of property records.

        Returns:
            List of scored property records.
        """
        scored = []

        for prop in properties:
            try:
                # Check minimum requirements
                years_owned = float(prop.get('years_owned', 0) or 0)
                equity = float(prop.get('estimated_equity', 0) or 0)

                min_years = self.config.get('min_years_owned', 3)
                min_equity = self.config.get('min_equity', 30000)

                # Calculate scores (even for properties below minimums for data completeness)
                propensity_score = self.calculate_propensity_score(prop)
                td_fit_score = self.calculate_td_fit_score(prop)
                priority_tier = self.determine_priority_tier(propensity_score)

                # For properties below minimums, cap their tier at COLD
                if years_owned < min_years or equity < min_equity:
                    priority_tier = "COLD"

                # Update property record
                prop['propensity_score'] = propensity_score
                prop['td_fit_score'] = td_fit_score
                prop['priority_tier'] = priority_tier
                prop['last_updated'] = datetime.now().isoformat()

                scored.append(prop)

            except Exception as e:
                logger.warning(f"Failed to score property {prop.get('parcel_id')}: {e}")
                self.errors.append(f"Scoring failed for {prop.get('parcel_id')}: {e}")
                continue

        return scored

    def run(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Run the full scoring process.

        Args:
            dry_run: If True, don't write to Sheets, just log.

        Returns:
            Summary of the run.
        """
        start_time = datetime.now()
        logger.info("Starting propensity scoring...")

        # Initialize Sheets client if not provided
        if not self.sheets_client and not dry_run:
            self.sheets_client = get_sheets_client()

        # Load configuration
        self.load_config()

        # Read all properties from Master Properties tab
        logger.info("Loading properties from Master Properties...")
        if self.sheets_client:
            properties = self.sheets_client.read_sheet(TAB_MASTER_PROPERTIES, as_dicts=True)
        else:
            properties = []
            logger.warning("No Sheets client available, using empty property list")

        logger.info(f"Loaded {len(properties)} properties")

        if not properties:
            logger.warning("No properties to score")
            return {'status': 'success', 'records_processed': 0}

        # First pass: Calculate neighborhood stats for turnover scoring
        logger.info("Calculating initial neighborhood statistics...")
        self.neighborhood_stats = self.calculate_neighborhood_stats(properties)

        # Score all properties
        logger.info("Scoring properties...")
        scored_properties = self.score_properties(properties)

        # Recalculate neighborhood stats with scores
        logger.info("Recalculating neighborhood statistics with scores...")
        self.neighborhood_stats = self.calculate_neighborhood_stats(scored_properties)

        # Separate into tiers
        hot_leads = [p for p in scored_properties if p.get('priority_tier') == 'HOT']
        warm_leads = [p for p in scored_properties if p.get('priority_tier') == 'WARM']

        logger.info(f"Scoring complete: {len(hot_leads)} HOT, {len(warm_leads)} WARM, "
                   f"{len(scored_properties) - len(hot_leads) - len(warm_leads)} COLD")

        # Write results to Sheets
        if not dry_run and self.sheets_client:
            try:
                # Update Master Properties with scores
                logger.info("Updating Master Properties...")
                self.sheets_client.update_rows(
                    TAB_MASTER_PROPERTIES,
                    scored_properties,
                    'parcel_id',
                    MASTER_PROPERTIES_COLUMNS
                )

                # Write Hot Leads (sorted by propensity score descending)
                logger.info("Writing Hot Leads...")
                hot_sorted = sorted(hot_leads, key=lambda x: x.get('propensity_score', 0), reverse=True)
                self.sheets_client.clear_sheet(TAB_HOT_LEADS)
                self.sheets_client.write_sheet_from_dicts(
                    TAB_HOT_LEADS,
                    hot_sorted,
                    MASTER_PROPERTIES_COLUMNS
                )

                # Write Warm Leads (sorted by propensity score descending)
                logger.info("Writing Warm Leads...")
                warm_sorted = sorted(warm_leads, key=lambda x: x.get('propensity_score', 0), reverse=True)
                self.sheets_client.clear_sheet(TAB_WARM_LEADS)
                self.sheets_client.write_sheet_from_dicts(
                    TAB_WARM_LEADS,
                    warm_sorted,
                    MASTER_PROPERTIES_COLUMNS
                )

                # Write Neighborhood Stats
                logger.info("Writing Neighborhood Stats...")
                stats_list = list(self.neighborhood_stats.values())
                self.sheets_client.clear_sheet(TAB_NEIGHBORHOOD_STATS)
                self.sheets_client.write_sheet_from_dicts(
                    TAB_NEIGHBORHOOD_STATS,
                    stats_list,
                    NEIGHBORHOOD_STATS_COLUMNS
                )

                logger.info("Sheets update complete")

            except Exception as e:
                error_msg = f"Failed to write to Sheets: {e}"
                logger.error(error_msg)
                self.errors.append(error_msg)

        # Log the run
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        status = 'success' if not self.errors else 'partial'
        error_summary = '; '.join(self.errors[:5])

        if self.sheets_client and not dry_run:
            self.sheets_client.log_run(
                'calculate_scores.py',
                status,
                len(scored_properties),
                error_summary
            )

        summary = {
            'status': status,
            'records_processed': len(scored_properties),
            'hot_leads': len(hot_leads),
            'warm_leads': len(warm_leads),
            'neighborhoods': len(self.neighborhood_stats),
            'duration_seconds': duration,
            'errors': self.errors,
        }

        logger.info(f"Scoring run complete: {summary}")
        return summary


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Calculate propensity-to-sell scores')
    parser.add_argument('--dry-run', action='store_true', help='Run without writing to Sheets')
    parser.add_argument('--full-refresh', action='store_true', help='Recalculate all scores (ignore cached)')
    args = parser.parse_args()

    engine = ScoringEngine()
    result = engine.run(dry_run=args.dry_run)

    # Exit with error code if failed
    if result['status'] == 'error':
        sys.exit(1)


if __name__ == '__main__':
    main()
