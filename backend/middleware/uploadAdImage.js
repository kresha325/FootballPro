const multer = require('multer');
const path = require('path');
const { IMAGE_EXTS, storedFilename } = require('../utils/uploadNames');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const name = storedFilename(file, IMAGE_EXTS);
    if (!name) return cb(new Error('Invalid file type'));
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!storedFilename(file, IMAGE_EXTS)) return cb(new Error('Invalid file type'));
    cb(null, true);
  },
});

module.exports = upload;
