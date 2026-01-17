document.addEventListener('DOMContentLoaded', function() {
    const homePriceInput = document.getElementById('homePrice');
    const buyAndSellCheckbox = document.getElementById('buyAndSell');
    const traditionalCostEl = document.getElementById('traditionalCost');
    const tdCostEl = document.getElementById('tdCost');
    const savingsEl = document.getElementById('savings');
    const rateDisplayEl = document.getElementById('rateDisplay');

    function formatCurrency(amount) {
        return '$' + amount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
    }

    function calculateCommission() {
        const homePrice = parseFloat(homePriceInput.value) || 0;
        const isBuyAndSell = buyAndSellCheckbox.checked;
        const traditionalCommission = homePrice * 0.03;
        const tdRate = isBuyAndSell ? 0.01 : 0.02;
        const tdCommission = homePrice * tdRate;
        const savings = traditionalCommission - tdCommission;
        
        traditionalCostEl.textContent = formatCurrency(traditionalCommission);
        tdCostEl.textContent = formatCurrency(tdCommission);
        savingsEl.textContent = formatCurrency(savings);
        rateDisplayEl.textContent = isBuyAndSell ? '(1%)' : '(2%)';
    }

    if (homePriceInput) homePriceInput.addEventListener('input', calculateCommission);
    if (buyAndSellCheckbox) buyAndSellCheckbox.addEventListener('change', calculateCommission);
    calculateCommission();
});
