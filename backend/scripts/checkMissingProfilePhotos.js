// Script për të kontrolluar profilePhoto që mungojnë fizikisht në uploads
const fs = require('fs');
const path = require('path');
const { Profile } = require('../models');

(async () => {
  const profiles = await Profile.findAll({ attributes: ['id', 'profilePhoto'] });
  const missing = [];
  for (const p of profiles) {
    if (p.profilePhoto) {
      const filename = p.profilePhoto.split('/').pop();
      const filePath = path.join(__dirname, '../uploads', filename);
      if (!fs.existsSync(filePath)) {
        missing.push({ id: p.id, profilePhoto: p.profilePhoto });
      }
    }
  }
  if (missing.length) {
    console.log('Profile photos që mungojnë në uploads:');
    missing.forEach(m => console.log(`ID: ${m.id} - ${m.profilePhoto}`));
  } else {
    console.log('Të gjitha profilePhoto ekzistojnë në uploads.');
  }
  process.exit(0);
})();
