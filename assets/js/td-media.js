/**
 * TD Realty Ohio - Media Assets Manifest
 *
 * SINGLE SOURCE OF TRUTH for all visual assets used across the site.
 * Maps page intent and component types to exact filenames.
 *
 * All paths are relative to site root.
 * DO NOT modify these paths without updating the corresponding asset files.
 */

window.TD_MEDIA = {

  // Hero illustrations - One per major page type
  hero: {
    home: '/assets/images/hero/hero-home.svg',
    sellers: '/assets/images/hero/hero-sellers.svg',
    buyers: '/assets/images/hero/hero-buyers.svg',
    contact: '/assets/images/hero/hero-contact.svg',
    about: '/assets/images/hero/hero-about.svg',
    areas: '/assets/images/hero/hero-areas.svg',
    blog: '/assets/images/hero/hero-blog.svg',
    inspection: '/assets/images/hero/hero-inspection.svg'
  },

  // Section illustrations - For content sections and feature blocks
  sections: {
    calculators: '/assets/images/sections/section-calculators.svg',
    process: '/assets/images/sections/section-process.svg',
    trust: '/assets/images/sections/section-trust.svg'
  },

  // Icon set - Consistent visual language for feature cards
  icons: {
    savings: '/assets/images/icons/icon-savings.svg',
    inspection: '/assets/images/icons/icon-inspection.svg',
    local: '/assets/images/icons/icon-local.svg',
    phone: '/assets/images/icons/icon-phone.svg',
    email: '/assets/images/icons/icon-email.svg',
    licensed: '/assets/images/icons/icon-licensed.svg'
  },

  // Video frames - Vertical social media story format (1080x1920)
  videoFrames: {
    sell1: {
      svg: '/assets/images/video-frames/frame-sell-1.svg',
      png: '/assets/images/video-frames/frame-sell-1.png'
    },
    sell2: {
      svg: '/assets/images/video-frames/frame-sell-2.svg',
      png: '/assets/images/video-frames/frame-sell-2.png'
    },
    inspection: {
      svg: '/assets/images/video-frames/frame-inspection.svg',
      png: '/assets/images/video-frames/frame-inspection.png'
    },
    buyer1: {
      svg: '/assets/images/video-frames/frame-buyer-1.svg',
      png: '/assets/images/video-frames/frame-buyer-1.png'
    },
    buyerExample: {
      svg: '/assets/images/video-frames/frame-buyer-example.svg',
      png: '/assets/images/video-frames/frame-buyer-example.png'
    },
    contact: {
      svg: '/assets/images/video-frames/frame-contact.svg',
      png: '/assets/images/video-frames/frame-contact.png'
    }
  }

};

// Freeze the manifest to prevent accidental modification
Object.freeze(window.TD_MEDIA);
Object.freeze(window.TD_MEDIA.hero);
Object.freeze(window.TD_MEDIA.sections);
Object.freeze(window.TD_MEDIA.icons);
Object.freeze(window.TD_MEDIA.videoFrames);
