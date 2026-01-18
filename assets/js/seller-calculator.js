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

  // Format currency without cents
  function formatCurrency(amount) {
    return '$' + Math.round(amount).toLocaleString('en-US');
  }

  // Calculate commission values
  function calculateCommissions(salePrice, isBuyingAndSelling) {
    const tdRate = isBuyingAndSelling ? 0.01 : 0.02; // 1% or 2%
    const traditionalRate = 0.03; // 3%

    const tdFee = salePrice * tdRate;
    const traditionalFee = salePrice * traditionalRate;
    const savings = traditionalFee - tdFee;

    return {
      tdRate: isBuyingAndSelling ? '1%' : '2%',
      tdFee: tdFee,
      traditionalFee: traditionalFee,
      savings: savings,
      formatted: {
        tdFee: formatCurrency(tdFee),
        traditionalFee: formatCurrency(traditionalFee),
        savings: formatCurrency(savings)
      }
    };
  }

  function createCalculator() {
    const container = document.getElementById('td-seller-calculator');
    if (!container) return;

    // Default property price
    const defaultPrice = 400000;
    const initialCalc = calculateCommissions(defaultPrice, true);

    const html = `
      <div class="td-calc">
        <div class="td-calc__inputs">
          <div class="td-calc__input-group">
            <label for="td-sale-price">Expected Sale Price</label>
            <input
              type="text"
              id="td-sale-price"
              value="400,000"
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
            <div class="td-calc__result-value" id="td-traditional-fee">${initialCalc.formatted.traditionalFee}</div>
          </div>

          <div class="td-calc__result-row td-calc__result-row--td">
            <div class="td-calc__result-label">
              TD Realty <span id="td-rate-display">${initialCalc.tdRate}</span> Commission
            </div>
            <div class="td-calc__result-value" id="td-fee">${initialCalc.formatted.tdFee}</div>
          </div>

          <div class="td-calc__result-row td-calc__result-row--savings">
            <div class="td-calc__result-label">Your Savings</div>
            <div class="td-calc__result-value td-calc__result-value--highlight" id="td-savings">${initialCalc.formatted.savings}</div>
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
      try {
        const salePriceStr = salePriceInput.value.replace(/[^0-9]/g, '');
        let salePrice = parseInt(salePriceStr);

        // Handle blank or invalid input - default to 400,000
        if (!salePrice || isNaN(salePrice) || salePrice < 0) {
          salePrice = defaultPrice;
          salePriceInput.value = salePrice.toLocaleString('en-US');
        }

        const isBuyingAndSelling = buyingSellingCheckbox.checked;
        const result = calculateCommissions(salePrice, isBuyingAndSelling);

        traditionalFeeEl.textContent = result.formatted.traditionalFee;
        tdFeeEl.textContent = result.formatted.tdFee;
        savingsEl.textContent = result.formatted.savings;
        rateDisplayEl.textContent = result.tdRate;
      } catch (error) {
        console.error('Calculator error:', error);
      }
    }

    // Event listeners
    salePriceInput.addEventListener('input', function() {
      formatNumberInput(this);
      calculate();
    });

    salePriceInput.addEventListener('blur', function() {
      const value = parseInt(this.value.replace(/[^0-9]/g, ''));
      if (value && !isNaN(value) && value > 0) {
        this.value = value.toLocaleString('en-US');
      } else {
        this.value = defaultPrice.toLocaleString('en-US');
      }
      calculate();
    });

    buyingSellingCheckbox.addEventListener('change', calculate);

    // Initial calculation on page load
    calculate();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createCalculator);
  } else {
    createCalculator();
  }

})();
