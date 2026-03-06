const fs = require('fs');
const path = require('path');

// Tiny 1x1 transparent PNG (base64)
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

const outDir = path.join(__dirname, '..', 'frontend', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = [
  { name: 'footballpro-icon-192.png' },
  { name: 'footballpro-icon-512.png' }
];

files.forEach(f => {
  const outPath = path.join(outDir, f.name);
  fs.writeFileSync(outPath, Buffer.from(base64Png, 'base64'));
  console.log('Wrote', outPath);
});

console.log('Placeholder icons generated. Replace them with your real PNGs when ready.');
