#!/usr/bin/env node

/**
 * Statistics Script - Display system statistics and metrics
 */

const IntelligentMediaManager = require('./index');

async function showStats() {
  const manager = new IntelligentMediaManager();

  try {
    await manager.db.init();

    console.log('\n' + '═'.repeat(80));
    console.log('📊 INTELLIGENT MEDIA MANAGEMENT SYSTEM - STATISTICS');
    console.log('═'.repeat(80) + '\n');

    const stats = await manager.getStats();

    console.log('📈 Overview:');
    console.log(`   Total Images: ${stats.totalImages}`);
    console.log(`   Average Score: ${stats.avgScore?.toFixed(1) || 0}/100`);
    console.log(`   Recent Refreshes (30 days): ${stats.recentRefreshes}`);
    console.log(`   Failed Quality Checks (7 days): ${stats.failedQualityChecks}`);

    console.log('\n📂 By Category:');
    if (stats.byCategory && stats.byCategory.length > 0) {
      stats.byCategory.forEach(cat => {
        console.log(`   ${cat.category.padEnd(15)}: ${cat.count} images`);
      });
    } else {
      console.log('   No images yet');
    }

    console.log('\n📸 By Source:');
    if (stats.bySource && stats.bySource.length > 0) {
      const total = stats.bySource.reduce((sum, src) => sum + src.count, 0);
      stats.bySource.forEach(src => {
        const percentage = ((src.count / total) * 100).toFixed(1);
        console.log(`   ${src.source.padEnd(10)}: ${src.count.toString().padStart(3)} images (${percentage}%)`);
      });
    } else {
      console.log('   No images yet');
    }

    console.log('\n🏆 Top 10 Scores:');
    if (stats.topScores && stats.topScores.length > 0) {
      stats.topScores.forEach((img, idx) => {
        console.log(`   ${(idx + 1).toString().padStart(2)}. ${img.score_total.toFixed(1)}/100 - ${img.filename}`);
      });
    } else {
      console.log('   No images yet');
    }

    // Refresh queue
    const refreshQueue = await manager.getRefreshQueue();
    console.log(`\n📅 Refresh Queue:`);
    console.log(`   ${refreshQueue.length} images due for refresh`);

    if (refreshQueue.length > 0) {
      console.log('\n   Top 5 Due for Refresh:');
      refreshQueue.slice(0, 5).forEach((img, idx) => {
        console.log(`   ${idx + 1}. ${img.filename} (${img.days_old.toFixed(0)} days old)`);
        console.log(`      Category: ${img.category} | Page: ${img.page}`);
      });
    }

    // Recent refresh history
    const refreshHistory = await manager.db.getRefreshHistory(10);
    console.log(`\n🔄 Recent Refresh History (last 10):`);
    if (refreshHistory.length > 0) {
      refreshHistory.forEach((refresh, idx) => {
        const date = new Date(refresh.refreshed_at).toLocaleDateString();
        const scoreChange = (refresh.new_score - refresh.old_score).toFixed(1);
        const arrow = scoreChange > 0 ? '↑' : '↓';

        console.log(`   ${idx + 1}. ${date} - ${refresh.filename}`);
        console.log(`      Score: ${refresh.old_score.toFixed(1)} → ${refresh.new_score.toFixed(1)} (${arrow}${Math.abs(scoreChange)})`);
        console.log(`      Reason: ${refresh.refresh_reason}`);
      });
    } else {
      console.log('   No refresh history yet');
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

showStats();
