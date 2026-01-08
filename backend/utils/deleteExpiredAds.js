const { Ad } = require('../models');
const fs = require('fs');
const path = require('path');

async function deleteExpiredAds() {
  const now = new Date();
  const expiredAds = await Ad.findAll({ where: { endDate: { $lt: now } } });
  for (const ad of expiredAds) {
    // Delete image file if exists
    if (ad.imageUrl) {
      const imgPath = path.join(__dirname, '../uploads/', path.basename(ad.imageUrl));
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }
    await ad.destroy();
  }
  if (expiredAds.length > 0) {
    console.log(`Deleted ${expiredAds.length} expired ads.`);
  }
}

module.exports = deleteExpiredAds;
