"""
Court Monitoring Modules for TD Realty Seller Intelligence

Monitors various court systems for life events that indicate
homeowners may be motivated to sell:
- Divorce/dissolution filings
- Probate/estate cases
- Foreclosure filings
- Eviction cases (for investor properties)
"""

from scripts.courts.base_monitor import BaseCourtMonitor, LifeEvent
from scripts.courts.divorce_monitor import DivorceMonitor, run_divorce_monitor
from scripts.courts.probate_monitor import ProbateMonitor, run_probate_monitor
from scripts.courts.foreclosure_monitor import ForeclosureMonitor, run_foreclosure_monitor
from scripts.courts.eviction_monitor import EvictionMonitor, run_eviction_monitor

__all__ = [
    'BaseCourtMonitor',
    'LifeEvent',
    'DivorceMonitor',
    'ProbateMonitor',
    'ForeclosureMonitor',
    'EvictionMonitor',
    'run_divorce_monitor',
    'run_probate_monitor',
    'run_foreclosure_monitor',
    'run_eviction_monitor',
]
