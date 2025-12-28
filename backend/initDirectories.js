const fs = require('fs');
const path = require('path');

// Directories që duhen të ekzistojnë
const directories = [
  'uploads',
  'uploads/profiles',
  'uploads/posts',
  'uploads/gallery',
  'uploads/messages',
  'uploads/videos'
];

console.log('🔧 Initializing upload directories...\n');

directories.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created: ${dir}`);
  } else {
    console.log(`✓ Exists: ${dir}`);
  }
});

console.log('\n🎉 Directory initialization complete!');
