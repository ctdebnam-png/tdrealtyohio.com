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

  // Format currency without cents
  function formatCurrency(amount) {
    return '$' + Math.round(amount).toLocaleString('en-US');
  }

  // Calculate buyer credit values
  function calculateBuyerCredit(purchasePrice) {
    const creditRate = 0.01; // 1% cash back
    const typicalCommissionRate = 0.03; // 3% buyer commission

    const creditAmount = purchasePrice * creditRate;
    const commissionAmount = purchasePrice * typicalCommissionRate;
    const agentKeeps = commissionAmount - creditAmount;

    return {
      creditAmount: creditAmount,
      commissionAmount: commissionAmount,
      agentKeeps: agentKeeps,
      formatted: {
        creditAmount: formatCurrency(creditAmount),
        commissionAmount: formatCurrency(commissionAmount),
        agentKeeps: formatCurrency(agentKeeps)
      }
    };
  }

  function createCalculator() {
    const container = document.getElementById('td-buyer-calculator');
    if (!container) return;

    // Default purchase price
    const defaultPrice = 300000;
    const initialCalc = calculateBuyerCredit(defaultPrice);

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
            <div class="td-calc__result-value" id="td-total-commission">${initialCalc.formatted.commissionAmount}</div>
          </div>

          <div class="td-calc__result-row td-calc__result-row--highlight">
            <div class="td-calc__result-label">
              <strong>Your 1% Cash Back at Closing</strong>
            </div>
            <div class="td-calc__result-value td-calc__result-value--highlight" id="td-cash-back">${initialCalc.formatted.creditAmount}</div>
          </div>

          <div class="td-calc__result-row">
            <div class="td-calc__result-label">Agent Keeps</div>
            <div class="td-calc__result-value" id="td-agent-keeps">${initialCalc.formatted.agentKeeps}</div>
          </div>
        </div>

        <div class="td-calc__footer">
          <div class="td-calc__example">
            <p class="td-calc__note">
              <strong>How it works:</strong> On a $300,000 home with a 3% buyer broker commission ($9,000), we give you $3,000 back at closing and keep $6,000. You receive $3,000 cash at closing.
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
      try {
        const purchasePriceStr = purchasePriceInput.value.replace(/[^0-9]/g, '');
        let purchasePrice = parseInt(purchasePriceStr);

        // Handle blank or invalid input - default to 300,000
        if (!purchasePrice || isNaN(purchasePrice) || purchasePrice < 0) {
          purchasePrice = defaultPrice;
          purchasePriceInput.value = purchasePrice.toLocaleString('en-US');
        }

        const result = calculateBuyerCredit(purchasePrice);

        totalCommissionEl.textContent = result.formatted.commissionAmount;
        cashBackEl.textContent = result.formatted.creditAmount;
        agentKeepsEl.textContent = result.formatted.agentKeeps;
      } catch (error) {
        console.error('Calculator error:', error);
      }
    }

    // Event listeners
    purchasePriceInput.addEventListener('input', function() {
      formatNumberInput(this);
      calculate();
    });

    purchasePriceInput.addEventListener('blur', function() {
      const value = parseInt(this.value.replace(/[^0-9]/g, ''));
      if (value && !isNaN(value) && value > 0) {
        this.value = value.toLocaleString('en-US');
      } else {
        this.value = defaultPrice.toLocaleString('en-US');
      }
      calculate();
    });

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
