/**
 * TD Realty Ohio - First-Time Buyer Credit Calculator
 *
 * Interactive tool that shows first-time buyers how much
 * cash back they'll receive at closing (1% of purchase price).
 *
 * Usage: Add <div id="td-buyer-calculator"></div> to any page
 */

(function() {
  'use strict';

  // Wait for config to be available
  if (typeof window.TD_REALTY === 'undefined') {
    console.error('TD_REALTY config not loaded');
    return;
  }

  const TD = window.TD_REALTY;

  function createCalculator() {
    const container = document.getElementById('td-buyer-calculator');
    if (!container) return;

    const html = `
      <div class="td-calc">
        <div class="td-calc__header">
          <h3 class="td-h3">First-Time Buyer Cash Back Calculator</h3>
          <p class="td-p">See how much you'll receive at closing</p>
        </div>

        <div class="td-calc__inputs">
          <div class="td-calc__input-group">
            <label for="td-purchase-price">Purchase Price</label>
            <input
              type="text"
              id="td-purchase-price"
              value="300,000"
              class="td-calc__input"
            />
          </div>
        </div>

        <div class="td-calc__results">
          <div class="td-calc__result-row">
            <div class="td-calc__result-label">Typical 3% Buyer Commission</div>
            <div class="td-calc__result-value" id="td-total-commission">$9,000</div>
          </div>

          <div class="td-calc__result-row td-calc__result-row--highlight">
            <div class="td-calc__result-label">
              <strong>Your 1% Cash Back at Closing</strong>
            </div>
            <div class="td-calc__result-value td-calc__result-value--highlight" id="td-cash-back">$3,000</div>
          </div>

          <div class="td-calc__result-row">
            <div class="td-calc__result-label">Agent Keeps</div>
            <div class="td-calc__result-value" id="td-agent-keeps">$6,000</div>
          </div>
        </div>

        <div class="td-calc__footer">
          <div class="td-calc__example">
            <p class="td-calc__note">
              <strong>How it works:</strong> ${TD.buyer.firstTime.example.explanation}
            </p>
          </div>
          <div class="td-calc__cta">
            <a href="/contact/" class="td-btn td-btn--primary">Talk to Us About Buying</a>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Get elements
    const purchasePriceInput = document.getElementById('td-purchase-price');
    const totalCommissionEl = document.getElementById('td-total-commission');
    const cashBackEl = document.getElementById('td-cash-back');
    const agentKeepsEl = document.getElementById('td-agent-keeps');

    // Format number with commas as user types
    function formatNumberInput(input) {
      let value = input.value.replace(/[^0-9]/g, '');
      if (value) {
        value = parseInt(value).toLocaleString('en-US');
      }
      input.value = value;
    }

    // Calculate and update results
    function calculate() {
      const purchasePriceStr = purchasePriceInput.value.replace(/[^0-9]/g, '');
      const purchasePrice = parseInt(purchasePriceStr) || 300000;

      const result = TD.calculateBuyerCredit(purchasePrice);

      totalCommissionEl.textContent = result.formatted.commissionAmount;
      cashBackEl.textContent = result.formatted.creditAmount;
      agentKeepsEl.textContent = result.formatted.agentKeeps;
    }

    // Event listeners
    purchasePriceInput.addEventListener('input', function() {
      formatNumberInput(this);
      calculate();
    });

    purchasePriceInput.addEventListener('blur', function() {
      const value = parseInt(this.value.replace(/[^0-9]/g, '')) || 300000;
      this.value = value.toLocaleString('en-US');
      calculate();
    });

    // Initial calculation
    calculate();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createCalculator);
  } else {
    createCalculator();
  }

})();
