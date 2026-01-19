/**
 * TD Realty SEO System - Shared Utilities
 */

// Storage Keys
const STORAGE_KEYS = {
  TASKS: 'tdr_seo_tasks',
  SETTINGS: 'tdr_settings',
  CITATIONS: 'tdr_citations',
  REVIEWS: 'tdr_reviews',
  CONTENT: 'tdr_content',
  RANKINGS: 'tdr_rankings',
  NOTIFICATIONS: 'tdr_notifications',
  THEME: 'tdr_theme',
  LAST_CONTENT_DATE: 'tdr_last_content_date'
};

// Default Business Info
const DEFAULT_SETTINGS = {
  businessName: 'TD Realty Ohio, LLC',
  broker: 'Travis Debnam',
  brokerLicense: '2023006467',
  brokerageLicense: '2023006602',
  founded: '2017',
  website: 'tdrealtyohio.com',
  phone: '(614) 392-8858',
  email: 'info@tdrealtyohio.com',
  address: 'Westerville',
  city: 'Columbus',
  state: 'Ohio',
  zip: '43081',
  targetKeywords: [
    '1% commission realtor Columbus Ohio',
    'discount realtor Columbus Ohio',
    'sell house for less Columbus',
    'low commission realtor Columbus',
    '1 percent listing fee Ohio',
    'flat fee realtor Columbus',
    'cheap realtor Columbus Ohio',
    'save money selling house Columbus'
  ],
  competitors: [
    'homesthatclick.com',
    'sellfor1percent.com',
    'sell4onepercent.com',
    'listwithclever.com'
  ],
  serviceCities: [
    'Columbus', 'Westerville', 'Dublin', 'Gahanna', 'New Albany',
    'Powell', 'Lewis Center', 'Delaware', 'Galena', 'Sunbury',
    'Blacklick', 'Pataskala', 'Pickerington', 'Hilliard',
    'Upper Arlington', 'Worthington', 'Clintonville'
  ]
};

// Data Management Functions
const DataManager = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error writing to localStorage:', e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Error removing from localStorage:', e);
      return false;
    }
  },

  getSettings() {
    return this.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  saveSettings(settings) {
    return this.set(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...settings });
  }
};

// Task Management
const TaskManager = {
  defaultTasks: {
    technical: [
      { id: 'tech-1', text: 'Google Business Profile claimed and optimized', completed: false },
      { id: 'tech-2', text: 'Google Search Console verified', completed: false },
      { id: 'tech-3', text: 'Sitemap.xml submitted to Google', completed: false },
      { id: 'tech-4', text: 'Site indexed in Google (check: site:tdrealtyohio.com)', completed: false },
      { id: 'tech-5', text: 'Schema markup implemented (LocalBusiness, RealEstateAgent)', completed: false },
      { id: 'tech-6', text: 'All pages have unique title tags', completed: false },
      { id: 'tech-7', text: 'All pages have meta descriptions', completed: false },
      { id: 'tech-8', text: 'All images have alt text', completed: false },
      { id: 'tech-9', text: 'Mobile-friendly test passed', completed: false },
      { id: 'tech-10', text: 'Page speed > 80 on mobile', completed: false }
    ],
    citations: [
      { id: 'cite-1', text: 'Google Business Profile', completed: false },
      { id: 'cite-2', text: 'Yelp', completed: false },
      { id: 'cite-3', text: 'BBB', completed: false },
      { id: 'cite-4', text: 'Facebook Business', completed: false },
      { id: 'cite-5', text: 'Zillow Agent Profile', completed: false },
      { id: 'cite-6', text: 'Realtor.com Agent Profile', completed: false },
      { id: 'cite-7', text: 'Homes.com', completed: false },
      { id: 'cite-8', text: 'YellowPages', completed: false },
      { id: 'cite-9', text: 'Manta', completed: false },
      { id: 'cite-10', text: 'Local.com', completed: false },
      { id: 'cite-11', text: 'Foursquare/Factual', completed: false },
      { id: 'cite-12', text: 'Apple Maps', completed: false },
      { id: 'cite-13', text: 'Bing Places', completed: false },
      { id: 'cite-14', text: 'Columbus Chamber of Commerce', completed: false },
      { id: 'cite-15', text: 'Columbus REALTORS directory', completed: false }
    ],
    content: [
      { id: 'blog-1', text: 'Blog: "1% Commission Realtor Columbus Ohio Guide"', completed: false },
      { id: 'blog-2', text: 'Blog: "How to Sell Your House for Less in Columbus"', completed: false },
      { id: 'blog-3', text: 'Blog: "Columbus Discount Real Estate Brokers Compared"', completed: false },
      { id: 'blog-4', text: 'Blog: "Save Thousands Selling Your Columbus Home"', completed: false },
      { id: 'blog-5', text: 'Blog: "What Does a 1 Percent Realtor Really Offer?"', completed: false },
      { id: 'blog-6', text: 'Blog: "TD Realty vs Homes That Click Comparison"', completed: false },
      { id: 'blog-7', text: 'Blog: "TD Realty vs Sell for 1 Percent Comparison"', completed: false },
      { id: 'blog-8', text: 'Blog: "Free Pre-Listing Inspection: Why It Matters"', completed: false },
      { id: 'blog-9', text: 'Blog: "First-Time Homebuyer Guide Columbus"', completed: false },
      { id: 'blog-10', text: 'Blog: "Columbus Housing Market Update"', completed: false }
    ],
    neighborhoods: [
      { id: 'hood-1', text: 'Columbus neighborhood page', completed: false },
      { id: 'hood-2', text: 'Westerville neighborhood page', completed: false },
      { id: 'hood-3', text: 'Dublin neighborhood page', completed: false },
      { id: 'hood-4', text: 'Gahanna neighborhood page', completed: false },
      { id: 'hood-5', text: 'New Albany neighborhood page', completed: false },
      { id: 'hood-6', text: 'Powell neighborhood page', completed: false },
      { id: 'hood-7', text: 'Lewis Center neighborhood page', completed: false },
      { id: 'hood-8', text: 'Delaware neighborhood page', completed: false },
      { id: 'hood-9', text: 'Galena neighborhood page', completed: false },
      { id: 'hood-10', text: 'Sunbury neighborhood page', completed: false },
      { id: 'hood-11', text: 'Blacklick neighborhood page', completed: false },
      { id: 'hood-12', text: 'Pataskala neighborhood page', completed: false },
      { id: 'hood-13', text: 'Pickerington neighborhood page', completed: false },
      { id: 'hood-14', text: 'Hilliard neighborhood page', completed: false },
      { id: 'hood-15', text: 'Upper Arlington neighborhood page', completed: false },
      { id: 'hood-16', text: 'Worthington neighborhood page', completed: false },
      { id: 'hood-17', text: 'Clintonville neighborhood page', completed: false }
    ],
    reviews: [
      { id: 'rev-1', text: '5 Google reviews obtained', completed: false },
      { id: 'rev-2', text: '10 Google reviews obtained', completed: false },
      { id: 'rev-3', text: '20 Google reviews obtained', completed: false },
      { id: 'rev-4', text: '50 Google reviews obtained', completed: false },
      { id: 'rev-5', text: 'Testimonials page created with 5+ testimonials', completed: false },
      { id: 'rev-6', text: '"Commission Savings" counter added to homepage', completed: false }
    ],
    backlinks: [
      { id: 'link-1', text: '10 directory backlinks obtained', completed: false },
      { id: 'link-2', text: '25 directory backlinks obtained', completed: false },
      { id: 'link-3', text: '50 directory backlinks obtained', completed: false },
      { id: 'link-4', text: 'Local news/PR mention obtained', completed: false },
      { id: 'link-5', text: 'Guest post on local blog published', completed: false },
      { id: 'link-6', text: 'Partner link from mortgage lender', completed: false }
    ]
  },

  getTasks() {
    const saved = DataManager.get(STORAGE_KEYS.TASKS);
    if (saved) return saved;
    return this.defaultTasks;
  },

  saveTasks(tasks) {
    return DataManager.set(STORAGE_KEYS.TASKS, tasks);
  },

  toggleTask(category, taskId) {
    const tasks = this.getTasks();
    const task = tasks[category]?.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      task.completedDate = task.completed ? new Date().toISOString() : null;
      this.saveTasks(tasks);
    }
    return tasks;
  },

  getProgress() {
    const tasks = this.getTasks();
    let total = 0;
    let completed = 0;
    let completedThisWeek = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    Object.values(tasks).forEach(category => {
      category.forEach(task => {
        total++;
        if (task.completed) {
          completed++;
          if (task.completedDate && new Date(task.completedDate) > oneWeekAgo) {
            completedThisWeek++;
          }
        }
      });
    });

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      completedThisWeek
    };
  },

  getCategoryProgress(category) {
    const tasks = this.getTasks();
    const categoryTasks = tasks[category] || [];
    const total = categoryTasks.length;
    const completed = categoryTasks.filter(t => t.completed).length;
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  },

  getWeeklyPriorities() {
    const tasks = this.getTasks();
    const priorities = [];

    // Priority order for categories
    const categoryOrder = ['technical', 'citations', 'content', 'neighborhoods', 'reviews', 'backlinks'];

    categoryOrder.forEach(category => {
      const incompleteTasks = (tasks[category] || []).filter(t => !t.completed);
      incompleteTasks.slice(0, 2).forEach(task => {
        if (priorities.length < 7) {
          priorities.push({
            category,
            ...task
          });
        }
      });
    });

    return priorities.slice(0, 7);
  }
};

// Alert System
const AlertSystem = {
  getAlerts() {
    const alerts = [];
    const settings = DataManager.getSettings();
    const googleReviews = DataManager.get('tdr_google_reviews', 0);
    const lastContentDate = DataManager.get(STORAGE_KEYS.LAST_CONTENT_DATE);

    // Check content publishing
    if (lastContentDate) {
      const daysSinceContent = Math.floor((Date.now() - new Date(lastContentDate)) / (1000 * 60 * 60 * 24));
      if (daysSinceContent >= 14) {
        alerts.push({
          type: 'danger',
          title: 'Content Alert',
          message: `No content published in ${daysSinceContent} days. Time to publish!`,
          icon: 'warning'
        });
      } else if (daysSinceContent >= 7) {
        alerts.push({
          type: 'warning',
          title: 'Content Reminder',
          message: `${daysSinceContent} days since last content. Consider publishing soon.`,
          icon: 'info'
        });
      }
    } else {
      alerts.push({
        type: 'warning',
        title: 'No Content Tracked',
        message: 'Set your last content publish date in settings.',
        icon: 'info'
      });
    }

    // Check reviews
    if (googleReviews < 10) {
      alerts.push({
        type: 'danger',
        title: 'Reviews Critical',
        message: `Only ${googleReviews} Google reviews. Target: 10+ reviews.`,
        icon: 'star'
      });
    } else if (googleReviews < 20) {
      alerts.push({
        type: 'warning',
        title: 'Reviews Warning',
        message: `${googleReviews} Google reviews. Target: 20+ reviews.`,
        icon: 'star'
      });
    }

    // Check task completion
    const progress = TaskManager.getProgress();
    if (progress.percentage < 25) {
      alerts.push({
        type: 'warning',
        title: 'Low Progress',
        message: `Only ${progress.percentage}% of SEO tasks completed.`,
        icon: 'chart'
      });
    }

    return alerts;
  },

  getStatusLevel() {
    const alerts = this.getAlerts();
    if (alerts.some(a => a.type === 'danger')) return 'danger';
    if (alerts.some(a => a.type === 'warning')) return 'warning';
    return 'success';
  }
};

// Theme Management
const ThemeManager = {
  init() {
    const savedTheme = DataManager.get(STORAGE_KEYS.THEME, 'light');
    this.setTheme(savedTheme);
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    DataManager.set(STORAGE_KEYS.THEME, theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  },

  isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }
};

// Notification System
const NotificationSystem = {
  requestPermission() {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  },

  send(title, body, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: options.icon || '/favicon.ico',
        ...options
      });
    }
  },

  checkAndNotify() {
    const alerts = AlertSystem.getAlerts();
    const prefs = DataManager.get(STORAGE_KEYS.NOTIFICATIONS, { enabled: true });

    if (!prefs.enabled) return;

    alerts.filter(a => a.type === 'danger').forEach(alert => {
      this.send(alert.title, alert.message);
    });
  }
};

// Utility Functions
const Utils = {
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  formatDateShort(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  },

  daysSince(date) {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24));
  },

  generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  truncate(str, length) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  }
};

// Modal Helper
const Modal = {
  show(modalId) {
    document.getElementById(modalId)?.classList.add('active');
  },

  hide(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  },

  init() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').classList.remove('active');
      });
    });
  }
};

// Accordion Helper
const Accordion = {
  init() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const isActive = header.classList.contains('active');

        // Close all accordions in the same container
        const container = header.closest('.accordion-container');
        if (container) {
          container.querySelectorAll('.accordion-header').forEach(h => {
            h.classList.remove('active');
            h.nextElementSibling?.classList.remove('active');
          });
        }

        // Toggle current accordion
        if (!isActive) {
          header.classList.add('active');
          header.nextElementSibling?.classList.add('active');
        }
      });
    });
  }
};

// Export data
const ExportManager = {
  toJSON(data) {
    return JSON.stringify(data, null, 2);
  },

  toCSV(data, headers) {
    const rows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(h => {
        const val = row[h] || '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      rows.push(values.join(','));
    });
    return rows.join('\n');
  },

  download(content, filename, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Navigation helper
const Navigation = {
  getPageName() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    return filename.replace('.html', '');
  },

  setActiveNav() {
    const currentPage = this.getPageName();
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkPage = href.split('/').pop().replace('.html', '') || 'index';
      if (linkPage === currentPage) {
        link.classList.add('active');
      }
    });
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Modal.init();
  Accordion.init();
  Navigation.setActiveNav();
  NotificationSystem.requestPermission();
});

// Make available globally
window.TDR = {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  DataManager,
  TaskManager,
  AlertSystem,
  ThemeManager,
  NotificationSystem,
  Utils,
  Modal,
  Accordion,
  ExportManager,
  Navigation
};
