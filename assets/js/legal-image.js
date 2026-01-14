/**
 * TD Realty Ohio - Legal Image Component
 *
 * Client-side component for rendering images from manifest
 * Usage: <div data-legal-image="hero" data-slot="0"></div>
 */

(function() {
  'use strict';

  const MANIFEST_URL = '/media/manifest.json';
  let manifestCache = null;

  /**
   * Load manifest
   */
  async function loadManifest() {
    if (manifestCache) return manifestCache;

    try {
      const response = await fetch(MANIFEST_URL);
      if (!response.ok) {
        console.warn('Media manifest not found');
        return [];
      }
      manifestCache = await response.json();
      return manifestCache;
    } catch (error) {
      console.error('Failed to load media manifest:', error);
      return [];
    }
  }

  /**
   * Get image from manifest
   */
  function getImage(manifest, topic, slot = null) {
    const images = manifest.filter(img => img.topic === topic);
    if (images.length === 0) return null;

    if (slot !== null && slot < images.length) {
      return images[slot];
    }

    // Random selection
    return images[Math.floor(Math.random() * images.length)];
  }

  /**
   * Create picture element
   */
  function createPicture(image, cssClass = '') {
    const picture = document.createElement('picture');
    if (cssClass) picture.className = cssClass;

    const source = document.createElement('source');
    source.srcset = image.cdnUrl;
    source.type = 'image/webp';

    const img = document.createElement('img');
    img.src = image.cdnUrl;
    img.alt = image.attribution;
    img.width = image.width;
    img.height = image.height;
    img.loading = 'lazy';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';

    picture.appendChild(source);
    picture.appendChild(img);

    return picture;
  }

  /**
   * Initialize all legal images on page
   */
  async function initializeLegalImages() {
    const elements = document.querySelectorAll('[data-legal-image]');
    if (elements.length === 0) return;

    const manifest = await loadManifest();
    if (manifest.length === 0) {
      console.warn('No images in manifest');
      return;
    }

    elements.forEach(element => {
      const topic = element.getAttribute('data-legal-image');
      const slotStr = element.getAttribute('data-slot');
      const slot = slotStr !== null ? parseInt(slotStr, 10) : null;
      const cssClass = element.getAttribute('data-class') || '';

      const image = getImage(manifest, topic, slot);
      if (!image) {
        console.warn(`No image found for topic "${topic}"`);
        return;
      }

      const picture = createPicture(image, cssClass);
      element.appendChild(picture);

      // Add attribution link if data-show-credit is present
      if (element.hasAttribute('data-show-credit')) {
        const credit = document.createElement('small');
        credit.className = 'image-credit';
        credit.innerHTML = `<a href="${image.sourceUrl}" target="_blank" rel="noopener">${image.attribution}</a>`;
        element.appendChild(credit);
      }
    });
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLegalImages);
  } else {
    initializeLegalImages();
  }

  // Export for programmatic use
  window.LegalImage = {
    loadManifest,
    getImage,
    createPicture,
    initialize: initializeLegalImages
  };
})();
