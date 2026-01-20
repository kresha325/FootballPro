// Script për të fshirë automatikisht nga databaza të gjitha item-et e galerisë që kanë path-e të skedarëve të munguar në uploads/
const fs = require('fs');
const path = require('path');
const { Gallery } = require('../models');

async function deleteGalleryItemsWithMissingFiles() {
  const items = await Gallery.findAll();
  let deleted = 0;
  for (const item of items) {
    let filePath = null;
    if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
      filePath = path.join(__dirname, '../', item.imageUrl);
    } else if (item.videoUrl && item.videoUrl.startsWith('/uploads/')) {
      filePath = path.join(__dirname, '../', item.videoUrl);
    }
    if (filePath && !fs.existsSync(filePath)) {
      await item.destroy();
      deleted++;
      console.log(`Deleted gallery item ${item.id} (missing file: ${filePath})`);
    }
  }
  console.log(`Done. Deleted ${deleted} gallery items with missing files.`);
}

deleteGalleryItemsWithMissingFiles().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
