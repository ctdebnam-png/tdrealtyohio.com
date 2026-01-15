#!/usr/bin/env node

/**
 * Refresh Script - Manually refresh specific images or process refresh queue
 */

const IntelligentMediaManager = require('./index');
const apiConfig = require('./api-config');

async function refreshImages() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('\nUsage:');
    console.log('  npm run intelligent:refresh <command> [options]\n');
    console.log('Commands:');
    console.log('  queue              Process all images in refresh queue');
    console.log('  image <id>         Refresh specific image by ID');
    console.log('  category <name>    Refresh all images in category');
    console.log('  page <cat> <page>  Refresh all images for specific page\n');
    console.log('Examples:');
    console.log('  npm run intelligent:refresh queue');
    console.log('  npm run intelligent:refresh image pexels-12345');
    console.log('  npm run intelligent:refresh category hero');
    console.log('  npm run intelligent:refresh page hero homepage\n');
    process.exit(0);
  }

  const command = args[0];

  const manager = new IntelligentMediaManager({
    autoApprove: true
  });

  try {
    await manager.init();

    console.log('\n' + '═'.repeat(80));
    console.log('🔄 IMAGE REFRESH');
    console.log('═'.repeat(80) + '\n');

    if (command === 'queue') {
      // Process refresh queue
      const queue = await manager.getRefreshQueue();

      console.log(`Found ${queue.length} images due for refresh\n`);

      if (queue.length === 0) {
        console.log('✅ No images need refreshing');
        return;
      }

      for (let i = 0; i < queue.length; i++) {
        const img = queue[i];

        console.log(`\n[${i + 1}/${queue.length}] Refreshing ${img.filename}...`);
        console.log(`   Age: ${img.days_old.toFixed(0)} days`);
        console.log(`   Category: ${img.category} | Page: ${img.page}`);

        try {
          await manager.refreshImage(img.id, 'scheduled');
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
        }

        // Small delay
        await manager.sleep(3000);
      }

      console.log(`\n✅ Processed ${queue.length} images from refresh queue`);

    } else if (command === 'image' && args[1]) {
      // Refresh specific image
      const imageId = args[1];

      console.log(`Refreshing image: ${imageId}...\n`);

      await manager.refreshImage(imageId, 'manual');

      console.log('\n✅ Image refreshed successfully');

    } else if (command === 'category' && args[1]) {
      // Refresh all images in category
      const category = args[1];

      const images = await manager.db.all(
        'SELECT * FROM images WHERE category = ?',
        [category]
      );

      console.log(`Found ${images.length} images in category "${category}"\n`);

      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        console.log(`\n[${i + 1}/${images.length}] Refreshing ${img.filename}...`);

        try {
          await manager.refreshImage(img.id, 'category-refresh');
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
        }

        await manager.sleep(3000);
      }

      console.log(`\n✅ Refreshed ${images.length} images in category "${category}"`);

    } else if (command === 'page' && args[1] && args[2]) {
      // Refresh all images for specific page
      const category = args[1];
      const page = args[2];

      const images = await manager.db.getImagesByPage(category, page);

      console.log(`Found ${images.length} images for ${category}/${page}\n`);

      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        console.log(`\n[${i + 1}/${images.length}] Refreshing ${img.filename}...`);

        try {
          await manager.refreshImage(img.id, 'page-refresh');
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
        }

        await manager.sleep(3000);
      }

      console.log(`\n✅ Refreshed ${images.length} images for ${category}/${page}`);

    } else {
      console.error('❌ Invalid command or missing arguments');
      console.log('Run without arguments to see usage\n');
      process.exit(1);
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

refreshImages();
