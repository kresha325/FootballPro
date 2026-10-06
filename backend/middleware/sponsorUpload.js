const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { IMAGE_EXTS, storedFilename } = require('../utils/uploadNames');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const name = storedFilename(file, IMAGE_EXTS);
    if (!name) return cb(new Error('Only image files are allowed!'));
    cb(null, name);
  }
});

const sponsorUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (String(file.mimetype || '').toLowerCase() === 'image/svg+xml') {
      return cb(new Error('Only image files are allowed!'));
    }
    if (!storedFilename(file, IMAGE_EXTS)) {
      return cb(new Error('Only image files are allowed!'));
    }
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream') {
      return cb(null, true);
    }
    return cb(new Error('Only image files are allowed!'));
  }
});

module.exports = sponsorUpload;
