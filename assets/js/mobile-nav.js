/**
 * TD Realty Ohio - phone menu
 *
 * The off-canvas panel behind #mobile-menu-btn, on every page. Nine of the ten
 * pages load no other script, so this file stands alone: it reads only TD_NAV
 * (nav.js, loaded just before it) and touches nothing main.js owns. It used to
 * live in main.js as initMobileNav(), which only /contact/ and 404 load, and
 * no page carried the button, so phones had no menu at all.
 *
 * The panel is built as a direct child of <body> so the header's stacking
 * context (and its backdrop-filter once scrolled) cannot trap it.
 */
(function () {
  'use strict';

  function normalizePath(path) {
    if (!path) return '/';
    path = path.split('?')[0].split('#')[0];
    path = path.replace(/\/index\.html$/, '/');
    path = path.replace(/\/+/g, '/');
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path !== '/' && !path.endsWith('/')) path += '/';
    return path;
  }

  var savedScrollY = 0;

  function lockScroll() {
    savedScrollY = window.scrollY || window.pageYOffset;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + savedScrollY + 'px';
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, savedScrollY);
  }

  function initMobileNav() {
    var btn = document.getElementById('mobile-menu-btn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    var panel = document.createElement('nav');
    panel.id = 'mobile-nav-panel';
    panel.className = 'mobile-nav-panel';
    panel.setAttribute('aria-label', 'Mobile navigation');

    var overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'nav-overlay';

    btn.setAttribute('aria-controls', 'mobile-nav-panel');
    btn.setAttribute('aria-expanded', 'false');

    var closeWrap = document.createElement('div');
    closeWrap.className = 'nav-close-btn';
    closeWrap.innerHTML = '<button type="button" aria-label="Close menu" id="mobile-nav-close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/></svg></button>';
    panel.appendChild(closeWrap);

    // Links come from TD_NAV.mobile only; nothing is scraped from the page.
    var body = document.createElement('div');
    body.className = 'nav-menu-body';
    var currentPath = normalizePath(window.location.pathname);
    var mobileConfig = (typeof TD_NAV !== 'undefined' && TD_NAV.mobile) ? TD_NAV.mobile : null;

    if (mobileConfig) {
      var lead = document.createElement('div');
      lead.className = 'mobile-nav-lead';
      lead.innerHTML = '<p class="mobile-nav-lead-title">Broker-led representation in Central Ohio</p><p class="mobile-nav-lead-copy">Direct access to the broker, clear timelines, and contract-to-close execution.</p>';
      body.appendChild(lead);

      ['sell', 'buy', 'learn'].forEach(function (key) {
        var group = mobileConfig[key];
        if (!group || !Array.isArray(group.items) || !group.items.length) return;

        var header = document.createElement('div');
        header.className = 'nav-section-header';
        header.id = 'mobile-nav-group-' + key;
        header.textContent = group.title;
        body.appendChild(header);

        group.items.forEach(function (item) {
          var a = document.createElement('a');
          a.href = item.href;
          a.className = 'nav-link';
          a.textContent = item.label;
          if (normalizePath(item.href) === currentPath) {
            a.classList.add('active');
            a.setAttribute('aria-current', 'page');
          }
          body.appendChild(a);
        });
      });
    }

    var cta = document.createElement('a');
    cta.href = '/contact/';
    cta.className = 'btn btn-primary nav-cta';
    cta.textContent = 'Contact';
    body.appendChild(cta);

    panel.appendChild(body);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    var closeBtn = closeWrap.querySelector('button');

    function isOpen() { return panel.classList.contains('mobile-open'); }

    function openNav() {
      lockScroll();
      panel.classList.add('mobile-open');
      overlay.classList.add('active');
      document.body.classList.add('nav-open');
      btn.setAttribute('aria-expanded', 'true');
      closeBtn.focus();
    }

    function closeNav() {
      if (!isOpen()) return;
      unlockScroll();
      panel.classList.remove('mobile-open');
      overlay.classList.remove('active');
      document.body.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }

    btn.addEventListener('click', function () {
      if (isOpen()) { closeNav(); } else { openNav(); }
    });
    closeBtn.addEventListener('click', closeNav);
    overlay.addEventListener('click', closeNav);
    panel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    // Keep Tab inside the panel while it is open.
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isOpen()) return;
      var focusable = panel.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    // Widening past the breakpoint hides the panel in CSS; release the page too.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) closeNav();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
