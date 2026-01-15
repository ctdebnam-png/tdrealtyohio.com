/**
 * Database Module for Image Tracking
 * Uses SQLite for storing image metadata, performance metrics, and history
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor(dbPath = './data/intelligent-media.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database and create tables
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📦 Database connected');
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Images table - stores all image metadata
      `CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        page TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_url TEXT,
        photographer TEXT,
        photographer_url TEXT,
        license TEXT,
        width INTEGER,
        height INTEGER,
        score_total REAL,
        score_quality REAL,
        score_relevance REAL,
        score_seo REAL,
        score_engagement REAL,
        selection_type TEXT,
        alt_text TEXT,
        title_attr TEXT,
        structured_data TEXT,
        attribution_html TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_value REAL,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`,

      // Refresh history table
      `CREATE TABLE IF NOT EXISTS refresh_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        old_image_id TEXT,
        refresh_reason TEXT,
        refresh_type TEXT,
        old_score REAL,
        new_score REAL,
        refreshed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`,

      // Quality checks table
      `CREATE TABLE IF NOT EXISTS quality_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        check_type TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`,

      // Analytics table
      `CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        page_url TEXT,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        search_impressions INTEGER DEFAULT 0,
        avg_load_time REAL,
        engagement_rate REAL,
        conversion_contribution REAL,
        date DATE NOT NULL,
        FOREIGN KEY (image_id) REFERENCES images(id)
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    console.log('✅ Database tables created');
  }

  /**
   * Save image to database
   */
  async saveImage(imageData) {
    const sql = `
      INSERT OR REPLACE INTO images (
        id, source, category, page, filename, original_url,
        photographer, photographer_url, license, width, height,
        score_total, score_quality, score_relevance, score_seo, score_engagement,
        selection_type, alt_text, title_attr, structured_data, attribution_html,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const params = [
      imageData.id,
      imageData.source,
      imageData.context.category,
      imageData.context.page,
      imageData.filename,
      imageData.originalUrl,
      imageData.metadata.photographer,
      imageData.metadata.photographerUrl,
      imageData.metadata.license,
      imageData.metadata.width,
      imageData.metadata.height,
      imageData.scoring?.total || 0,
      imageData.scoring?.breakdown.quality || 0,
      imageData.scoring?.breakdown.relevance || 0,
      imageData.scoring?.breakdown.seo || 0,
      imageData.scoring?.breakdown.engagement || 0,
      imageData.selectionType || 'manual',
      imageData.seo.altText,
      imageData.seo.titleAttr,
      JSON.stringify(imageData.structuredData),
      imageData.attribution.attributionHtml
    ];

    return this.run(sql, params);
  }

  /**
   * Get image by ID
   */
  async getImage(imageId) {
    const sql = 'SELECT * FROM images WHERE id = ?';
    return this.get(sql, [imageId]);
  }

  /**
   * Get images by category and page
   */
  async getImagesByPage(category, page) {
    const sql = 'SELECT * FROM images WHERE category = ? AND page = ? ORDER BY created_at DESC';
    return this.all(sql, [category, page]);
  }

  /**
   * Get all images
   */
  async getAllImages() {
    const sql = 'SELECT * FROM images ORDER BY created_at DESC';
    return this.all(sql);
  }

  /**
   * Record performance metric
   */
  async recordMetric(imageId, metricType, metricValue) {
    const sql = `
      INSERT INTO performance_metrics (image_id, metric_type, metric_value)
      VALUES (?, ?, ?)
    `;

    return this.run(sql, [imageId, metricType, metricValue]);
  }

  /**
   * Get performance metrics for image
   */
  async getMetrics(imageId, metricType = null, limit = 100) {
    let sql = 'SELECT * FROM performance_metrics WHERE image_id = ?';
    const params = [imageId];

    if (metricType) {
      sql += ' AND metric_type = ?';
      params.push(metricType);
    }

    sql += ' ORDER BY recorded_at DESC LIMIT ?';
    params.push(limit);

    return this.all(sql, params);
  }

  /**
   * Record refresh event
   */
  async recordRefresh(newImageId, oldImageId, reason, type, oldScore, newScore) {
    const sql = `
      INSERT INTO refresh_history (image_id, old_image_id, refresh_reason, refresh_type, old_score, new_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return this.run(sql, [newImageId, oldImageId, reason, type, oldScore, newScore]);
  }

  /**
   * Get refresh history
   */
  async getRefreshHistory(limit = 50) {
    const sql = `
      SELECT rh.*, i.filename, i.category, i.page
      FROM refresh_history rh
      JOIN images i ON rh.image_id = i.id
      ORDER BY refreshed_at DESC
      LIMIT ?
    `;

    return this.all(sql, [limit]);
  }

  /**
   * Record quality check
   */
  async recordQualityCheck(imageId, checkType, status, details = null) {
    const sql = `
      INSERT INTO quality_checks (image_id, check_type, status, details)
      VALUES (?, ?, ?, ?)
    `;

    return this.run(sql, [imageId, checkType, status, details]);
  }

  /**
   * Get quality check results
   */
  async getQualityChecks(imageId = null, limit = 100) {
    let sql = 'SELECT * FROM quality_checks';
    const params = [];

    if (imageId) {
      sql += ' WHERE image_id = ?';
      params.push(imageId);
    }

    sql += ' ORDER BY checked_at DESC LIMIT ?';
    params.push(limit);

    return this.all(sql, params);
  }

  /**
   * Get images due for refresh
   */
  async getImagesDueForRefresh() {
    const sql = `
      SELECT i.*,
        julianday('now') - julianday(i.updated_at) as days_old
      FROM images i
      WHERE
        (category = 'hero' AND julianday('now') - julianday(i.updated_at) >= 90) OR
        (category = 'neighborhood' AND julianday('now') - julianday(i.updated_at) >= 120) OR
        (category = 'blog' AND julianday('now') - julianday(i.updated_at) >= 180) OR
        (category = 'trust' AND julianday('now') - julianday(i.updated_at) >= 240)
      ORDER BY updated_at ASC
    `;

    return this.all(sql);
  }

  /**
   * Get statistics
   */
  async getStats() {
    const queries = {
      totalImages: 'SELECT COUNT(*) as count FROM images',
      byCategory: 'SELECT category, COUNT(*) as count FROM images GROUP BY category',
      bySource: 'SELECT source, COUNT(*) as count FROM images GROUP BY source',
      avgScore: 'SELECT AVG(score_total) as avg FROM images',
      topScores: 'SELECT id, filename, score_total FROM images ORDER BY score_total DESC LIMIT 10',
      recentRefreshes: 'SELECT COUNT(*) as count FROM refresh_history WHERE julianday("now") - julianday(refreshed_at) <= 30',
      failedQualityChecks: 'SELECT COUNT(*) as count FROM quality_checks WHERE status = "failed" AND julianday("now") - julianday(checked_at) <= 7'
    };

    const stats = {};

    for (const [key, sql] of Object.entries(queries)) {
      try {
        if (key === 'byCategory' || key === 'bySource' || key === 'topScores') {
          stats[key] = await this.all(sql);
        } else {
          const result = await this.get(sql);
          stats[key] = result.count || result.avg || 0;
        }
      } catch (error) {
        console.error(`Error getting stat ${key}:`, error.message);
        stats[key] = 0;
      }
    }

    return stats;
  }

  /**
   * Helper: Run SQL query
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Helper: Get single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Helper: Get all rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('📦 Database closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;
