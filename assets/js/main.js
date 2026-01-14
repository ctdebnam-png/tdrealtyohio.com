/* TD Realty Ohio - Main JavaScript */

document.addEventListener('DOMContentLoaded', function() {
    
    // ========================================
    // MOBILE NAVIGATION
    // ========================================
    
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking a link
        navMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }
    
    // ========================================
    // FAQ ACCORDIONS
    // ========================================
    
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(function(question) {
        question.addEventListener('click', function() {
            const faqItem = this.parentElement;
            const wasActive = faqItem.classList.contains('active');
            
            // Close all other FAQ items
            document.querySelectorAll('.faq-item').forEach(function(item) {
                item.classList.remove('active');
            });
            
            // Toggle current item
            if (!wasActive) {
                faqItem.classList.add('active');
            }
        });
    });
    
    // ========================================
    // CALCULATOR
    // ========================================
    
    const priceInput = document.getElementById('homePrice');
    const priceSlider = document.getElementById('priceSlider');
    const buyingToggle = document.getElementById('buyingToggle');
    
    // Result elements
    const traditionalResult = document.getElementById('traditionalResult');
    const tdRealtyResult = document.getElementById('tdRealtyResult');
    const savingsResult = document.getElementById('savingsResult');
    const rateDisplay = document.getElementById('rateDisplay');
    
    function formatCurrency(num) {
        return '$' + num.toLocaleString('en-US');
    }
    
    function calculateCommission() {
        if (!priceInput) return;
        
        let price = parseInt(priceInput.value.replace(/[^0-9]/g, '')) || 0;
        
        // Clamp price between min and max
        if (price < 100000) price = 100000;
        if (price > 1500000) price = 1500000;
        
        // Determine rate based on buying toggle
        const isBuying = buyingToggle ? buyingToggle.checked : false;
        const tdRate = isBuying ? 0.01 : 0.02;
        const rateText = isBuying ? '1%' : '2%';
        
        // Calculate commissions
        const traditional = price * 0.03;
        const tdRealty = price * tdRate;
        const savings = traditional - tdRealty;
        
        // Update display
        if (traditionalResult) traditionalResult.textContent = formatCurrency(traditional);
        if (tdRealtyResult) tdRealtyResult.textContent = formatCurrency(tdRealty);
        if (savingsResult) savingsResult.textContent = formatCurrency(savings);
        if (rateDisplay) rateDisplay.textContent = rateText;
        
        // Sync slider if exists
        if (priceSlider && priceSlider.value != price) {
            priceSlider.value = price;
        }
    }
    
    // Price input handlers
    if (priceInput) {
        priceInput.addEventListener('input', function() {
            calculateCommission();
        });
        
        priceInput.addEventListener('blur', function() {
            let value = parseInt(this.value.replace(/[^0-9]/g, '')) || 500000;
            if (value < 100000) value = 100000;
            if (value > 1500000) value = 1500000;
            this.value = value;
            calculateCommission();
        });
    }
    
    // Slider handlers
    if (priceSlider) {
        priceSlider.addEventListener('input', function() {
            if (priceInput) priceInput.value = this.value;
            calculateCommission();
        });
    }
    
    // Toggle handler
    if (buyingToggle) {
        buyingToggle.addEventListener('change', calculateCommission);
    }
    
    // Initial calculation
    calculateCommission();
    
    // ========================================
// CONTACT FORM (Formspree)
// ========================================

const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const name = document.getElementById('name');
        const email = document.getElementById('email');
        const message = document.getElementById('message');

        // Basic validation (kept lightweight)
        let isValid = true;

        if (name && !name.value.trim()) {
            isValid = false;
            name.style.borderColor = '#C1393D';
        } else if (name) {
            name.style.borderColor = '';
        }

        if (email && !isValidEmail(email.value)) {
            isValid = false;
            email.style.borderColor = '#C1393D';
        } else if (email) {
            email.style.borderColor = '';
        }

        if (message && !message.value.trim()) {
            isValid = false;
            message.style.borderColor = '#C1393D';
        } else if (message) {
            message.style.borderColor = '';
        }

        if (!isValid) return;

        // Submit to Formspree if action is set; otherwise fall back to old behavior
        const action = contactForm.getAttribute('action') || '';
        const formData = new FormData(contactForm);

        try {
            if (action) {
                const res = await fetch(action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                if (!res.ok) throw new Error('Form submit failed');
            } else {
                // No endpoint configured; treat as success after validation
                console.warn('No form action set on #contactForm; skipping submission.');
            }

            contactForm.style.display = 'none';
            if (formSuccess) {
                formSuccess.style.display = 'block';
            }
            contactForm.reset();
        } catch (err) {
            alert('Sorry, something went wrong. Please call (614) 956-8656.');
        }
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ========================================
// SMOOTH SCROLL
    // ========================================
    
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // ========================================
    // BACK TO TOP BUTTON
    // ========================================
    
    const backToTop = document.querySelector('.back-to-top');
    
    if (backToTop) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 400) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });
        
        backToTop.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
});
