const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MEDIA_EXTS, storedFilename, assertLocalUpload } = require('../utils/uploadNames');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dest = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const name = storedFilename(file, MEDIA_EXTS);
    if (!name) return cb(new Error('Invalid file type'));
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (!storedFilename(file, MEDIA_EXTS)) {
    return cb(new Error('Invalid file type'));
  }
  cb(null, true);
}

const uploadLocal = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

function guard(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      const files = [];
      if (req.file) files.push(req.file);
      if (req.files) {
        const list = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
        files.push(...list.filter(Boolean));
      }
      for (const file of files) {
        const check = assertLocalUpload(file, MEDIA_EXTS);
        if (!check.ok) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({ error: check.msg });
        }
      }
      return next();
    });
  };
}

module.exports = {
  single: (name) => guard(uploadLocal.single(name)),
  array: (...args) => guard(uploadLocal.array(...args)),
  fields: (...args) => guard(uploadLocal.fields(...args)),
};
