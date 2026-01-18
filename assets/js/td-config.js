/**
 * TD Realty Ohio - Global Business Constants
 *
 * SINGLE SOURCE OF TRUTH for all business identity, contact info,
 * pricing, and program details. Every page must use these constants.
 *
 * DO NOT hardcode these values anywhere else on the site.
 */

window.TD_REALTY = {

  // Business Identity
  business: {
    name: 'TD Realty Ohio, LLC',
    brokerageLicense: '2023006602',
    broker: {
      name: 'Travis Debnam',
      license: '2023006467'
    },
    location: 'Westerville, Ohio',
    serviceArea: 'Central Ohio',
    foundedYear: 2017
  },

  // Contact Information
  contact: {
    phone: {
      display: '(614) 392-8858',
      tel: 'tel:+16143928858',
      raw: '6143928858'
    },
    email: {
      display: 'info@tdrealtyohio.com',
      mailto: 'mailto:info@tdrealtyohio.com'
    }
  },

  // Seller Pricing & Programs
  seller: {
    pricing: {
      buyAndSell: {
        rate: 0.01,
        display: '1%',
        description: '1% listing commission when you buy and sell with TD Realty Ohio'
      },
      sellOnly: {
        rate: 0.02,
        display: '2%',
        description: '2% listing commission for sell-only transactions'
      },
      traditional: {
        rate: 0.03,
        display: '3%',
        description: 'Traditional agent listing commission'
      }
    },
    included: {
      inspection: {
        name: 'Pre-listing inspection',
        description: 'Pre-listing inspection included with every listing'
      }
    }
  },

  // Buyer Programs
  buyer: {
    firstTime: {
      rate: 0.01,
      display: '1%',
      description: 'First-time buyers get 1% of purchase price back at closing',
      example: {
        homePrice: 300000,
        buyerCommission: 9000,        // 3% of $300k
        buyerCommissionRate: 0.03,
        cashBackAmount: 3000,         // 1% of $300k
        agentKeeps: 6000,             // $9k - $3k
        explanation: 'On a $300,000 home with a 3% buyer broker commission ($9,000), we give you $3,000 back at closing and keep $6,000. You receive $3,000 cash at closing.'
      }
    }
  },

  // Service Areas (Central Ohio)
  serviceAreas: [
    'Blacklick', 'Clintonville', 'Columbus', 'Delaware', 'Dublin',
    'Gahanna', 'Galena', 'Hilliard', 'Lewis Center', 'New Albany',
    'Pataskala', 'Pickerington', 'Powell', 'Sunbury', 'Upper Arlington',
    'Westerville', 'Worthington'
  ],

  // Compliance & Legal
  compliance: {
    equalHousing: 'Equal Housing Opportunity. We are committed to providing equal professional service without discrimination.',
    realtor: 'Member of Columbus REALTORS® and National Association of REALTORS®',
    buyerCompensation: 'Compensation for buyer representation is negotiable and not set by law or any real estate board or MLS. Before you begin working with a buyer\'s agent, you\'ll receive a clear explanation of services and any associated costs.'
  },

  // Utility Functions
  formatCurrency: function(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  calculateSellerSavings: function(salePrice, isBuyingAndSelling = true) {
    const tdRate = isBuyingAndSelling ? this.seller.pricing.buyAndSell.rate : this.seller.pricing.sellOnly.rate;
    const traditionalRate = this.seller.pricing.traditional.rate;

    const tdFee = salePrice * tdRate;
    const traditionalFee = salePrice * traditionalRate;
    const savings = traditionalFee - tdFee;

    return {
      salePrice: salePrice,
      tdRate: isBuyingAndSelling ? this.seller.pricing.buyAndSell.display : this.seller.pricing.sellOnly.display,
      tdFee: tdFee,
      traditionalFee: traditionalFee,
      savings: savings,
      formatted: {
        salePrice: this.formatCurrency(salePrice),
        tdFee: this.formatCurrency(tdFee),
        traditionalFee: this.formatCurrency(traditionalFee),
        savings: this.formatCurrency(savings)
      }
    };
  },

  calculateBuyerCredit: function(purchasePrice) {
    const creditAmount = purchasePrice * this.buyer.firstTime.rate;
    const commissionAmount = purchasePrice * this.buyer.firstTime.example.buyerCommissionRate;
    const agentKeeps = commissionAmount - creditAmount;

    return {
      purchasePrice: purchasePrice,
      creditRate: this.buyer.firstTime.display,
      creditAmount: creditAmount,
      commissionAmount: commissionAmount,
      agentKeeps: agentKeeps,
      formatted: {
        purchasePrice: this.formatCurrency(purchasePrice),
        creditAmount: this.formatCurrency(creditAmount),
        commissionAmount: this.formatCurrency(commissionAmount),
        agentKeeps: this.formatCurrency(agentKeeps)
      }
    };
  }
};

// Freeze the config to prevent accidental modification
Object.freeze(window.TD_REALTY);
