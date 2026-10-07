const multer = require('multer');
const path = require('path');
const { IMAGE_EXTS, storedFilename } = require('../utils/uploadNames');
const { guardUploads } = require('../utils/uploadMagic');
const { uploadByteLimits } = require('../utils/uploadLimits');

const { maxImage } = uploadByteLimits();

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
  limits: { fileSize: maxImage },
  fileFilter: (req, file, cb) => {
    if (!storedFilename(file, IMAGE_EXTS)) return cb(new Error('Invalid file type'));
    cb(null, true);
  },
});

const single = upload.single.bind(upload);
const array = upload.array.bind(upload);
const fields = upload.fields.bind(upload);
upload.single = (name) => guardUploads(single(name), IMAGE_EXTS);
upload.array = (...args) => guardUploads(array(...args), IMAGE_EXTS);
upload.fields = (...args) => guardUploads(fields(...args), IMAGE_EXTS);

module.exports = upload;
