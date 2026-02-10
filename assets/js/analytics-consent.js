(function loadAnalyticsByConsent() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  if (window.localStorage && localStorage.getItem('cookie-consent') === 'declined') {
    return;
  }

  var analyticsLoaded = false;

  function injectAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17866418952';
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', 'AW-17866418952');
  }

  function loadAfterInteraction() {
    injectAnalytics();
  }

  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function(eventName) {
    window.addEventListener(eventName, loadAfterInteraction, { once: true, passive: true });
  });

  if ('requestIdleCallback' in window) {
    requestIdleCallback(injectAnalytics, { timeout: 4000 });
  } else {
    setTimeout(injectAnalytics, 4000);
  }
})();
