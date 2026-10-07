const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MEDIA_EXTS, IMAGE_EXTS, storedFilename, assertLocalUpload } = require('../utils/uploadNames');
const { inspectUpload, collectUploads, discardUploads } = require('../utils/uploadMagic');
const { uploadByteLimits } = require('../utils/uploadLimits');

const { maxImage, maxVideo, maxFile } = uploadByteLimits();

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
  limits: { fileSize: maxFile },
});

function guard(middleware) {
  return (req, res, next) => {
    middleware(req, res, async (err) => {
      if (err) return next(err);
      const files = collectUploads(req);
      try {
        for (const file of files) {
          const check = assertLocalUpload(file, MEDIA_EXTS);
          if (!check.ok) {
            discardUploads(files);
            return res.status(400).json({ error: check.msg });
          }
          const magic = await inspectUpload(file, MEDIA_EXTS);
          if (!magic.ok) {
            discardUploads(files);
            return res.status(400).json({ error: magic.msg });
          }
          const video = !IMAGE_EXTS.has(check.ext);
          const cap = video ? maxVideo : maxImage;
          if (file.size > cap) {
            discardUploads(files);
            return res.status(413).json({
              error: video
                ? `Videoja është shumë e madhe. Maksimumi është ${Math.round(maxVideo / 1024 / 1024)}MB.`
                : `Fotoja është shumë e madhe. Maksimumi është ${Math.round(maxImage / 1024 / 1024)}MB.`,
            });
          }
        }
      } catch (checkErr) {
        discardUploads(files);
        return next(checkErr);
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
