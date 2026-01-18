/* FILE: /assets/js/tdro-ui.js */
(() => {
  "use strict";

  const CONFIG = {
    business: {
      phoneDisplay: "(614) 392-8858",
      phoneTel: "+16143928858",
      email: "info@tdrealtyohio.com",
      brokerageLicense: "2023006602",
      brokerLicense: "2023006467"
    },
    ticker: {
      label: "TD Realty Ohio",
      rotateMs: 6000,
      lines: [
        "List for 1% when buying and selling",
        "List for 2% when selling only",
        "Pre-listing inspection included",
        "First-time buyers get 1% back at closing"
      ]
    }
  };

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function hydrateIdentity() {
    qsa("[data-td-phone-display]").forEach(el => el.textContent = CONFIG.business.phoneDisplay);
    qsa("[data-td-phone-tel]").forEach(el => el.setAttribute("href", `tel:${CONFIG.business.phoneTel}`));
    qsa("[data-td-email]").forEach(el => el.textContent = CONFIG.business.email);
    qsa("[data-td-email-mailto]").forEach(el => el.setAttribute("href", `mailto:${CONFIG.business.email}`));
    qsa("[data-td-brokerage-license]").forEach(el => el.textContent = CONFIG.business.brokerageLicense);
    qsa("[data-td-broker-license]").forEach(el => el.textContent = CONFIG.business.brokerLicense);
  }

  function navToggle() {
    const btn = qs("[data-td-nav-toggle]");
    const nav = qs("[data-td-nav]");
    if (!btn || !nav) return;

    btn.addEventListener("click", () => {
      nav.classList.toggle("is-open");
      const expanded = nav.classList.contains("is-open");
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  function faqAccordion() {
    qsa("[data-td-faq-item]").forEach(item => {
      const btn = qs("[data-td-faq-q]", item);
      if (!btn) return;

      btn.addEventListener("click", () => {
        const open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function ticker() {
    const root = qs("[data-td-ticker]");
    if (!root) return;

    const label = qs("[data-td-ticker-label]", root);
    const line = qs("[data-td-ticker-line]", root);

    if (label) label.textContent = CONFIG.ticker.label;
    if (!line) return;

    let i = 0;
    line.textContent = CONFIG.ticker.lines[i];

    window.setInterval(() => {
      i = (i + 1) % CONFIG.ticker.lines.length;
      line.textContent = CONFIG.ticker.lines[i];
    }, CONFIG.ticker.rotateMs);
  }

  document.addEventListener("DOMContentLoaded", () => {
    hydrateIdentity();
    navToggle();
    faqAccordion();
    ticker();
  });
})();
