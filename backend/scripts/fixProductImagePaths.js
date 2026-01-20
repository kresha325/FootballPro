// Script për të përditësuar të gjitha path-et e produkteve që fillojnë me /uploads/products/ në /uploads/ në databazë
const { Product } = require('../models');

async function fixProductImagePaths() {
  const products = await Product.findAll();
  let updated = 0;
  for (const product of products) {
    if (product.imageUrl && product.imageUrl.startsWith('/uploads/products/')) {
      const filename = product.imageUrl.split('/').pop();
      product.imageUrl = '/uploads/' + filename;
      await product.save();
      updated++;
      console.log(`Updated product ${product.id}: ${product.imageUrl}`);
    }
  }
  console.log(`Done. Updated ${updated} products.`);
}

fixProductImagePaths().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
