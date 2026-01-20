/**
 * Market Stats Component
 * Loads and displays real estate market statistics from JSON data
 *
 * Usage: Add <div id="market-stats" data-area="westerville"></div> to page
 * The data-area attribute should match a key in market-stats.json
 */

(function() {
  'use strict';

  const STATS_URL = '/assets/data/market-stats.json';

  // Format currency
  function formatPrice(num) {
    if (num >= 1000000) {
      return '$' + (num / 1000000).toFixed(1) + 'M';
    }
    return '$' + Math.round(num / 1000) + 'K';
  }

  // Format full currency
  function formatFullPrice(num) {
    return '$' + num.toLocaleString('en-US');
  }

  // Format percentage change with arrow
  function formatChange(num) {
    const arrow = num >= 0 ? '↑' : '↓';
    const className = num >= 0 ? 'stat-up' : 'stat-down';
    return `<span class="${className}">${arrow} ${Math.abs(num).toFixed(1)}%</span>`;
  }

  // Get market condition badge
  function getConditionBadge(condition) {
    const badges = {
      'very-competitive': { text: "Hot Market", class: 'badge-competitive' },
      'competitive': { text: "Seller's Market", class: 'badge-competitive' },
      'balanced': { text: 'Balanced Market', class: 'badge-balanced' },
      'buyers-market': { text: "Buyer's Market", class: 'badge-buyer' },
      'buyer': { text: "Buyer's Market", class: 'badge-buyer' }
    };
    const badge = badges[condition] || badges['balanced'];
    return `<span class="market-badge ${badge.class}">${badge.text}</span>`;
  }

  // Render the stats component
  function renderStats(container, data, areaKey) {
    const area = data.areas[areaKey];
    const metro = data.metro;

    if (!area) {
      console.error('Area not found:', areaKey);
      container.innerHTML = '<p>Market data not available for this area.</p>';
      return;
    }

    const html = `
      <div class="market-stats-widget">
        <div class="market-stats-header">
          <div class="market-stats-title">
            <h2>${area.name} Market Snapshot</h2>
            <p class="stats-date">Data from ${data.reportMonth} | Source: <a href="${data.sourceUrl}" target="_blank" rel="noopener">Columbus REALTORS</a></p>
          </div>
          ${getConditionBadge(area.marketCondition)}
        </div>

        <div class="market-stats-grid">
          <div class="stat-card stat-card-primary">
            <div class="stat-card-label">Median Sale Price</div>
            <div class="stat-card-value">${formatFullPrice(area.medianPrice)}</div>
            <div class="stat-card-change">${formatChange(area.medianPriceChange)} vs last year</div>
          </div>

          <div class="stat-card">
            <div class="stat-card-label">Avg Days on Market</div>
            <div class="stat-card-value">${area.avgDaysOnMarket}</div>
            <div class="stat-card-sublabel">days</div>
          </div>

          <div class="stat-card">
            <div class="stat-card-label">Active Listings</div>
            <div class="stat-card-value">${area.activeListings}</div>
            <div class="stat-card-sublabel">homes for sale</div>
          </div>

          <div class="stat-card">
            <div class="stat-card-label">Homes Sold</div>
            <div class="stat-card-value">${area.closedSales}</div>
            <div class="stat-card-sublabel">last month</div>
          </div>
        </div>

        <div class="market-stats-insight">
          <div class="insight-content">
            <strong>Market Insight:</strong> ${area.notes}
          </div>
        </div>

        <div class="market-stats-compare">
          <h4>Compare to Central Ohio Overall</h4>
          <div class="compare-grid">
            <div class="compare-item">
              <span class="compare-label">Regional Median</span>
              <span class="compare-value">${formatFullPrice(metro.medianPrice)}</span>
            </div>
            <div class="compare-item">
              <span class="compare-label">Regional Days on Market</span>
              <span class="compare-value">${metro.avgDaysOnMarket} days</span>
            </div>
            <div class="compare-item">
              <span class="compare-label">Total Regional Inventory</span>
              <span class="compare-value">${metro.activeListings.toLocaleString()} homes</span>
            </div>
            <div class="compare-item">
              <span class="compare-label">Months of Supply</span>
              <span class="compare-value">${metro.monthsOfInventory}</span>
            </div>
          </div>
        </div>

        <div class="market-stats-cta">
          <p>Want to know what your home is worth in this market?</p>
          <a href="/home-value.html" class="btn btn-primary">Get a Free Home Valuation</a>
        </div>

        <div class="market-stats-footer">
          <p>For detailed market reports, visit <a href="https://marketstatsreports.showingtime.com/CR/sst/2025-12/main.htm" target="_blank" rel="noopener">ShowingTime Market Stats</a> or <a href="${data.sourceUrl}" target="_blank" rel="noopener">Columbus REALTORS Housing Reports</a>.</p>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // Initialize
  function init() {
    const container = document.getElementById('market-stats');
    if (!container) return;

    const areaKey = container.dataset.area;
    if (!areaKey) {
      console.error('No data-area attribute specified');
      return;
    }

    // Show loading state
    container.innerHTML = '<div class="market-stats-loading">Loading market data...</div>';

    // Fetch and render
    fetch(STATS_URL)
      .then(response => {
        if (!response.ok) throw new Error('Failed to load market data');
        return response.json();
      })
      .then(data => renderStats(container, data, areaKey))
      .catch(error => {
        console.error('Error loading market stats:', error);
        container.innerHTML = `
          <div class="market-stats-error">
            <p>Unable to load market data. Please check back later.</p>
            <p><a href="https://columbusrealtors.com/housing-reports" target="_blank" rel="noopener">View housing reports on Columbus REALTORS</a></p>
          </div>
        `;
      });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
