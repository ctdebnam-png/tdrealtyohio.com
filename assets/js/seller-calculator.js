/**
 * TD Realty Ohio - Seller Net Proceeds Calculator
 *
 * Interactive tool that compares traditional 3% listing fee
 * versus TD Realty's 1% (buy+sell) or 2% (sell-only) rates.
 *
 * Usage: Add <div id="td-seller-calculator"></div> to any page
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
    const container = document.getElementById('td-seller-calculator');
    if (!container) return;

    const html = `
      <div class="td-calc">
        <div class="td-calc__inputs">
          <div class="td-calc__input-group">
            <label for="td-sale-price">Expected Sale Price</label>
            <input
              type="text"
              id="td-sale-price"
              value="500,000"
              class="td-calc__input"
            />
          </div>

          <div class="td-calc__toggle-group">
            <label class="td-calc__toggle-label">
              <input
                type="checkbox"
                id="td-buying-selling"
                checked
                class="td-calc__checkbox"
              />
              <span>I'm also buying with TD Realty Ohio</span>
            </label>
            <p class="td-calc__toggle-help">Check this to qualify for 1% listing rate</p>
          </div>
        </div>

        <div class="td-calc__results">
          <div class="td-calc__result-row td-calc__result-row--traditional">
            <div class="td-calc__result-label">Traditional 3% Commission</div>
            <div class="td-calc__result-value" id="td-traditional-fee">$15,000</div>
          </div>

          <div class="td-calc__result-row td-calc__result-row--td">
            <div class="td-calc__result-label">
              TD Realty <span id="td-rate-display">1%</span> Commission
            </div>
            <div class="td-calc__result-value" id="td-fee">$5,000</div>
          </div>

          <div class="td-calc__result-row td-calc__result-row--savings">
            <div class="td-calc__result-label">Your Savings</div>
            <div class="td-calc__result-value td-calc__result-value--highlight" id="td-savings">$10,000</div>
          </div>
        </div>

        <div class="td-calc__footer">
          <p class="td-calc__note">
            <strong>Includes:</strong> Pre-listing inspection, professional photography, MLS listing, marketing, negotiation, and transaction management.
          </p>
          <div class="td-calc__cta">
            <a href="/contact/" class="td-btn td-btn--primary">Get Your Free Consultation</a>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Get elements
    const salePriceInput = document.getElementById('td-sale-price');
    const buyingSellingCheckbox = document.getElementById('td-buying-selling');
    const traditionalFeeEl = document.getElementById('td-traditional-fee');
    const tdFeeEl = document.getElementById('td-fee');
    const savingsEl = document.getElementById('td-savings');
    const rateDisplayEl = document.getElementById('td-rate-display');

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
      const salePriceStr = salePriceInput.value.replace(/[^0-9]/g, '');
      const salePrice = parseInt(salePriceStr) || 500000;
      const isBuyingAndSelling = buyingSellingCheckbox.checked;

      const result = TD.calculateSellerSavings(salePrice, isBuyingAndSelling);

      traditionalFeeEl.textContent = result.formatted.traditionalFee;
      tdFeeEl.textContent = result.formatted.tdFee;
      savingsEl.textContent = result.formatted.savings;
      rateDisplayEl.textContent = result.tdRate;
    }

    // Event listeners
    salePriceInput.addEventListener('input', function() {
      formatNumberInput(this);
      calculate();
    });

    salePriceInput.addEventListener('blur', function() {
      const value = parseInt(this.value.replace(/[^0-9]/g, '')) || 500000;
      this.value = value.toLocaleString('en-US');
      calculate();
    });

    buyingSellingCheckbox.addEventListener('change', calculate);

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
