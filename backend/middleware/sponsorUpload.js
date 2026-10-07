const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { IMAGE_EXTS, storedFilename } = require('../utils/uploadNames');
const { guardUploads } = require('../utils/uploadMagic');
const { uploadByteLimits } = require('../utils/uploadLimits');

const { maxImage } = uploadByteLimits();

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
  limits: { fileSize: maxImage },
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

const single = sponsorUpload.single.bind(sponsorUpload);
const array = sponsorUpload.array.bind(sponsorUpload);
const fields = sponsorUpload.fields.bind(sponsorUpload);
sponsorUpload.single = (name) => guardUploads(single(name), IMAGE_EXTS);
sponsorUpload.array = (...args) => guardUploads(array(...args), IMAGE_EXTS);
sponsorUpload.fields = (...args) => guardUploads(fields(...args), IMAGE_EXTS);

module.exports = sponsorUpload;
